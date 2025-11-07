/**
 * Revoke Project Invitation API
 * DELETE /api/projects/[projectId]/invitations/[invitationId] - Revoke invitation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-v4';
import { InvitationManager, InvitationError } from '@/lib/collaboration/invitation-manager';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; invitationId: string } }
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

    const { invitationId } = params;

    // Revoke invitation
    await InvitationManager.revokeInvitation(invitationId, session.user.id);

    return NextResponse.json({
      success: true,
      message: 'Invitation revoked successfully',
    });

  } catch (error) {
    console.error('[Invitations API] Revoke error:', error);

    if (error instanceof InvitationError) {
      const statusCode = error.code === 'FORBIDDEN' ? 403 :
                        error.code === 'INVITATION_NOT_FOUND' ? 404 : 400;

      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Failed to revoke invitation', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
