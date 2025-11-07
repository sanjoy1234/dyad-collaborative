/**
 * Reject Invitation API
 * POST /api/invitations/[token]/reject - Reject invitation
 */

import { NextRequest, NextResponse } from 'next/server';
import { InvitationManager, InvitationError } from '@/lib/collaboration/invitation-manager';

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    // Reject invitation (no auth required - public action)
    await InvitationManager.rejectInvitation(token);

    return NextResponse.json({
      success: true,
      message: 'Invitation rejected',
    });

  } catch (error) {
    console.error('[Invitations API] Reject error:', error);

    if (error instanceof InvitationError) {
      const statusCode = error.code === 'INVITATION_NOT_FOUND' ? 404 : 400;

      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Failed to reject invitation', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
