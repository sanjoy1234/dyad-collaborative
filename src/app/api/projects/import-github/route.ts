import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-v4';
import { db } from '@/lib/db';
import { projects, projectCollaborators, projectFiles } from '@/lib/db/schema';

interface GitHubFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url?: string;
  url?: string;
}

// Helper function to extract owner and repo from GitHub URL
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/]+?)(\.git)?$/,
    /github\.com\/([^\/]+)\/([^\/]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { owner: match[1], repo: match[2].replace('.git', '') };
    }
  }

  return null;
}

// Helper function to fetch files recursively from GitHub
async function fetchGitHubFiles(
  owner: string,
  repo: string,
  path: string = '',
  token?: string
): Promise<{ path: string; content: string; name: string }[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const items: GitHubFile[] = await response.json();
  const files: { path: string; content: string; name: string }[] = [];

  // Limit to prevent huge repositories from overwhelming the system
  const MAX_FILES = 100;
  const fileExtensions = [
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.rb', '.go', '.rs',
    '.html', '.css', '.scss', '.json', '.md', '.txt', '.yml', '.yaml',
    '.toml', '.xml', '.sql', '.sh', '.bash', '.env', '.gitignore'
  ];

  for (const item of items) {
    if (files.length >= MAX_FILES) {
      console.warn(`Reached maximum file limit of ${MAX_FILES}`);
      break;
    }

    if (item.type === 'file') {
      // Filter by extension
      const hasValidExtension = fileExtensions.some(ext => item.name.endsWith(ext));
      if (!hasValidExtension) continue;

      // Download file content
      if (item.download_url) {
        try {
          const contentResponse = await fetch(item.download_url, { headers });
          if (contentResponse.ok) {
            const content = await contentResponse.text();
            files.push({
              path: '/' + item.path,
              name: item.name,
              content: content.length > 100000 ? content.substring(0, 100000) + '\n\n// File truncated...' : content,
            });
          }
        } catch (error) {
          console.error(`Failed to fetch ${item.path}:`, error);
        }
      }
    } else if (item.type === 'dir') {
      // Skip common directories to avoid bloat
      const skipDirs = ['node_modules', '.git', 'dist', 'build', '__pycache__', '.next', 'target', 'vendor'];
      if (skipDirs.includes(item.name)) continue;

      // Recursively fetch subdirectory
      try {
        const subFiles = await fetchGitHubFiles(owner, repo, item.path, token);
        files.push(...subFiles);
      } catch (error) {
        console.error(`Failed to fetch directory ${item.path}:`, error);
      }
    }
  }

  return files;
}

// Helper function to detect language from filename
function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
    toml: 'toml',
    xml: 'xml',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
  };
  return langMap[ext || ''] || 'text';
}

// POST /api/projects/import-github
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { githubUrl, githubToken } = body;

    if (!githubUrl) {
      return NextResponse.json({ error: 'GitHub URL is required' }, { status: 400 });
    }

    // Parse GitHub URL
    const parsed = parseGitHubUrl(githubUrl);
    if (!parsed) {
      return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 });
    }

    const { owner, repo } = parsed;

    // Fetch repository info
    const repoInfoHeaders: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };
    if (githubToken) {
      repoInfoHeaders.Authorization = `Bearer ${githubToken}`;
    }

    const repoInfoResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers: repoInfoHeaders }
    );

    if (!repoInfoResponse.ok) {
      if (repoInfoResponse.status === 404) {
        return NextResponse.json({ error: 'Repository not found. For private repos, provide a GitHub token.' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to fetch repository information' }, { status: 500 });
    }

    const repoInfo = await repoInfoResponse.json();

    // Create project
    const [project] = await db
      .insert(projects)
      .values({
        name: repoInfo.name || repo,
        description: repoInfo.description || `Imported from GitHub: ${owner}/${repo}`,
        owner_id: session.user.id,
        settings: {
          language: repoInfo.language?.toLowerCase() || 'javascript',
          githubUrl: repoInfo.html_url,
          importedAt: new Date().toISOString(),
        },
      })
      .returning();

    // Add creator as owner collaborator
    await db.insert(projectCollaborators).values({
      project_id: project.id,
      user_id: session.user.id,
      role: 'owner',
      invited_by: session.user.id,
    });

    // Fetch files from GitHub
    console.log(`Fetching files from ${owner}/${repo}...`);
    const files = await fetchGitHubFiles(owner, repo, '', githubToken);
    console.log(`Found ${files.length} files`);

    // Insert files into database
    if (files.length > 0) {
      const fileInserts = files.map((file) => ({
        project_id: project.id,
        path: file.path,
        content: file.content,
        file_type: detectLanguage(file.name),
      }));

      await db.insert(projectFiles).values(fileInserts);
    }

    // Add a README if none exists
    const hasReadme = files.some(f => f.name.toLowerCase() === 'readme.md');
    if (!hasReadme) {
      await db.insert(projectFiles).values({
        project_id: project.id,
        path: '/README.md',
        content: `# ${repoInfo.name}\n\n${repoInfo.description || 'Imported from GitHub'}\n\n**Original Repository:** [${owner}/${repo}](${repoInfo.html_url})\n`,
        file_type: 'markdown',
      });
    }

    return NextResponse.json({
      ...project,
      fileCount: files.length,
    }, { status: 201 });
  } catch (error) {
    console.error('Error importing from GitHub:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 });
  }
}
