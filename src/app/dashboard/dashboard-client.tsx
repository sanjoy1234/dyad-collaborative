'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Project } from '@/types';
import { formatRelativeTime } from '@/lib/utils';

interface DashboardClientProps {
  projects: (Project | null)[];
  user: {
    name?: string | null;
    email?: string | null;
  };
}

export function DashboardClient({ projects, user }: DashboardClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    await signOut({ callbackUrl: '/auth/login' });
  };

  const handleProjectClick = (projectId: string) => {
    router.push(`/editor/${projectId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Dyad Collaborative</h1>
            <p className="text-sm text-muted-foreground">Welcome, {user.name || user.email}</p>
          </div>
          <Button onClick={handleSignOut} variant="outline" disabled={loading}>
            {loading ? 'Signing out...' : 'Sign Out'}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold mb-2">Your Projects</h2>
            <p className="text-muted-foreground">Collaborate with your team in real-time</p>
          </div>
          <Button onClick={() => router.push('/dashboard/new-project')}>
            + New Project
          </Button>
        </div>

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No projects yet</p>
              <Button onClick={() => router.push('/dashboard/new-project')}>
                Create Your First Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              if (!project) return null;
              return (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleProjectClick(project.id)}
                >
                  <CardHeader>
                    <CardTitle>{project.name}</CardTitle>
                    <CardDescription>
                      {project.description || 'No description'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      <p>Updated {formatRelativeTime(project.updated_at)}</p>
                      <p className="mt-1">
                        {(project.settings as any)?.language || 'Multi-language'} project
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Quick Info */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Real-time Collaboration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Edit code simultaneously with your team members. See cursors and changes in real-time.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Version History</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Every change is tracked. Browse version history and restore previous versions anytime.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AI-Powered</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Built on Dyad's AI app builder. Generate components and code with intelligent assistance.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
