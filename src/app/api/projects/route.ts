import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v4';
import { db } from '@/lib/db';
import { projects, projectCollaborators, projectFiles } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/projects - List all projects for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userProjects = await db
      .select()
      .from(projects)
      .leftJoin(projectCollaborators, eq(projects.id, projectCollaborators.project_id))
      .where(eq(projectCollaborators.user_id, session.user.id));

    return NextResponse.json(userProjects.map((p) => p.projects));
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/projects - Create new project
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, type } = body;

    if (!name) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    // Create the project
    const [project] = await db
      .insert(projects)
      .values({
        name,
        description: description || null,
        owner_id: session.user.id,
        settings: { language: 'javascript', theme: 'dark' },
      })
      .returning();

    // Add creator as owner collaborator
    await db.insert(projectCollaborators).values({
      project_id: project.id,
      user_id: session.user.id,
      role: 'owner',
      invited_by: session.user.id,
    });

    // If empty project, create some default files
    if (type === 'empty') {
      await db.insert(projectFiles).values([
        {
          project_id: project.id,
          path: '/README.md',
          content: `# ${name}\n\n${description || 'A new collaborative project'}\n\n## Getting Started\n\nStart editing files in the editor!`,
          file_type: 'markdown',
        },
        {
          project_id: project.id,
          path: '/index.js',
          content: `// Welcome to ${name}!\n\nconsole.log('Hello, World!');\n`,
          file_type: 'javascript',
        },
      ]);
    }

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
