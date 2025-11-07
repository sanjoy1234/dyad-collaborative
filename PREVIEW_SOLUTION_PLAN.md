# 🎯 Preview Server Solution - Based on dyad-main Analysis

## Problem Analysis

### Current Issue
- dyad-collaborative uses `http-server` to serve raw source files
- React apps with JSX in separate files (src/App.js, src/index.js) show blank pages
- Browser receives empty HTML skeleton with no JavaScript bundle

### Root Cause
- Modern React/Vite apps require:
  1. **Dependency installation**: `npm install` or `pnpm install`
  2. **Development server**: `npm run dev` or `vite dev` (not static file server)
  3. **On-the-fly bundling**: Vite/Webpack transforms JSX and bundles modules in real-time

## dyad-main's Solution (WORKING)

### Architecture
```typescript
// From dyad-main/src/ipc/handlers/app_handlers.ts

const DEFAULT_COMMAND = 
  "(pnpm install && pnpm run dev --port 32100) || " +
  "(npm install --legacy-peer-deps && npm run dev -- --port 32100)";

async function executeApp({ appPath, appId }): Promise<void> {
  const command = getCommand({ installCommand, startCommand }) || DEFAULT_COMMAND;
  
  const spawnedProcess = spawn(command, [], {
    cwd: appPath,
    shell: true,
    stdio: 'pipe',
    detached: false,
  });
  
  // Listen to process stdout for URL
  spawnedProcess.stdout?.on('data', async (data) => {
    const message = data.toString();
    const urlMatch = message.match(/(https?:\/\/localhost:\d+\/?)/);
    if (urlMatch) {
      // Start proxy to handle CORS and embed in iframe
      proxyWorker = await startProxy(urlMatch[1], {
        onStarted: (proxyUrl) => {
          // Send proxyUrl to frontend
        }
      });
    }
  });
}
```

### Key Components

1. **Vite Template** (scaffold/):
   - `vite.config.ts`: Configures dev server on port 8080
   - `package.json`: Contains `"dev": "vite"` script
   - `index.html`: References `/src/main.tsx` via module script
   - `src/main.tsx`: Entry point that renders React app

2. **Process Management**:
   - Spawns actual `npm run dev` command
   - Captures stdout/stderr for logs and URL detection
   - Tracks process PID for lifecycle management
   - Handles process errors and cleanup

3. **Framework Detection**:
```typescript
// Check config files first
if (exists('vite.config.js') || exists('vite.config.ts')) return 'vite';
if (exists('next.config.js')) return 'next';

// Check package.json dependencies
const deps = { ...dependencies, ...devDependencies };
if (deps.vite) return 'vite';
if (deps.next) return 'next';
if (deps.react) return 'react';
```

4. **Port Management**:
   - Fixed port in vite.config.ts: `port: 8080`
   - Falls back to command line: `--port 32100`
   - Can pass port via start command

## Solution for dyad-collaborative

### Phase 1: Update AI Prompt to Generate Vite Projects (RECOMMENDED)

**Pros**:
- Matches dyad-main's proven architecture
- Vite is fast, modern, and production-ready
- Works with React, TypeScript, TailwindCSS out of the box
- Hot module replacement included
- No complex bundling logic needed

**Implementation**:

1. **Update AI prompt** to generate Vite structure:
```typescript
// src/lib/ai/prompt-engineer.ts

case 'react':
  return `## React + Vite Project Structure

Generate a modern React app using Vite:

### Required Files:

1. **package.json** - ALWAYS include:
\`\`\`json
{
  "name": "project",
  "type": "module",
  "scripts": {
    "dev": "vite --port 8080 --host 0.0.0.0",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^5.4.11"
  }
}
\`\`\`

2. **vite.config.js** - Required for Vite:
\`\`\`javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 8080
  }
})
\`\`\`

3. **index.html** - Entry point:
\`\`\`html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
\`\`\`

4. **src/main.jsx** - React entry:
\`\`\`javascript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
\`\`\`

5. **src/App.jsx** - Main component:
\`\`\`javascript
import { useState } from 'react'
import './App.css'

function App() {
  return (
    <div className="App">
      <h1>Hello World</h1>
    </div>
  )
}

export default App
\`\`\`

### File Operations:
- Use "create" operation for all files
- Include path: "package.json", "vite.config.js", "index.html", etc.
`;
```

2. **Update preview API** to run `npm run dev`:

```typescript
// src/app/api/projects/[projectId]/preview/start/route.ts

