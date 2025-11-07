'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, FolderPlus, GitBranch } from 'lucide-react';

interface NewProjectClientProps {
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
  };
}

export function NewProjectClient({ user }: NewProjectClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Empty project form
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  
  // GitHub import form
  const [githubUrl, setGithubUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');

  const handleCreateEmptyProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectName.trim()) {
      toast({
        title: 'Error',
        description: 'Project name is required',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          description: projectDescription,
          type: 'empty',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || 'Failed to create project');
      }

      const project = await response.json();
      
      toast({
        title: 'Project created',
        description: `${projectName} has been created successfully.`,
      });

      // Redirect to the editor
      router.push(`/editor/${project.id}`);
    } catch (error) {
      toast({
        title: 'Error creating project',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImportFromGitHub = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!githubUrl.trim()) {
      toast({
        title: 'Error',
        description: 'GitHub repository URL is required',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/projects/import-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubUrl,
          githubToken: githubToken || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || 'Failed to import from GitHub');
      }

      const project = await response.json();
      
      toast({
        title: 'Project imported',
        description: `Successfully imported from GitHub.`,
      });

      // Redirect to the editor
      router.push(`/editor/${project.id}`);
    } catch (error) {
      toast({
        title: 'Error importing project',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Create New Project</h1>
          <p className="text-muted-foreground">
            Start a new project from scratch or import from GitHub
          </p>
        </div>

        <Tabs defaultValue="empty" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="empty">
              <FolderPlus className="h-4 w-4 mr-2" />
              Empty Project
            </TabsTrigger>
            <TabsTrigger value="github">
              <GitBranch className="h-4 w-4 mr-2" />
              Import from GitHub
            </TabsTrigger>
          </TabsList>

          <TabsContent value="empty">
            <Card>
              <CardHeader>
                <CardTitle>Create Empty Project</CardTitle>
                <CardDescription>
                  Start with a blank canvas and add files as you go
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateEmptyProject} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Project Name *</Label>
                    <Input
                      id="name"
                      placeholder="My Awesome Project"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe your project..."
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      rows={4}
                    />
                  </div>

                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? 'Creating...' : 'Create Project'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="github">
            <Card>
              <CardHeader>
                <CardTitle>Import from GitHub</CardTitle>
                <CardDescription>
                  Clone a repository from GitHub and start collaborating
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleImportFromGitHub} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="github-url">GitHub Repository URL *</Label>
                    <Input
                      id="github-url"
                      placeholder="https://github.com/username/repository"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Supports both HTTPS and SSH URLs
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="github-token">
                      GitHub Personal Access Token (Optional)
                    </Label>
                    <Input
                      id="github-token"
                      type="password"
                      placeholder="ghp_..."
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Required for private repositories. Create one at{' '}
                      <a
                        href="https://github.com/settings/tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        github.com/settings/tokens
                      </a>
                    </p>
                  </div>

                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? 'Importing...' : 'Import from GitHub'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
