# Real-Time Collaboration - Implementation Plan

## Executive Summary

This document outlines the step-by-step implementation of real-time collaborative code editing with project invitation system for the Dyad Collaborative platform.

**Estimated Timeline:** 14 days (2 sprints)
**Complexity:** High
**Dependencies:** Socket.IO, Y.js, Monaco Editor, PostgreSQL

---

## Phase 1: Database Schema & Migrations (Days 1-2)

### Step 1.1: Create Migration Files

**File:** `drizzle/migrations/0009_add_collaboration_tables.sql`

```sql
-- Project Invitations Table
CREATE TABLE project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(id),
  invited_email VARCHAR(255) NOT NULL,
  invited_user_id UUID REFERENCES users(id),
  role VARCHAR(50) NOT NULL DEFAULT 'editor',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invitations_email ON project_invitations(invited_email);
CREATE INDEX idx_invitations_token ON project_invitations(token);
CREATE INDEX idx_invitations_project ON project_invitations(project_id);
CREATE INDEX idx_invitations_status ON project_invitations(status);

-- Enhance Project Collaborators Table
ALTER TABLE project_collaborators 
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'editor',
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS current_file_path VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS assigned_color VARCHAR(7);

-- Collaboration Sessions Table
CREATE TABLE collaboration_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  socket_id VARCHAR(255) NOT NULL UNIQUE,
  file_path VARCHAR(1000),
  cursor_position JSONB,
  selection_range JSONB,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disconnected_at TIMESTAMP
);

CREATE INDEX idx_sessions_project ON collaboration_sessions(project_id);
CREATE INDEX idx_sessions_socket ON collaboration_sessions(socket_id);
CREATE INDEX idx_sessions_user ON collaboration_sessions(user_id);
CREATE INDEX idx_sessions_status ON collaboration_sessions(status);

-- File Operations Log (for OT/CRDT recovery)
CREATE TABLE file_edit_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path VARCHAR(1000) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  session_id UUID REFERENCES collaboration_sessions(id),
  operation_type VARCHAR(50) NOT NULL,
  operation_data JSONB NOT NULL,
  version_number INTEGER NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_operations_file ON file_edit_operations(project_id, file_path, version_number DESC);
CREATE INDEX idx_operations_session ON file_edit_operations(session_id);
```

### Step 1.2: Update Drizzle Schema

**File:** `src/lib/db/schema.ts`

Add new table definitions:

```typescript
export const projectInvitations = pgTable('project_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  invitedBy: uuid('invited_by').notNull().references(() => users.id),
  invitedEmail: varchar('invited_email', { length: 255 }).notNull(),
  invitedUserId: uuid('invited_user_id').references(() => users.id),
  role: varchar('role', { length: 50 }).notNull().default('editor'),
  status: varchar('status', { length: 50 }).notNull().default('pending'),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at'),
  acceptedAt: timestamp('accepted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const collaborationSessions = pgTable('collaboration_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  socketId: varchar('socket_id', { length: 255 }).notNull().unique(),
  filePath: varchar('file_path', { length: 1000 }),
  cursorPosition: jsonb('cursor_position').$type<{ line: number; column: number }>(),
  selectionRange: jsonb('selection_range').$type<{ start: { line: number; column: number }; end: { line: number; column: number } }>(),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  connectedAt: timestamp('connected_at').notNull().defaultNow(),
  lastActivityAt: timestamp('last_activity_at').notNull().defaultNow(),
  disconnectedAt: timestamp('disconnected_at'),
});

export const fileEditOperations = pgTable('file_edit_operations', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  filePath: varchar('file_path', { length: 1000 }).notNull(),
  userId: uuid('user_id').notNull().references(() => users.id),
  sessionId: uuid('session_id').references(() => collaborationSessions.id),
  operationType: varchar('operation_type', { length: 50 }).notNull(),
  operationData: jsonb('operation_data').notNull(),
  versionNumber: integer('version_number').notNull(),
  appliedAt: timestamp('applied_at').notNull().defaultNow(),
});
```

### Step 1.3: Run Migrations

```bash
npm run db:migrate
npm run db:push
```

---

## Phase 2: Invitation System APIs (Days 2-3)

