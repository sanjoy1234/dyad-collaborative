import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { aiGenerations, projectFiles } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { applyFileOperations, readFile } from '@/lib/ai/file-operations';
import { createSnapshot } from '@/lib/ai/snapshot-manager';
import { FileOperation } from '@/lib/ai/prompt-engineer';
import * as path from 'path';

/**
 * POST /api/ai/generations/[id]/approve
 * Approve and apply AI-generated code changes
 * 
 * Response:
 * {
 *   success: boolean;
 *   filesChanged: string[];
 *   snapshotAfter: string;
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

    // Get project ID from chat
    const chatQuery = await db.query.aiChats.findFirst({
      where: (chats, { eq }) => eq(chats.id, generation.chat_id),
    });

    if (!chatQuery) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const projectId = chatQuery.project_id;

    // Extract operations from metadata
    const metadata = generation.metadata as any;
    const operations: FileOperation[] = metadata?.operations || [];

    // Remove oldContent from operations as it's not needed for apply
    const cleanOperations = operations.map(({ oldContent, ...op }: any) => op);

    if (cleanOperations.length === 0) {
      return NextResponse.json(
        { error: 'No operations to apply' },
        { status: 400 }
      );
    }

    // Apply file operations atomically
    const result = await applyFileOperations(projectId, cleanOperations);

    if (!result.success) {
      // Update generation status to error
      await db
        .update(aiGenerations)
        .set({
          status: 'rejected',
          error_message: result.error || 'Failed to apply changes',
        })
        .where(eq(aiGenerations.id, generationId));

      return NextResponse.json(
        { 
          error: 'Failed to apply changes',
          details: result.error,
          rollbackPerformed: result.rollbackPerformed,
        },
        { status: 500 }
      );
    }

    // Save files to database for files that were created or modified
    for (const op of cleanOperations) {
      if (op.type === 'create' || op.type === 'modify') {
        try {
          // Read file content from disk
          const content = await readFile(projectId, op.path);
          const fileExt = path.extname(op.path).slice(1);
          const fileSize = Buffer.byteLength(content, 'utf8');

          // Insert or update in database
          await db
            .insert(projectFiles)
            .values({
              project_id: projectId,
              path: op.path,
              content: content,
              file_type: fileExt,
              size_bytes: fileSize,
              created_by: session.user.id,
              updated_by: session.user.id,
            })
            .onConflictDoUpdate({
              target: [projectFiles.project_id, projectFiles.path],
              set: {
                content: content,
                file_type: fileExt,
                size_bytes: fileSize,
                updated_by: session.user.id,
                updated_at: new Date(),
              },
            });
        } catch (error) {
          console.error(`Error saving file ${op.path} to database:`, error);
        }
      } else if (op.type === 'delete') {
        // Delete from database
        try {
          await db
            .delete(projectFiles)
            .where(
              and(
                eq(projectFiles.project_id, projectId),
                eq(projectFiles.path, op.path)
              )
            );
        } catch (error) {
          console.error(`Error deleting file ${op.path} from database:`, error);
        }
      }
    }

    // Create snapshot after successful application
    const snapshotAfter = await createSnapshot(
      projectId,
      session.user.id,
      `After applying generation ${generationId}`,
      generationId
    );

    // Update generation status
    await db
      .update(aiGenerations)
      .set({
        status: 'applied',
        approved_by: session.user.id,
        approved_at: new Date(),
        snapshot_after: snapshotAfter,
      })
      .where(eq(aiGenerations.id, generationId));

    return NextResponse.json({
      success: true,
      filesChanged: result.filesChanged,
      snapshotAfter,
    });
  } catch (error) {
    console.error('Approve generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