export async function POST(request, { params }) {
  // ... auth and validation ...
  
  const projectPath = `/app/projects/${projectId}`;
  const framework = await detectFramework(projectPath);
  const port = await findAvailablePort(8080, 8180); // Use 8080+ for dev servers
  
  let command = '';
  
  if (framework === 'vite') {
    // Install dependencies then run dev server
    command = `cd ${projectPath} && (pnpm install && pnpm run dev --port ${port}) || (npm install && npm run dev -- --port ${port})`;
  } else if (framework === 'next') {
    command = `cd ${projectPath} && npm install && npm run dev -- --port ${port}`;
  } else if (framework === 'static' || framework === 'react-cdn') {
    // For standalone HTML files, use http-server
    command = `cd ${projectPath} && npx http-server -p ${port} -a 0.0.0.0 --cors`;
  } else {
    // Try to detect package.json scripts
    const hasPackageJson = await fs.access(path.join(projectPath, 'package.json'))
      .then(() => true)
      .catch(() => false);
    
    if (hasPackageJson) {
      command = `cd ${projectPath} && npm install && npm run dev -- --port ${port}`;
    } else {
      command = `cd ${projectPath} && npx http-server -p ${port} -a 0.0.0.0 --cors`;
    }
  }
  
  console.log(`Starting preview: ${command}`);
  
  // Spawn the process
  const child = exec(command, {
    cwd: projectPath,
    shell: '/bin/sh',
  });
  
  const processId = child.pid;
  
  // Wait for server to start (up to 30 seconds)
  let serverReady = false;
  let attempts = 0;
  const maxAttempts = 60; // 30 seconds (500ms * 60)
  
  while (!serverReady && attempts < maxAttempts) {
    try {
      // Try to connect to the port
      const response = await fetch(`http://localhost:${port}`, {
        signal: AbortSignal.timeout(1000)
      }).catch(() => null);
      
      if (response) {
        serverReady = true;
        break;
      }
    } catch (error) {
      // Server not ready yet
    }
    
    // Check if process is still alive
    try {
      process.kill(processId, 0);
    } catch {
      // Process died
      throw new Error('Preview server process died during startup');
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    attempts++;
  }
  
  if (!serverReady) {
    // Kill the process
    try {
      process.kill(processId, 'SIGTERM');
    } catch {}
    throw new Error('Preview server failed to start within 30 seconds');
  }
  
  // Save to database
  const [server] = await db.insert(previewServers).values({
    project_id: projectId,
    port,
    status: 'running',
    process_id: processId,
    command,
    framework,
    started_at: new Date(),
    last_heartbeat: new Date(),
  }).returning();
  
  return NextResponse.json({
    server,
    url: `http://localhost:${port}`,
  });
}
```

3. **Update detectFramework**:
```typescript
async function detectFramework(projectPath: string): Promise<string> {
  // Check for config files (most reliable)
  const configFiles = [
    { file: 'vite.config.js', framework: 'vite' },
    { file: 'vite.config.ts', framework: 'vite' },
    { file: 'next.config.js', framework: 'next' },
    { file: 'next.config.mjs', framework: 'next' },
  ];
  
  for (const { file, framework } of configFiles) {
    const configPath = path.join(projectPath, file);
    if (await fs.access(configPath).then(() => true).catch(() => false)) {
      return framework;
    }
  }
  
  // Check package.json
  try {
    const pkgPath = path.join(projectPath, 'package.json');
    const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    if (deps.vite) return 'vite';
    if (deps.next) return 'next';
    if (deps.react && !deps.vite && !deps.next) return 'react'; // React without bundler
  } catch {
    // No package.json
  }
  
  // Check for standalone HTML
  try {
    const indexPath = path.join(projectPath, 'index.html');
    const html = await fs.readFile(indexPath, 'utf-8');
    
    // Check if it's a standalone HTML with CDN React
    if (html.includes('unpkg.com/react') || html.includes('cdn.jsdelivr.net')) {
      return 'react-cdn';
    }
    
    return 'static';
  } catch {
    return 'static';
  }
}
```

### Phase 2: Docker Configuration Updates

**Current docker-compose.yml** already has:
```yaml
ports:
  - "3000:3000"
  - "3100-3200:3100-3200"  # ✅ Already exposed

volumes:
  - project_files:/app/projects  # ✅ Already created
```

**Dockerfile** - Ensure Node.js packages are available:
```dockerfile
# Should already have Node.js from base image
# Verify pnpm is available:
RUN npm install -g pnpm

# Or ensure npm is available (should be by default)
```

### Phase 3: Testing Strategy

1. **Test Vite Project**:
```bash
# Create test project manually
docker exec dyad-collaborative-app-1 sh -c 'cd /app/projects && mkdir test-vite && cd test-vite && npm init -y'

# Add vite files
docker exec dyad-collaborative-app-1 sh -c 'cd /app/projects/test-vite && npm install vite @vitejs/plugin-react react react-dom'

# Create vite.config.js, index.html, src/main.jsx, src/App.jsx
# (Use the templates above)

# Start preview via API
curl -X POST http://localhost:3000/api/projects/{projectId}/preview/start \
  -H "Cookie: ..." \
  -H "Content-Type: application/json"

# Should return:
# { "server": {...}, "url": "http://localhost:8080" }

# Test in browser:
open http://localhost:8080
```

2. **Test AI Generation**:
```bash
# Use Dyad UI to ask AI: "Create a counter app with React"
# AI should generate:
# - package.json (with vite)
# - vite.config.js
# - index.html
# - src/main.jsx
# - src/App.jsx
# - src/index.css
# - src/App.css

# Click "Start Preview"
# Should show working React app with counter functionality
```

## Alternative: Hybrid Approach

Support BOTH Vite projects (for complex apps) AND standalone HTML (for simple demos):

```typescript
const framework = await detectFramework(projectPath);

if (framework === 'vite' || framework === 'next') {
  // Run full dev server
  command = `npm install && npm run dev -- --port ${port}`;
} else if (framework === 'react-cdn' || framework === 'static') {
  // Serve static files
  command = `npx http-server -p ${port} -a 0.0.0.0 --cors`;
} else {
  // Default: try dev server first, fall back to static
  command = `(npm install && npm run dev -- --port ${port}) || npx http-server -p ${port} -a 0.0.0.0 --cors`;
}
```

## Implementation Checklist

- [ ] Update AI prompt to generate Vite projects by default
- [ ] Update preview API to run `npm run dev` instead of `http-server`
- [ ] Update framework detection to check for vite.config.js
- [ ] Add server startup polling (wait for server to be ready)
- [ ] Update port range to 8080-8180 for dev servers
- [ ] Add fallback to http-server for standalone HTML
- [ ] Test with simple counter app
- [ ] Test with complex app (multiple components)
- [ ] Test with TypeScript
- [ ] Document new preview behavior
- [ ] Update user guide/README

## Expected Results

### Before Fix:
```
User: "Create a React counter app"
AI: Generates src/App.js, src/index.js, public/index.html
Preview: Blank page ❌ (empty HTML skeleton, no bundle)
```

### After Fix:
```
User: "Create a React counter app"
AI: Generates package.json (vite), vite.config.js, index.html, src/main.jsx, src/App.jsx
Preview API: Runs "npm install && npm run dev --port 8080"
Preview: Working counter app ✅ (Vite dev server bundles JSX on-the-fly)
```

## Migration Path for Existing Projects

For existing multi-file React projects (already generated):

1. **Option A**: Leave as-is, they won't have preview until regenerated
2. **Option B**: Add migration script to convert to Vite structure:
   - Create package.json with vite
   - Create vite.config.js
   - Move/rename index.js to main.jsx
   - Update imports
3. **Option C**: Support both approaches - detect if bundling is needed

**Recommendation**: Option A + clear messaging: "This project needs to be regenerated with the new preview-compatible structure."

## Next Steps

1. ✅ Study dyad-main (COMPLETE)
2. ⏳ Update AI prompt to generate Vite projects
3. ⏳ Implement new preview API with `npm run dev`
4. ⏳ Test with fresh Vite project
5. ⏳ Update documentation
6. ⏳ Test end-to-end workflow
7. ⏳ Deploy and validate

## Resources

- [Vite Documentation](https://vitejs.dev/)
- [Vite Getting Started](https://vitejs.dev/guide/)
- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react)
- dyad-main reference: `src/ipc/handlers/app_handlers.ts`
- dyad-main template: `scaffold/`
