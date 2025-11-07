/**
 * Invitation Actions API
 * POST /api/invitations/[token]/accept - Accept invitation
 * POST /api/invitations/[token]/reject - Reject invitation
 * GET /api/invitations/[token] - Get invitation details
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-v4';
import { InvitationManager, InvitationError } from '@/lib/collaboration/invitation-manager';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    // Get invitation details
    const invitation = await InvitationManager.getInvitationByToken(token);

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found', code: 'INVITATION_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check if expired
    if (invitation.expiresAt < new Date() && invitation.status === 'pending') {
      return NextResponse.json(
        { 
          error: 'Invitation has expired', 
          code: 'INVITATION_EXPIRED',
          invitation: {
            projectName: invitation.projectName,
            status: 'expired',
          }
        },
        { status: 410 } // Gone
      );
    }

    return NextResponse.json({
      success: true,
      invitation: {
        projectId: invitation.projectId,
        projectName: invitation.projectName,
        email: invitation.email,
        role: invitation.role,
        inviterName: invitation.inviterName,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      },
    });

  } catch (error) {
    console.error('[Invitations API] Get error:', error);
    return NextResponse.json(
      { error: 'Failed to get invitation details', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
