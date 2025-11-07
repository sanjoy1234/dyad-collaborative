/**
 * Accept Invitation API
 * POST /api/invitations/[token]/accept - Accept invitation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-v4';
import { InvitationManager, InvitationError } from '@/lib/collaboration/invitation-manager';

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    // Check authentication
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'You must be logged in to accept invitations', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { token } = params;

    // Accept invitation
    await InvitationManager.acceptInvitation(token, session.user.id);

    // Get updated invitation details
    const invitation = await InvitationManager.getInvitationByToken(token);

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted successfully',
      project: {
        id: invitation?.projectId,
        name: invitation?.projectName,
      },
    });

  } catch (error) {
    console.error('[Invitations API] Accept error:', error);

    if (error instanceof InvitationError) {
      const statusCode = error.code === 'INVITATION_NOT_FOUND' ? 404 :
                        error.code === 'INVITATION_EXPIRED' ? 410 :
                        error.code === 'EMAIL_MISMATCH' ? 403 :
                        error.code === 'ALREADY_COLLABORATOR' ? 409 : 400;

      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Failed to accept invitation', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
