/**
 * Invitation Manager
 * Handles project collaboration invitation lifecycle
 * MVP Phase 1 - Invitation System
 */

import { db } from '@/lib/db';
import { projectInvitations, projectCollaborators, users, projects } from '@/lib/db/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { EmailService } from '@/lib/email/email-service';

export interface CreateInvitationParams {
  projectId: string;
  invitedBy: string;
  email: string;
  role: 'editor' | 'viewer';
  expiresInHours?: number;
}

export interface InvitationWithProject {
  id: string;
  projectId: string;
  projectName: string;
  email: string;
  role: string;
  invitedBy: string;
  inviterName: string;
  inviterEmail: string;
  status: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export class InvitationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'InvitationError';
  }
}

export class InvitationManager {
  /**
   * Generate a secure random token for invitation
   */
  private static generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Check if a user has access to a project (owner or collaborator)
   */
  static async checkProjectAccess(userId: string, projectId: string): Promise<boolean> {
    // Check if user is owner
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (project?.owner_id === userId) {
      return true;
    }

    // Check if user is collaborator
    const collaboration = await db.query.projectCollaborators.findFirst({
      where: and(
        eq(projectCollaborators.project_id, projectId),
        eq(projectCollaborators.user_id, userId)
      ),
    });

    return !!collaboration;
  }

  /**
   * Check if a user is project owner
   */
  static async isProjectOwner(userId: string, projectId: string): Promise<boolean> {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    return project?.owner_id === userId;
  }

  /**
   * Create a new project invitation
   */
  static async createInvitation(params: CreateInvitationParams): Promise<InvitationWithProject> {
    const { projectId, invitedBy, email, role, expiresInHours = 168 } = params; // Default 7 days

    // Validate role
    if (!['editor', 'viewer'].includes(role)) {
      throw new InvitationError('Invalid role. Must be "editor" or "viewer"', 'INVALID_ROLE');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new InvitationError('Invalid email format', 'INVALID_EMAIL');
    }

    // Check if inviter is project owner
    const isOwner = await this.isProjectOwner(invitedBy, projectId);
    if (!isOwner) {
      throw new InvitationError('Only project owner can send invitations', 'FORBIDDEN');
    }

    // Get project details
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      throw new InvitationError('Project not found', 'PROJECT_NOT_FOUND');
    }

    // Check if inviter exists
    const inviter = await db.query.users.findFirst({
      where: eq(users.id, invitedBy),
    });

    if (!inviter) {
      throw new InvitationError('Inviter not found', 'INVITER_NOT_FOUND');
    }