### Step 2.1: Invitation Manager Library

**File:** `src/lib/collaboration/invitation-manager.ts`

```typescript
import { db } from '@/lib/db';
import { projectInvitations, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { sendInvitationEmail } from '@/lib/email';

export class InvitationManager {
  /**
   * Create a new project invitation
   */
  static async createInvitation(params: {
    projectId: string;
    invitedBy: string;
    email: string;
    role: 'editor' | 'viewer';
    expiresInHours?: number;
  }) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (params.expiresInHours || 168)); // Default 7 days

    // Check if user already has access
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, params.email),
    });

    if (existingUser) {
      const existingCollab = await db.query.projectCollaborators.findFirst({
        where: and(
          eq(projectCollaborators.project_id, params.projectId),
          eq(projectCollaborators.user_id, existingUser.id)
        ),
      });

      if (existingCollab) {
        throw new Error('User already has access to this project');
      }
    }

    // Create invitation
    const [invitation] = await db
      .insert(projectInvitations)
      .values({
        projectId: params.projectId,
        invitedBy: params.invitedBy,
        invitedEmail: params.email,
        invitedUserId: existingUser?.id,
        role: params.role,
        token,
        expiresAt,
      })
      .returning();

    // Send email notification
    await sendInvitationEmail({
      to: params.email,
      invitationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/invitations/${token}`,
      projectId: params.projectId,
      inviterName: 'TODO', // Get from invitedBy user
    });

    return invitation;
  }

  /**
   * Accept an invitation
   */
  static async acceptInvitation(token: string, userId: string) {
    const invitation = await db.query.projectInvitations.findFirst({
      where: and(
        eq(projectInvitations.token, token),
        eq(projectInvitations.status, 'pending')
      ),
    });

    if (!invitation) {
      throw new Error('Invitation not found or already used');
    }

    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      throw new Error('Invitation has expired');
    }

    // Add user as collaborator
    await db.insert(projectCollaborators).values({
      projectId: invitation.projectId,
      userId,
      role: invitation.role,
      addedBy: invitation.invitedBy,
    });

    // Update invitation status
    await db
      .update(projectInvitations)
      .set({
        status: 'accepted',
        invitedUserId: userId,
        acceptedAt: new Date(),
      })
      .where(eq(projectInvitations.id, invitation.id));

    return invitation;
  }

  /**
   * Revoke an invitation
   */
  static async revokeInvitation(invitationId: string, userId: string) {
    // Verify user is project owner
    const invitation = await db.query.projectInvitations.findFirst({
      where: eq(projectInvitations.id, invitationId),
    });

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, invitation.projectId),
    });

    if (project?.ownerId !== userId) {
      throw new Error('Only project owner can revoke invitations');
    }

    await db
      .update(projectInvitations)
      .set({ status: 'revoked', updatedAt: new Date() })
      .where(eq(projectInvitations.id, invitationId));
  }
}
```

### Step 2.2: Invitation API Routes

**File:** `src/app/api/projects/[projectId]/invitations/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-v4';
import { InvitationManager } from '@/lib/collaboration/invitation-manager';
import { db } from '@/lib/db';
import { projectInvitations, projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = params;
    const { email, role, expiresInHours } = await request.json();

    // Verify user is project owner
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project || project.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Only project owner can send invitations' }, { status: 403 });
    }

    const invitation = await InvitationManager.createInvitation({
      projectId,
      invitedBy: session.user.id,
      email,
      role: role || 'editor',
      expiresInHours,
    });

    return NextResponse.json({
      id: invitation.id,
      email: invitation.invitedEmail,
      role: invitation.role,
      invitationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/invitations/${invitation.token}`,
      expiresAt: invitation.expiresAt,
    });
  } catch (error) {
    console.error('Create invitation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create invitation' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = params;

    // Verify user has access to project
    const hasAccess = await checkProjectAccess(session.user.id, projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const invitations = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.projectId, projectId))
      .orderBy(projectInvitations.createdAt);

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('Get invitations error:', error);
    return NextResponse.json(
      { error: 'Failed to get invitations' },
      { status: 500 }
    );
  }
}
```

[... continuing in next message due to length ...]
