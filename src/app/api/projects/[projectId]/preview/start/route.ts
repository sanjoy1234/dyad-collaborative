import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth-v4';
import { db } from '@/lib/db';
import { previewServers, projects, projectCollaborators } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { exec, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Preview Server V2 - Based on dyad-main Architecture
 * 
 * This version runs actual dev servers (npm run dev, vite dev) instead of static file servers.
 * This is required for React/Vite apps that need JSX transformation and module bundling.
 */

/**
 * POST /api/projects/[projectId]/preview/start
 * Start a development server for the project
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
          process.kill(existing.process_id, 0);
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

    // Find available port (8081-8099 range for dev servers, skipping 8080 which is commonly used)
    const port = await findAvailablePort(8081, 8099);

    // Detect framework and build command
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
    
    // Build the command based on framework
    const command = await buildCommand(projectPath, framework, port);
    console.log(`Command: ${command}`);
    
    // Spawn the process
    const child: ChildProcess = exec(command, {
      cwd: projectPath,
      shell: '/bin/sh',
      env: {
        ...process.env,
        PORT: port.toString(),
        HOST: '0.0.0.0',
      }
    });

    const processId = child.pid;
    
    if (!processId) {
      throw new Error('Failed to spawn preview server process');
    }

    console.log(`Preview server process started with PID ${processId}`);

    // Capture logs
    let logs = '';
    child.stdout?.on('data', (data) => {
      const message = data.toString();
      logs += message;
      console.log(`[Preview ${projectId}] ${message}`);
    });

    child.stderr?.on('data', (data) => {
      const message = data.toString();
      logs += message;
      console.error(`[Preview ${projectId}] ${message}`);
    });

    // Handle process exit
    child.on('exit', async (code, signal) => {
      console.log(`Preview server ${projectId} exited with code ${code}, signal ${signal}`);
      try {
        await db
          .update(previewServers)
          .set({ 
            status: 'stopped', 
            stopped_at: new Date(),
            logs: logs.slice(-10000), // Keep last 10KB of logs
          })
          .where(eq(previewServers.project_id, projectId));
      } catch (error) {
        console.error('Failed to update server status on exit:', error);
      }
    });

    // Wait for server to be ready (up to 60 seconds for npm install + server start)
    const serverReady = await waitForServer(port, 120, processId);
    
    if (!serverReady) {
      // Kill the process
      try {
        process.kill(processId, 'SIGTERM');
      } catch (error) {
        console.error('Failed to kill process:', error);
      }
      
      return NextResponse.json(
        { 
          error: 'Preview server failed to start within 2 minutes', 
          logs: logs.slice(-2000),
          details: 'The server process may be stuck installing dependencies or compiling code. Check the logs for errors.'
        },
        { status: 500 }
      );
    }

    // Save to database
    const [server] = await db
      .insert(previewServers)
      .values({
        project_id: projectId,
        port,
        status: 'running',
        process_id: processId,
        command,
        framework,
        logs: logs.slice(-10000),
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
      { 
        error: 'Failed to start preview server', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
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

    // Kill the process and all its children
    if (server.process_id) {
      try {
        // Kill process group to kill all child processes
        process.kill(-server.process_id, 'SIGTERM');
        
        // Wait a bit, then force kill if still alive
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          process.kill(-server.process_id, 'SIGKILL');
        } catch {
          // Already dead
        }
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

    // Verify process is still alive
    if (server.process_id) {
      try {
        process.kill(server.process_id, 0);
      } catch {
        // Process is dead, update database
        await db
          .update(previewServers)
          .set({ status: 'stopped', stopped_at: new Date() })
          .where(eq(previewServers.id, server.id));
        return NextResponse.json({ status: 'stopped' });
      }
    }

    return NextResponse.json({
      status: 'running',
      port: server.port,
      url: `http://localhost:${server.port}`,
      framework: server.framework,
    });
  } catch (error) {
    console.error('Failed to get preview server status:', error);
    return NextResponse.json(
      { error: 'Failed to get preview server status' },
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

  throw new Error('No available ports in range');
}

async function detectFramework(projectPath: string): Promise<string> {
  // Check for config files (most reliable)
  const configFiles = [
    { file: 'vite.config.js', framework: 'vite' },
    { file: 'vite.config.ts', framework: 'vite' },
    { file: 'vite.config.mjs', framework: 'vite' },
    { file: 'next.config.js', framework: 'next' },
    { file: 'next.config.mjs', framework: 'next' },
    { file: 'next.config.ts', framework: 'next' },
    { file: 'webpack.config.js', framework: 'webpack' },
    { file: 'webpack.config.ts', framework: 'webpack' },
  ];
  
  for (const { file, framework} of configFiles) {
    try {
      await fs.access(path.join(projectPath, file));
      console.log(`Detected ${framework} from ${file}`);
      return framework;
    } catch {
      // File doesn't exist
    }
  }
  
  // Check package.json
  try {
    const pkgPath = path.join(projectPath, 'package.json');
    const pkgContent = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    if (deps.vite) {
      console.log('Detected vite from package.json dependencies');
      return 'vite';
    }
    if (deps.next) {
      console.log('Detected next from package.json dependencies');
      return 'next';
    }
    if (deps.webpack || deps['webpack-dev-server']) {
      console.log('Detected webpack from package.json dependencies');
      return 'webpack';
    }
    if (deps.react) {
      console.log('Detected react from package.json dependencies');
      return 'react';
    }
  } catch (error) {
    console.log('No package.json found or failed to parse');
  }
  
  // Check for standalone HTML with CDN React
  try {
    const indexPath = path.join(projectPath, 'index.html');
    const htmlContent = await fs.readFile(indexPath, 'utf-8');
    
    if (htmlContent.includes('unpkg.com') || htmlContent.includes('cdn.jsdelivr.net')) {
      console.log('Detected CDN-based HTML (standalone)');
      return 'static-cdn';
    }
    
    console.log('Detected static HTML');
    return 'static';
  } catch {
    // No index.html
  }
  
  // Check public/index.html
  try {
    await fs.access(path.join(projectPath, 'public', 'index.html'));
    console.log('Detected static files in public/');
    return 'static';
  } catch {
    // No public/index.html
  }
  
  console.log('Could not detect framework, defaulting to static');
  return 'static';
}

async function buildCommand(projectPath: string, framework: string, port: number): Promise<string> {
  // For auto-injected Vite projects: use npx to avoid npm install issues
  // npx will download and cache packages automatically
  // Use --force to ensure latest vite, and specify plugin inline to avoid config file dependency issues
  const VITE_NPX_COMMAND = `npx --yes vite@latest --port ${port} --host 0.0.0.0`;
  
  // For projects with existing package.json: try to install deps first
  const DEFAULT_INSTALL_AND_RUN = 
    `(pnpm install && pnpm run dev -- --port ${port} --host 0.0.0.0) || ` +
    `(npm install && npm run dev -- --port ${port} --host 0.0.0.0)`;

  switch (framework) {
    case 'vite':
      // Check if this is an auto-injected project (has vite in devDeps but minimal setup)
      try {
        const pkgPath = path.join(projectPath, 'package.json');
        const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
        
        // If scripts use npx, run directly without npm install
        if (pkg.scripts?.dev?.includes('npx')) {
          console.log('Detected npx-based vite project, running directly with npx vite');
          return VITE_NPX_COMMAND;
        }
        
        // Otherwise try to install deps first
        return DEFAULT_INSTALL_AND_RUN;
      } catch {
        // No package.json, use npx vite directly
        return VITE_NPX_COMMAND;
      }

    case 'next':
      // Next.js projects: npm install && npm run dev -- --port PORT
      return DEFAULT_INSTALL_AND_RUN;

    case 'webpack':
      // Webpack projects: Handle hardcoded ports in config files
      try {
        const pkgPath = path.join(projectPath, 'package.json');
        const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
        
        // Webpack-dev-server: Use PORT env variable + CLI flag
        // PORT env variable works with webpack-dev-server 4+
        // CLI --port flag is backup
        if (pkg.scripts?.start) {
          return `(pnpm install && PORT=${port} pnpm run start -- --port ${port} --host 0.0.0.0) || ` +
                 `(npm install && PORT=${port} npm run start -- --port ${port} --host 0.0.0.0)`;
        } else if (pkg.scripts?.dev) {
          return `(pnpm install && PORT=${port} pnpm run dev -- --port ${port} --host 0.0.0.0) || ` +
                 `(npm install && PORT=${port} npm run dev -- --port ${port} --host 0.0.0.0)`;
        } else {
          // Direct webpack-dev-server command
          return `(pnpm install && PORT=${port} pnpm exec webpack serve --mode development --port ${port} --host 0.0.0.0) || ` +
                 `(npm install && PORT=${port} npx webpack serve --mode development --port ${port} --host 0.0.0.0)`;
        }
      } catch {
        // Fallback to direct webpack-dev-server
        return `PORT=${port} npx webpack serve --mode development --port ${port} --host 0.0.0.0`;
      }

    case 'react':
      // React without build tool - check if package.json has dev script
      try {
        const pkgPath = path.join(projectPath, 'package.json');
        const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
        
        if (pkg.scripts?.dev) {
          // Has dev script, use it
          return DEFAULT_INSTALL_AND_RUN;
        } else if (pkg.scripts?.start) {
          // Has start script - try to pass port
          return `(pnpm install && pnpm run start -- --port ${port}) || (npm install && npm run start -- --port ${port})`;
        } else {
          // No dev script, use http-server
          return `npx http-server -p ${port} -a 0.0.0.0 --cors`;
        }
      } catch {
        // No package.json, use http-server
        return `npx http-server -p ${port} -a 0.0.0.0 --cors`;
      }

    case 'static-cdn':
    case 'static':
      // Static HTML files, use simple http-server
      return `npx http-server -p ${port} -a 0.0.0.0 --cors`;

    default:
      // Try to detect from package.json, fall back to http-server
      try {
        const pkgPath = path.join(projectPath, 'package.json');
        await fs.access(pkgPath);
        // Has package.json, try to run dev script
        return DEFAULT_INSTALL_AND_RUN;
      } catch {
        // No package.json, use http-server
        return `npx http-server -p ${port} -a 0.0.0.0 --cors`;
      }
  }
}

async function waitForServer(port: number, timeoutSeconds: number, processId: number): Promise<boolean> {
  const maxAttempts = timeoutSeconds * 2; // Check every 500ms
  let attempts = 0;

  console.log(`Waiting for server on port ${port} (max ${timeoutSeconds}s)...`);

  while (attempts < maxAttempts) {
    // Check if process is still alive
    try {
      process.kill(processId, 0);
    } catch {
      console.error(`Process ${processId} died during startup`);
      return false;
    }

    // Try to connect to the server
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000);

      const response = await fetch(`http://localhost:${port}`, {
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timeout);

      if (response) {
        console.log(`Server on port ${port} is ready after ${attempts * 0.5}s`);
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }

    await new Promise(resolve => setTimeout(resolve, 500));
    attempts++;

    // Log progress every 10 seconds
    if (attempts % 20 === 0) {
      console.log(`Still waiting for server on port ${port} (${attempts * 0.5}s elapsed)...`);
    }
  }

  console.error(`Server on port ${port} failed to start within ${timeoutSeconds}s`);
  return false;
}
