import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-v4';
import { db } from '@/lib/db';
import { previewServers, projects, projectCollaborators } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

/**
 * POST /api/projects/[projectId]/preview/start
 * Start a preview server for the project
 */
export async function POST(
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

    // Check if user is owner or collaborator with edit rights
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

    // Check if server is already running
    const [existing] = await db
      .select()
      .from(previewServers)
      .where(
        and(
          eq(previewServers.project_id, projectId),
          eq(previewServers.status, 'running')
        )
      )
      .limit(1);

    if (existing) {
      // Verify the process is actually running
      let processExists = false;
      if (existing.process_id) {
        try {
          process.kill(existing.process_id, 0); // Signal 0 just checks if process exists
          processExists = true;
        } catch (error) {
          // Process doesn't exist, mark as stopped
          await db
            .update(previewServers)
            .set({ status: 'stopped', stopped_at: new Date() })
            .where(eq(previewServers.id, existing.id));
        }
      }

      if (processExists) {
        return NextResponse.json({
          server: existing,
          url: `http://localhost:${existing.port}`,
        });
      }
    }

    // Find available port (3100-3200 range for preview servers)
    const port = await findAvailablePort(3100, 3200);

    // Detect framework and start appropriate server
    const projectPath = `/app/projects/${projectId}`;
    
    // Check if project directory exists
    try {
      await fs.access(projectPath);
    } catch (error) {
      console.error(`Project directory not found: ${projectPath}`);
      return NextResponse.json(
        { error: 'Project files not found. Please generate some files first.' },
        { status: 404 }
      );
    }
    
    const framework = await detectFramework(projectPath);
    console.log(`Starting preview server for project ${projectId}, framework: ${framework}, port: ${port}`);
    
    let command = '';
    let processId = 0;
    let serverLogs = '';
    let serverError = '';

    if (framework === 'react' || framework === 'next') {
      // For React/Next apps, we need to bundle the JavaScript
      // Check if there's a standalone HTML file we can serve
      let hasStandaloneHTML = false;
      try {
        const indexPath = path.join(projectPath, 'index.html');
        await fs.access(indexPath);
        hasStandaloneHTML = true;
        console.log('Found standalone index.html - will serve directly');
      } catch {
        // No standalone HTML, try public/index.html
        try {
          const publicIndexPath = path.join(projectPath, 'public', 'index.html');
          await fs.access(publicIndexPath);
          
          // Check if it has inline scripts or external bundle
          const htmlContent = await fs.readFile(publicIndexPath, 'utf-8');
          if (htmlContent.includes('<script') && htmlContent.includes('</script>')) {
            hasStandaloneHTML = true;
            console.log('Found public/index.html with inline scripts');
          } else {
            console.log('public/index.html exists but needs bundling - will attempt to create bundle');
            
            // Try to create a bundled version inline
            try {
              const appJsPath = path.join(projectPath, 'src', 'App.js');
              const indexJsPath = path.join(projectPath, 'src', 'index.js');
              
              if (await fs.access(appJsPath).then(() => true).catch(() => false)) {
                // Read the React components
                const appJs = await fs.readFile(appJsPath, 'utf-8');
                const indexJs = await fs.readFile(indexJsPath, 'utf-8');
                
                // Create a simple bundled HTML
                const bundledHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>React App Preview</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${appJs.replace(/^import .+;$/gm, '').replace(/^export default /gm, 'const App = ')}
    
    ${indexJs.replace(/^import .+;$/gm, '').replace(/ReactDOM.render/g, 'ReactDOM.createRoot(document.getElementById("root")).render')}
  </script>
</body>
</html>
`;
                await fs.writeFile(path.join(projectPath, 'preview.html'), bundledHTML);
                console.log('Created bundled preview.html');
              }
            } catch (bundleError) {
              console.error('Failed to create bundle:', bundleError);
            }
          }
        } catch {
          console.log('No HTML file found - will serve directory');
        }
      }
      
      // Bind to 0.0.0.0 so it's accessible from outside the container
      command = `cd ${projectPath} && npx http-server -p ${port} -a 0.0.0.0 --cors 2>&1`;
      
      // Start the server in background
      const child = exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Server error: ${error.message}`);
          serverError = error.message;
        }
        if (stdout) serverLogs += stdout;
        if (stderr) serverLogs += stderr;
      });
      
      processId = child.pid || 0;
      console.log(`Started http-server process ${processId} on port ${port}`);
      
      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify process is still running
      try {
        process.kill(processId, 0);
        console.log(`Process ${processId} is running`);
      } catch (error) {
        console.error(`Process ${processId} failed to start`);
        return NextResponse.json(
          { error: 'Failed to start preview server', details: serverError || 'Process died immediately' },
          { status: 500 }
        );
      }
    } else {
      // Default: serve static files
      // Bind to 0.0.0.0 so it's accessible from outside the container
      command = `cd ${projectPath} && npx http-server -p ${port} -a 0.0.0.0 --cors 2>&1`;
      const child = exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Server error: ${error.message}`);
          serverError = error.message;
        }
        if (stdout) serverLogs += stdout;
        if (stderr) serverLogs += stderr;
      });
      processId = child.pid || 0;
      console.log(`Started http-server process ${processId} on port ${port}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify process is still running
      try {
        process.kill(processId, 0);
      } catch (error) {
        console.error(`Process ${processId} failed to start`);
        return NextResponse.json(
          { error: 'Failed to start preview server', details: serverError || 'Process died immediately' },
          { status: 500 }
        );
      }
    }

    // Create server record
    const [server] = await db
      .insert(previewServers)
      .values({
        project_id: projectId,
        port,
        status: 'running',
        process_id: processId,
        command,
        framework,
        logs: serverLogs || 'Starting server...',
        error: serverError || null,
        started_at: new Date(),
        last_heartbeat: new Date(),
      })
      .returning();

    console.log(`Preview server started successfully for project ${projectId} on port ${port}`);

    return NextResponse.json({
      server,
      url: `http://localhost:${port}`,
    });
  } catch (error) {
    console.error('Failed to start preview server:', error);
    return NextResponse.json(
      { error: 'Failed to start preview server', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[projectId]/preview/start
 * Stop the preview server for the project
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = params;

    // Get running server
    const [server] = await db
      .select()
      .from(previewServers)
      .where(
        and(
          eq(previewServers.project_id, projectId),
          eq(previewServers.status, 'running')
        )
      )
      .limit(1);

    if (!server) {
      return NextResponse.json({ message: 'No running server found' });
    }

    // Kill the process
    if (server.process_id) {
      try {
        process.kill(server.process_id, 'SIGTERM');
      } catch (error) {
        console.error('Failed to kill process:', error);
      }
    }

    // Update database
    await db
      .update(previewServers)
      .set({
        status: 'stopped',
        stopped_at: new Date(),
      })
      .where(eq(previewServers.id, server.id));

    return NextResponse.json({ message: 'Preview server stopped' });
  } catch (error) {
    console.error('Failed to stop preview server:', error);
    return NextResponse.json(
      { error: 'Failed to stop preview server' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[projectId]/preview/start
 * Get preview server status
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

    const [server] = await db
      .select()
      .from(previewServers)
      .where(
        and(
          eq(previewServers.project_id, projectId),
          eq(previewServers.status, 'running')
        )
      )
      .limit(1);

    if (!server) {
      return NextResponse.json({ status: 'stopped' });
    }

    return NextResponse.json({
      status: 'running',
      port: server.port,
      url: `http://localhost:${server.port}`,
      framework: server.framework,
    });
  } catch (error) {
    console.error('Failed to get preview status:', error);
    return NextResponse.json(
      { error: 'Failed to get preview status' },
      { status: 500 }
    );
  }
}

// Helper functions
async function findAvailablePort(start: number, end: number): Promise<number> {
  const usedPorts = await db
    .select({ port: previewServers.port })
    .from(previewServers)
    .where(eq(previewServers.status, 'running'));

  const usedPortNumbers = new Set(usedPorts.map(p => p.port));

  for (let port = start; port <= end; port++) {
    if (!usedPortNumbers.has(port)) {
      return port;
    }
  }

  throw new Error('No available ports');
}

async function detectFramework(projectPath: string): Promise<string> {
  try {
    // Check for package.json
    const packageJsonPath = path.join(projectPath, 'package.json');
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      if (packageJson.dependencies) {
        if (packageJson.dependencies['next']) return 'next';
        if (packageJson.dependencies['react']) return 'react';
        if (packageJson.dependencies['vue']) return 'vue';
        if (packageJson.dependencies['@angular/core']) return 'angular';
      }
    } catch {
      // No package.json
    }

    // Check for index.html (static site)
    try {
      await fs.access(path.join(projectPath, 'index.html'));
      return 'static';
    } catch {
      // No index.html
    }

    // Check for public/index.html (React)
    try {
      await fs.access(path.join(projectPath, 'public', 'index.html'));
      return 'react';
    } catch {
      // No public/index.html
    }

    return 'static';
  } catch (error) {
    console.error('Error detecting framework:', error);
    return 'static';
  }
}
