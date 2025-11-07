import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v4';
import { DashboardClient } from './dashboard-client';
import { db } from '@/lib/db';
import { projects, projectCollaborators } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/login');
  }

  // Fetch user's projects
  const userProjects = await db
    .select()
    .from(projects)
    .leftJoin(projectCollaborators, eq(projects.id, projectCollaborators.project_id))
    .where(eq(projectCollaborators.user_id, session.user.id));

  return <DashboardClient projects={userProjects.map((p) => p.projects)} user={session.user} />;
}
