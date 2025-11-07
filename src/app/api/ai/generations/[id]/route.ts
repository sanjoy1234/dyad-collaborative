import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { aiGenerations, aiChats, projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/ai/generations/[id]
 * Get details of a specific AI generation including diffs
 * 
 * Response:
 * {
 *   id: string;
 *   chatId: string;
 *   status: 'pending' | 'applied' | 'rejected' | 'error';
 *   filesCreated: string[];
 *   filesModified: string[];
 *   filesDeleted: string[];
 *   diffs: UnifiedDiff;
 *   snapshotBefore: string;
 *   snapshotAfter: string | null;
 *   approvedBy: string | null;
 *   approvedAt: string | null;
 *   errorMessage: string | null;
 *   createdAt: string;
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: generationId } = params;

    // Get generation (using simple select instead of relational query)
    const [generation] = await db
      .select()
      .from(aiGenerations)
      .where(eq(aiGenerations.id, generationId))
      .limit(1);

    if (!generation) {
      return NextResponse.json({ error: 'Generation not found' }, { status: 404 });
    }

    // Get chat to verify project access
    const [chat] = await db
      .select()
      .from(aiChats)
      .where(eq(aiChats.id, generation.chat_id))
      .limit(1);

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Get project to verify access
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, chat.project_id))
      .limit(1);

    if (!project || project.owner_id !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Extract diffs from metadata
    const metadata = generation.metadata as any;
    const diffs = metadata?.diffs || null;

    return NextResponse.json({
      id: generation.id,
      chatId: generation.chat_id,
      status: generation.status,
      filesCreated: generation.files_created || [],
      filesModified: generation.files_modified || [],
      filesDeleted: generation.files_deleted || [],
      diffs,
      snapshotBefore: generation.snapshot_before,
      snapshotAfter: generation.snapshot_after,
      approvedBy: generation.approved_by,
      approvedAt: generation.approved_at?.toISOString() || null,
      errorMessage: generation.error_message,
      createdAt: generation.created_at.toISOString(),
    });
  } catch (error) {
    console.error('Get generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