    // Check if email is already a collaborator
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existingUser) {
      const existingCollab = await db.query.projectCollaborators.findFirst({
        where: and(
          eq(projectCollaborators.project_id, projectId),
          eq(projectCollaborators.user_id, existingUser.id)
        ),
      });

      if (existingCollab) {
        throw new InvitationError('User already has access to this project', 'ALREADY_COLLABORATOR');
      }
    }

    // Check for existing pending invitation
    const pendingInvitation = await db.query.projectInvitations.findFirst({
      where: and(
        eq(projectInvitations.project_id, projectId),
        eq(projectInvitations.email, email),
        eq(projectInvitations.status, 'pending')
      ),
    });

    if (pendingInvitation) {
      throw new InvitationError('Pending invitation already exists for this email', 'INVITATION_EXISTS');
    }

    // Generate token and expiration
    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresInHours);

    // Create invitation
    const [invitation] = await db
      .insert(projectInvitations)
      .values({
        project_id: projectId,
        invited_by: invitedBy,
        email,
        role,
        token,
        expires_at: expiresAt,
        invited_user_id: existingUser?.id || null,
        status: 'pending',
      })
      .returning();

    // Send email notification (async, don't wait)
    const invitationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invitations/${token}`;
    EmailService.sendInvitationEmail({
      to: email,
      invitationUrl,
      projectId: projectId,
      projectName: project.name,
      inviterName: inviter.username,
    }).catch(err => {
      console.error('[InvitationManager] Failed to send invitation email:', err);
      // Don't throw - email failure shouldn't block invitation creation
    });

    return {
      id: invitation.id,
      projectId: invitation.project_id,
      projectName: project.name,
      email: invitation.email,
      role: invitation.role,
      invitedBy: invitation.invited_by,
      inviterName: inviter.username,
      inviterEmail: inviter.email,
      status: invitation.status,
      token: invitation.token,
      expiresAt: invitation.expires_at,
      createdAt: invitation.created_at,
    };
  }

  /**
   * Get invitation by token
   */
  static async getInvitationByToken(token: string): Promise<InvitationWithProject | null> {
    const invitation = await db.query.projectInvitations.findFirst({
      where: eq(projectInvitations.token, token),
    });

    if (!invitation) {
      return null;
    }

    // Get project details
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, invitation.project_id),
    });

    // Get inviter details
    const inviter = await db.query.users.findFirst({
      where: eq(users.id, invitation.invited_by),
    });

    if (!project || !inviter) {
      return null;
    }

    return {
      id: invitation.id,
      projectId: invitation.project_id,
      projectName: project.name,
      email: invitation.email,
      role: invitation.role,
      invitedBy: invitation.invited_by,
      inviterName: inviter.username,
      inviterEmail: inviter.email,
      status: invitation.status,
      token: invitation.token,
      expiresAt: invitation.expires_at,
      createdAt: invitation.created_at,
    };
  }

  /**
   * Accept an invitation
   */
  static async acceptInvitation(token: string, userId: string): Promise<void> {
    const invitation = await db.query.projectInvitations.findFirst({
      where: eq(projectInvitations.token, token),
    });

    if (!invitation) {
      throw new InvitationError('Invitation not found', 'INVITATION_NOT_FOUND');
    }

    // Check invitation status
    if (invitation.status !== 'pending') {
      throw new InvitationError(`Invitation already ${invitation.status}`, 'INVITATION_NOT_PENDING');
    }

    // Check expiration
    if (invitation.expires_at < new Date()) {
      await db
        .update(projectInvitations)
        .set({ status: 'expired', updated_at: new Date() })
        .where(eq(projectInvitations.id, invitation.id));
      
      throw new InvitationError('Invitation has expired', 'INVITATION_EXPIRED');
    }

    // Get user details
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new InvitationError('User not found', 'USER_NOT_FOUND');
    }

    // Verify email matches
    if (user.email !== invitation.email) {
      throw new InvitationError('Invitation email does not match your account', 'EMAIL_MISMATCH');
    }

    // Check if already a collaborator
    const existingCollab = await db.query.projectCollaborators.findFirst({
      where: and(
        eq(projectCollaborators.project_id, invitation.project_id),
        eq(projectCollaborators.user_id, userId)
      ),
    });

    if (existingCollab) {
      // Update invitation status
      await db
        .update(projectInvitations)
        .set({ 
          status: 'accepted', 
          accepted_at: new Date(),
          invited_user_id: userId,
          updated_at: new Date() 
        })
        .where(eq(projectInvitations.id, invitation.id));
      
      throw new InvitationError('You already have access to this project', 'ALREADY_COLLABORATOR');
    }

    // Add user as collaborator
    await db.insert(projectCollaborators).values({
      project_id: invitation.project_id,
      user_id: userId,
      role: invitation.role,
      invited_by: invitation.invited_by,
    });

    // Update invitation status
    await db
      .update(projectInvitations)
      .set({ 
        status: 'accepted', 
        accepted_at: new Date(),
        invited_user_id: userId,
        updated_at: new Date() 
      })
      .where(eq(projectInvitations.id, invitation.id));
  }

  /**
   * Reject an invitation
   */
  static async rejectInvitation(token: string): Promise<void> {
    const invitation = await db.query.projectInvitations.findFirst({
      where: eq(projectInvitations.token, token),
    });

    if (!invitation) {
      throw new InvitationError('Invitation not found', 'INVITATION_NOT_FOUND');
    }

    if (invitation.status !== 'pending') {
      throw new InvitationError(`Invitation already ${invitation.status}`, 'INVITATION_NOT_PENDING');
    }

    await db
      .update(projectInvitations)
      .set({ status: 'rejected', updated_at: new Date() })
      .where(eq(projectInvitations.id, invitation.id));
  }

  /**
   * Revoke an invitation (by project owner)
   */
  static async revokeInvitation(invitationId: string, userId: string): Promise<void> {
    const invitation = await db.query.projectInvitations.findFirst({
      where: eq(projectInvitations.id, invitationId),
    });

    if (!invitation) {
      throw new InvitationError('Invitation not found', 'INVITATION_NOT_FOUND');
    }

    // Verify user is project owner
    const isOwner = await this.isProjectOwner(userId, invitation.project_id);
    if (!isOwner) {
      throw new InvitationError('Only project owner can revoke invitations', 'FORBIDDEN');
    }

    if (invitation.status !== 'pending') {
      throw new InvitationError(`Cannot revoke ${invitation.status} invitation`, 'CANNOT_REVOKE');
    }

    await db
      .update(projectInvitations)
      .set({ status: 'revoked', updated_at: new Date() })
      .where(eq(projectInvitations.id, invitation.id));
  }

  /**
   * List invitations for a project
   */
  static async listProjectInvitations(projectId: string, userId: string): Promise<InvitationWithProject[]> {
    // Verify user has access to project
    const hasAccess = await this.checkProjectAccess(userId, projectId);
    if (!hasAccess) {
      throw new InvitationError('Access denied', 'FORBIDDEN');
    }

    const invitationsList = await db.query.projectInvitations.findMany({
      where: eq(projectInvitations.project_id, projectId),
      orderBy: (invitations, { desc }) => [desc(invitations.created_at)],
    });

    // Get project details
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return [];
    }

    // Get all inviters
    const inviterIds = [...new Set(invitationsList.map(inv => inv.invited_by))];
    const inviters = await db.query.users.findMany({
      where: or(...inviterIds.map(id => eq(users.id, id))),
    });

    const inviterMap = new Map(inviters.map(u => [u.id, u]));

    return invitationsList.map(invitation => {
      const inviter = inviterMap.get(invitation.invited_by);
      return {
        id: invitation.id,
        projectId: invitation.project_id,
        projectName: project.name,
        email: invitation.email,
        role: invitation.role,
        invitedBy: invitation.invited_by,
        inviterName: inviter?.username || 'Unknown',
        inviterEmail: inviter?.email || '',
        status: invitation.status,
        token: invitation.token,
        expiresAt: invitation.expires_at,
        createdAt: invitation.created_at,
      };
    });
  }

  /**
   * List pending invitations for a user by email
   */
  static async listUserInvitations(email: string): Promise<InvitationWithProject[]> {
    const invitationsList = await db.query.projectInvitations.findMany({
      where: and(
        eq(projectInvitations.email, email),
        eq(projectInvitations.status, 'pending')
      ),
      orderBy: (invitations, { desc }) => [desc(invitations.created_at)],
    });

    // Get project details
    const projectIds = [...new Set(invitationsList.map(inv => inv.project_id))];
    const projectsList = await db.query.projects.findMany({
      where: or(...projectIds.map(id => eq(projects.id, id))),
    });
    const projectMap = new Map(projectsList.map(p => [p.id, p]));

    // Get inviter details
    const inviterIds = [...new Set(invitationsList.map(inv => inv.invited_by))];
    const inviters = await db.query.users.findMany({
      where: or(...inviterIds.map(id => eq(users.id, id))),
    });
    const inviterMap = new Map(inviters.map(u => [u.id, u]));

    return invitationsList
      .filter(invitation => {
        // Filter out expired invitations
        return invitation.expires_at >= new Date();
      })
      .map(invitation => {
        const project = projectMap.get(invitation.project_id);
        const inviter = inviterMap.get(invitation.invited_by);
        return {
          id: invitation.id,
          projectId: invitation.project_id,
          projectName: project?.name || 'Unknown Project',
          email: invitation.email,
          role: invitation.role,
          invitedBy: invitation.invited_by,
          inviterName: inviter?.username || 'Unknown',
          inviterEmail: inviter?.email || '',
          status: invitation.status,
          token: invitation.token,
          expiresAt: invitation.expires_at,
          createdAt: invitation.created_at,
        };
      });
  }

  /**
   * Clean up expired invitations
   */
  static async cleanupExpiredInvitations(): Promise<number> {
    const result = await db
      .update(projectInvitations)
      .set({ status: 'expired', updated_at: new Date() })
      .where(
        and(
          eq(projectInvitations.status, 'pending'),
          // @ts-ignore - Drizzle ORM doesn't have proper type for this comparison
          sql`${projectInvitations.expires_at} < NOW()`
        )
      )
      .returning();

    return result.length;
  }
}
