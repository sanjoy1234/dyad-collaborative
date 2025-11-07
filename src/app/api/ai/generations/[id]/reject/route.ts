import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { aiGenerations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/ai/generations/[id]/reject
 * Reject AI-generated code changes (no files are modified)
 * 
 * Response:
 * {
 *   success: boolean;
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: generationId } = params;

    // Get generation
    const [generation] = await db
      .select()
      .from(aiGenerations)
      .where(eq(aiGenerations.id, generationId))
      .limit(1);

    if (!generation) {
      return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
    }

    if (generation.status !== 'pending') {
      return NextResponse.json(
        { error: `Generation already ${generation.status}` },
        { status: 400 }
      );
    }

    // Update generation status to rejected
    await db
      .update(aiGenerations)
      .set({
        status: 'rejected',
        approved_by: session.user.id,
        approved_at: new Date(),
      })
      .where(eq(aiGenerations.id, generationId));

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Reject generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
