/**
 * Direct Add Collaborator API (For Test Accounts)
 * POST /api/projects/[projectId]/collaborators/add-direct
 * Bypasses email invitation for test accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-v4';
import { db } from '@/lib/db';
import { projectCollaborators, projects, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    // Check authentication
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { projectId } = params;
    const body = await request.json();
    const { email, role = 'editor' } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate role
    if (!['editor', 'viewer'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be "editor" or "viewer"' },
        { status: 400 }
      );
    }

    // Verify project exists and user is owner
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (project.owner_id !== session.user.id) {
      return NextResponse.json(
        { error: 'Only project owner can add collaborators' },
        { status: 403 }
      );
    }

    // Find user by email
    const userToAdd = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!userToAdd) {
      return NextResponse.json(
        { error: 'User not found with this email' },
        { status: 404 }
      );
    }

    // Check if already a collaborator
    const existingCollab = await db.query.projectCollaborators.findFirst({
      where: and(
        eq(projectCollaborators.project_id, projectId),
        eq(projectCollaborators.user_id, userToAdd.id)
      ),
    });

    if (existingCollab) {
      return NextResponse.json(
        { error: 'User is already a collaborator' },
        { status: 409 }
      );
    }

    // Add user as collaborator directly
    const [newCollab] = await db.insert(projectCollaborators).values({
      project_id: projectId,
      user_id: userToAdd.id,
      role: role,
      invited_by: session.user.id,
    }).returning();

    return NextResponse.json({
      success: true,
      collaborator: {
        id: newCollab.id,
        userId: userToAdd.id,
        username: userToAdd.username,
        email: userToAdd.email,
        role: newCollab.role,
        joinedAt: newCollab.joined_at,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('[Add Direct Collaborator API] Error:', error);

    return NextResponse.json(
      { error: 'Failed to add collaborator' },
      { status: 500 }
    );
  }
}
