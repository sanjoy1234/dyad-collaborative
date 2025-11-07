import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { aiChats, aiMessages } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * GET /api/projects/[projectId]/chats/[chatId]/messages
 * Get all messages for a chat
 * 
 * Query Parameters:
 * - limit?: number (default: 50)
 * - offset?: number (default: 0)
 * 
 * Response:
 * {
 *   messages: [{
 *     id: string;
 *     role: 'user' | 'assistant' | 'system';
 *     content: string;
 *     tokensUsed: number;
 *     createdAt: string;
 *   }],
 *   total: number;
 *   hasMore: boolean;
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; chatId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId } = params;
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Verify chat exists and user has access
    const [chat] = await db
      .select()
      .from(aiChats)
      .where(and(eq(aiChats.id, chatId), eq(aiChats.created_by, session.user.id)))
      .limit(1);

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Get messages
    const messages = await db
      .select({
        id: aiMessages.id,
        role: aiMessages.role,
        content: aiMessages.content,
        tokens_used: aiMessages.tokens_used,
        created_at: aiMessages.created_at,
      })
      .from(aiMessages)
      .where(eq(aiMessages.chat_id, chatId))
      .orderBy(desc(aiMessages.created_at))
      .limit(limit + 1) // Get one extra to check if there are more
      .offset(offset);

    const hasMore = messages.length > limit;
    const returnMessages = hasMore ? messages.slice(0, limit) : messages;

    // Reverse to get chronological order (oldest first)
    returnMessages.reverse();

    return NextResponse.json({
      messages: returnMessages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        tokensUsed: msg.tokens_used || 0,
        createdAt: msg.created_at.toISOString(),
      })),
      total: offset + returnMessages.length,
      hasMore,
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
