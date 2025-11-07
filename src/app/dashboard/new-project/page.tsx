import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v4';
import { NewProjectClient } from './new-project-client';

export default async function NewProjectPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/auth/login');
  }

  return <NewProjectClient user={session.user} />;
}
