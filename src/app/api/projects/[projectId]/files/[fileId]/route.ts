import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v4';
import { db } from '@/lib/db';
import { projectFiles, projectCollaborators } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

interface RouteParams {
  params: {
    projectId: string;
    fileId: string;
  };
}

// GET /api/projects/[projectId]/files/[fileId]
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to project
    const hasAccess = await db
      .select()
      .from(projectCollaborators)
      .where(
        and(
          eq(projectCollaborators.project_id, params.projectId),
          eq(projectCollaborators.user_id, session.user.id)
        )
      )
      .limit(1);

    if (hasAccess.length === 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get file
    const [file] = await db
      .select()
      .from(projectFiles)
      .where(
        and(
          eq(projectFiles.id, params.fileId),
          eq(projectFiles.project_id, params.projectId)
        )
      )
      .limit(1);

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json(file);
  } catch (error) {
    console.error('Error fetching file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/projects/[projectId]/files/[fileId] - Update file content
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has write access
    const [collaborator] = await db
      .select()
      .from(projectCollaborators)
      .where(
        and(
          eq(projectCollaborators.project_id, params.projectId),
          eq(projectCollaborators.user_id, session.user.id)
        )
      )
      .limit(1);

    if (!collaborator || collaborator.role === 'viewer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { content } = body;

    if (content === undefined) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Update file
    const [updatedFile] = await db
      .update(projectFiles)
      .set({
        content,
        updated_at: new Date(),
        version: sql`${projectFiles.version} + 1`,
      })
      .where(
        and(
          eq(projectFiles.id, params.fileId),
          eq(projectFiles.project_id, params.projectId)
        )
      )
      .returning();

    if (!updatedFile) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json(updatedFile);
  } catch (error) {
    console.error('Error updating file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/projects/[projectId]/files/[fileId]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has write access
    const [collaborator] = await db
      .select()
      .from(projectCollaborators)
      .where(
        and(
          eq(projectCollaborators.project_id, params.projectId),
          eq(projectCollaborators.user_id, session.user.id)
        )
      )
      .limit(1);

    if (!collaborator || collaborator.role === 'viewer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete file
    await db
      .delete(projectFiles)
      .where(
        and(
          eq(projectFiles.id, params.fileId),
          eq(projectFiles.project_id, params.projectId)
        )
      );

    return NextResponse.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
