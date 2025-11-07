import { redirect } from 'next/navigation';
import { getServerAuthSession } from '@/lib/auth-v4';
import { db } from '@/lib/db';
import { projects, projectCollaborators, projectFiles } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { DyadEditorClient } from '@/components/editor/DyadEditorClient';

interface EditorPageProps {
  params: {
    projectId: string;
  };
}

export default async function EditorPage({ params }: EditorPageProps) {
  const session = await getServerAuthSession();

  if (!session) {
    redirect('/auth/login');
  }

  // Verify user has access to this project
  const collaboration = await db
    .select()
    .from(projectCollaborators)
    .where(
      and(
        eq(projectCollaborators.project_id, params.projectId),
        eq(projectCollaborators.user_id, session.user.id)
      )
    )
    .limit(1);

  if (collaboration.length === 0) {
    redirect('/dashboard');
  }

  // Get project details
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, params.projectId))
    .limit(1);

  if (project.length === 0) {
    redirect('/dashboard');
  }

  // Get all project files
  const files = await db
    .select()
    .from(projectFiles)
    .where(eq(projectFiles.project_id, params.projectId))
    .orderBy(projectFiles.path);

  // Get all collaborators
  const collaborators = await db
    .select()
    .from(projectCollaborators)
    .where(eq(projectCollaborators.project_id, params.projectId));

  return (
    <DyadEditorClient
      project={project[0]}
      files={files}
      collaborators={collaborators}
      currentUser={session.user}
      userRole={collaboration[0].role}
    />
  );
}
