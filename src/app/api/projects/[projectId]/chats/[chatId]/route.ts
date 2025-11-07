import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { aiChats, aiMessages } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * GET /api/projects/[projectId]/chats/[chatId]
 * Get chat details
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

    // Get chat with message count
    const [chat] = await db
      .select({
        id: aiChats.id,
        name: aiChats.name,
        model_provider: aiChats.model_provider,
        model_name: aiChats.model_name,
        created_at: aiChats.created_at,
        updated_at: aiChats.updated_at,
        messageCount: sql<number>`(
          SELECT COUNT(*)::int 
          FROM ${aiMessages} 
          WHERE ${aiMessages.chat_id} = ${aiChats.id}
        )`,
      })
      .from(aiChats)
      .where(and(eq(aiChats.id, chatId), eq(aiChats.created_by, session.user.id)))
      .limit(1);

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: chat.id,
      title: chat.name,
      model: chat.model_name || chat.model_provider || 'auto',
      messageCount: chat.messageCount,
      createdAt: chat.created_at.toISOString(),
      updatedAt: chat.updated_at.toISOString(),
    });
  } catch (error) {
    console.error('Get chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/[projectId]/chats/[chatId]
 * Update chat details
 * 
 * Request Body:
 * {
 *   title?: string;
 *   model?: string;
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string; chatId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId } = params;
    const body = await request.json();
    const { title, model } = body;

    // Verify chat exists and user has access
    const [existingChat] = await db
      .select()
      .from(aiChats)
      .where(and(eq(aiChats.id, chatId), eq(aiChats.created_by, session.user.id)))
      .limit(1);

    if (!existingChat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Build update object
    const updates: {
      name?: string;
      model_name?: string;
      updated_at?: Date;
    } = {
      updated_at: new Date(),
    };

    if (title !== undefined) {
      updates.name = title;
    }

    if (model !== undefined) {
      updates.model_name = model;
    }

    // Update chat
    const [updatedChat] = await db
      .update(aiChats)
      .set(updates)
      .where(eq(aiChats.id, chatId))
      .returning();

    return NextResponse.json({
      id: updatedChat.id,
      title: updatedChat.name,
      model: updatedChat.model_name || 'auto',
      updatedAt: updatedChat.updated_at.toISOString(),
    });
  } catch (error) {
    console.error('Update chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[projectId]/chats/[chatId]
 * Delete a chat and all its messages
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string; chatId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId } = params;

    // Verify chat exists and user has access
    const [existingChat] = await db
      .select()
      .from(aiChats)
      .where(and(eq(aiChats.id, chatId), eq(aiChats.created_by, session.user.id)))
      .limit(1);

    if (!existingChat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Delete chat (cascade will delete messages)
    await db.delete(aiChats).where(eq(aiChats.id, chatId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
