/**
 * Project Invitations API
 * POST /api/projects/[projectId]/invitations - Create invitation
 * GET /api/projects/[projectId]/invitations - List project invitations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-v4';
import { InvitationManager, InvitationError } from '@/lib/collaboration/invitation-manager';

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    // Check authentication
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { projectId } = params;
    const body = await request.json();
    const { email, role = 'editor', expiresInHours } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Validate role
    if (role && !['editor', 'viewer'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be "editor" or "viewer"', code: 'INVALID_ROLE' },
        { status: 400 }
      );
    }

    // Create invitation
    const invitation = await InvitationManager.createInvitation({
      projectId,
      invitedBy: session.user.id,
      email,
      role,
      expiresInHours,
    });

    // Build invitation URL
    const invitationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invitations/${invitation.token}`;

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        invitationUrl,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('[Invitations API] Create error:', error);

    if (error instanceof InvitationError) {
      const statusCode = error.code === 'FORBIDDEN' ? 403 :
                        error.code === 'PROJECT_NOT_FOUND' ? 404 :
                        error.code === 'INVITATION_EXISTS' ? 409 : 400;

      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create invitation', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    // Check authentication
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { projectId } = params;

    // List invitations
    const invitations = await InvitationManager.listProjectInvitations(
      projectId,
      session.user.id
    );

    return NextResponse.json({
      success: true,
      invitations: invitations.map(inv => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        inviterName: inv.inviterName,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        acceptedAt: inv.status === 'accepted' ? inv.expiresAt : null, // This should come from DB
      })),
    });

  } catch (error) {
    console.error('[Invitations API] List error:', error);

    if (error instanceof InvitationError) {
      const statusCode = error.code === 'FORBIDDEN' ? 403 : 400;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Failed to list invitations', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
