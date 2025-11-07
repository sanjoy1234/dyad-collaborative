import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { aiChats, aiMessages, projects } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

/**
 * GET /api/projects/[projectId]/chats
 * Get all chats for a project
 * 
 * Response:
 * {
 *   chats: [{
 *     id: string;
 *     title: string;
 *     model: string;
 *     messageCount: number;
 *     lastActivity: string;
 *     createdAt: string;
 *   }]
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = params;

    // Verify user has access to project
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get all chats for this project
    const chats = await db
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
      .where(
        and(
          eq(aiChats.project_id, projectId),
          eq(aiChats.created_by, session.user.id)
        )
      )
      .orderBy(desc(aiChats.updated_at));

    return NextResponse.json({
      chats: chats.map((chat) => ({
        id: chat.id,
        title: chat.name,
        model: chat.model_name || chat.model_provider || 'auto',
        messageCount: chat.messageCount,
        lastActivity: chat.updated_at.toISOString(),
        createdAt: chat.created_at.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Get chats error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[projectId]/chats
 * Create a new chat
 * 
 * Request Body:
 * {
 *   title?: string; // Optional, defaults to "New Chat"
 *   model?: string; // Optional, defaults to "auto"
 * }
 * 
 * Response:
 * {
 *   id: string;
 *   title: string;
 *   model: string;
 *   createdAt: string;
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = params;

    // Verify user has access to project
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json();
    const { title = 'New Chat', model = 'auto' } = body;

    // Create new chat
    const [chat] = await db
      .insert(aiChats)
      .values({
        project_id: projectId,
        created_by: session.user.id,
        name: title,
        model_name: model,
      })
      .returning();

    return NextResponse.json(
      {
        id: chat.id,
        title: chat.name,
        model: chat.model_name || 'auto',
        createdAt: chat.created_at.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
