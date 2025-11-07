import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-v4';
import { db } from '@/lib/db';
import { projectFiles, projectCollaborators, projects } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/projects/[projectId]/files
 * Get all files for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerAuthSession();
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

    // Check if user is owner or collaborator
    const isOwner = project.owner_id === session.user.id;
    const [collaboration] = await db
      .select()
      .from(projectCollaborators)
      .where(
        and(
          eq(projectCollaborators.project_id, projectId),
          eq(projectCollaborators.user_id, session.user.id)
        )
      )
      .limit(1);

    if (!isOwner && !collaboration) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch all files for the project
    const files = await db
      .select()
      .from(projectFiles)
      .where(eq(projectFiles.project_id, projectId))
      .orderBy(projectFiles.path);

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Failed to fetch project files:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
