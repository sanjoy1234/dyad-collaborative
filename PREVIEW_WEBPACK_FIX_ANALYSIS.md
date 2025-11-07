# 🔧 Preview Server - Comprehensive Fix & Testing Plan

## Issue Analysis

After thorough investigation of the user's screenshots and project files, I've identified the core issues:

### 1. **Webpack Port Configuration Issue**
The test project has:
- `webpack.config.js` with hardcoded `port: 9000` in devServer config
- The `--port` CLI flag doesn't override this config file setting
- Webpack-dev-server prioritizes config file over CLI flags

### 2. **Framework Detection Issues**
- Webpack projects were not being detected (only checking for vite/next)
- Generic "react" detection wasn't specific enough
- No handling for Create React App, Parcel, or other bundlers

### 3. **Port Binding Issues**
- Code tries to allocate ports 8081-8099
- But webpack.config.js tries to bind to port 9000
- Mismatch causes server to start but on wrong port
- Preview iframe loads `localhost:8081` but server is on `localhost:9000`

## Root Cause

The preview server **does start successfully** but on the **wrong port**:
- Preview API allocates port 8081 (from pool)
- Webpack config has port 9000 hardcoded
- Server starts on port 9000
- Browser tries to access port 8081 → 404/Connection Refused
- Timeout after 2 minutes

## Complete Solution

### Fix 1: Detect Webpack Projects ✅

Added webpack config detection:
```typescript
const configFiles = [
  { file: 'vite.config.js', framework: 'vite' },
  { file: 'next.config.js', framework: 'next' },
  { file: 'webpack.config.js', framework: 'webpack' },  // NEW
  { file: 'webpack.config.ts', framework: 'webpack' },   // NEW
];
```

### Fix 2: Handle Webpack Commands ✅

Webpack-dev-server command structure:
```typescript
case 'webpack':
  return `(pnpm install && pnpm run start -- --port ${port} --host 0.0.0.0) || ` +
         `(npm install && npm run start -- --port ${port} --host 0.0.0.0)`;
```

**BUT**: This won't work if webpack.config.js has hardcoded port!

### Fix 3: Dynamic Port Injection (REQUIRED)

We need to modify the webpack config or override it at runtime:

**Option A: Environment Variable Override**
```javascript
// In webpack.config.js
const PORT = process.env.PORT || 9000;

module.exports = {
  devServer: {
    port: PORT,  // Use env variable
  }
};
```

**Option B: CLI Config Override**
```bash
webpack serve --mode development --port ${port} --host 0.0.0.0
```
This should work but depends on webpack-dev-server version.

**Option C: Modify Config at Runtime** (Most Reliable)
```typescript
// Before starting server, rewrite webpack.config.js
const configPath = path.join(projectPath, 'webpack.config.js');
let config = await fs.readFile(configPath, 'utf-8');
// Replace port: 9000 with port: ${port}
config = config.replace(/port:\s*\d+/g, `port: ${port}`);
await fs.writeFile(configPath, config);
```

### Fix 4: Handle All Build Tools

**Comprehensive build tool support**:
```typescript
async function detectFramework(projectPath: string): Promise<string> {
  const configFiles = [
    { file: 'vite.config.js', framework: 'vite' },
    { file: 'vite.config.ts', framework: 'vite' },
    { file: 'next.config.js', framework: 'next' },
    { file: 'webpack.config.js', framework: 'webpack' },
    { file: '.parcel-cache', framework: 'parcel' },  // Parcel
    { file: 'rollup.config.js', framework: 'rollup' },  // Rollup
  ];
  
  // Check if it's Create React App
  const pkgPath = path.join(projectPath, 'package.json');
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
  if (pkg.dependencies?.['react-scripts']) {
    return 'cra';  // Create React App
  }
  
  // ... rest of detection
}
```

## Implementation Status

### ✅ Completed:
1. Added webpack config file detection
2. Added webpack case in buildCommand
3. Proper command structure for webpack-dev-server

### ⏳ In Progress:
1. Docker rebuild with new code

### ❌ Still Needed:
1. Dynamic port injection for webpack
2. Test with actual webpack project
3. Handle Create React App (PORT env variable)
4. Handle other bundlers

## Testing Plan

### Test 1: Current Webpack Project

**Project**: test 8 (a20c2422-e32a-45c0-a811-d1eabc747166)
**Structure**:
```
webpack.config.js  (port: 9000 hardcoded)
package.json       (script: "start": "webpack serve --mode development")
src/index.js
public/index.html
```

**Test Steps**:
1. Start preview
2. Check logs:
   ```bash
   docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c \
     "SELECT port, command, logs FROM preview_servers WHERE project_id = 'a20c2422...' ORDER BY created_at DESC LIMIT 1;"
   ```
3. **Expected**: 
   - Command runs with `--port 8081`
   - But webpack binds to port 9000 (from config)
   - Server starts but on wrong port
   
4. **Fix Required**: 
   - Either modify webpack.config.js before starting
   - Or detect actual bound port from logs
   - Or use environment variable (PORT=8081)

### Test 2: Vite Project

**Prompt**: "Create a counter app with React and Vite"

**Expected Files**:
- package.json (vite scripts)
- vite.config.js
- index.html
- src/main.jsx
- src/App.jsx

**Expected Result**: ✅ Should work (vite respects --port flag)

### Test 3: Next.js Project

**Prompt**: "Create a Next.js app"

**Expected Result**: ✅ Should work (next respects --port flag)

### Test 4: Create React App

**Structure**:
- Uses react-scripts
- PORT environment variable controls port

**Command Should Be**:
```bash
PORT=8081 npm start
```

## Recommended Solution

### Immediate Fix (Robust):

```typescript
async function buildCommand(projectPath: string, framework: string, port: number): Promise<string> {
  switch (framework) {
    case 'webpack':
      // For webpack, we need to handle config file with hardcoded port
      // Option 1: Try environment variable (webpack 5+)
      // Option 2: Use CLI override (may not work with config file)
      // Option 3: Modify config file (most reliable)
      
      const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
      
      // Check if webpack config exists
      const configPath = path.join(projectPath, 'webpack.config.js');
      try {
        await fs.access(configPath);
        
        // Read and modify config to use environment variable
        let config = await fs.readFile(configPath, 'utf-8');
        
        // If config has hardcoded port, replace it
        if (/port:\s*\d+/.test(config)) {
          console.log('Found hardcoded port in webpack.config.js, replacing with env variable');
          config = config.replace(/port:\s*\d+/g, `port: process.env.PORT || ${port}`);
          await fs.writeFile(configPath, config);
        }
      } catch (error) {
        console.log('No webpack.config.js found or error reading it');
      }
      
      // Use PORT environment variable + CLI flag as fallback
      return `(pnpm install && PORT=${port} pnpm run start -- --port ${port} --host 0.0.0.0) || ` +
             `(npm install && PORT=${port} npm run start -- --port ${port} --host 0.0.0.0)`;
    
    case 'cra':
      // Create React App uses PORT environment variable
      return `(pnpm install && PORT=${port} pnpm start) || (npm install && PORT=${port} npm start)`;
    
    case 'vite':
    case 'next':
      return `(pnpm install && pnpm run dev -- --port ${port} --host 0.0.0.0) || ` +
             `(npm install && npm run dev -- --port ${port} --host 0.0.0.0)`;
    
    default:
      // Fallback
      return `npx http-server -p ${port} -a 0.0.0.0 --cors`;
  }
}
```

## Alternative: Use Config File Port

Instead of trying to force a port, **detect what port the server actually starts on**:

```typescript
async function waitForServer(port: number, timeoutSeconds: number, processId: number): Promise<number | null> {
  // Parse logs to find actual port
  // Webpack logs: "webpack 5.x.x compiled successfully in X ms"
  // And usually: "Project is running at http://localhost:9000/"
  
  let actualPort = port;  // Start with expected port
  
  // Listen to stdout for port messages
  child.stdout?.on('data', (data) => {
    const message = data.toString();
    
    // Try to extract actual port from log messages
    const portMatch = message.match(/localhost:(\d+)/);
    if (portMatch) {
      actualPort = parseInt(portMatch[1]);
      console.log(`Detected actual server port: ${actualPort}`);
    }
  });
  
  // Wait for server on ACTUAL port (not requested port)
  // ...
  
  return actualPort;  // Return the port it actually started on
}
```

Then update database with actual port and return correct URL.

## Action Items

1. ✅ Add webpack detection
2. ✅ Add webpack command handling
3. ⏳ Rebuild Docker container
4. ❌ **Add dynamic port injection or detection**
5. ❌ Test with webpack project (test 8)
6. ❌ Add CRA detection and handling
7. ❌ Test with various project types
8. ❌ Document all supported frameworks

## Supported Frameworks (Target)

| Framework | Detection | Command | Port Control | Status |
|-----------|-----------|---------|--------------|--------|
| Vite | vite.config.js | npm run dev --port | ✅ CLI flag | ✅ Working |
| Next.js | next.config.js | npm run dev -- --port | ✅ CLI flag | ✅ Working |
| Webpack | webpack.config.js | npm start -- --port | ⚠️ Config file | 🔧 Needs fix |
| CRA | react-scripts in deps | PORT=X npm start | ✅ Env variable | ❌ Not implemented |
| Parcel | .parcel-cache | parcel serve --port | ✅ CLI flag | ❌ Not implemented |
| Static | index.html | http-server -p | ✅ CLI flag | ✅ Working |

## Conclusion

The core issue is **port mismatch** between allocated port and actual bound port. Webpack projects with hardcoded ports in config files need special handling. The fix requires either:

1. **Modify config files** at runtime (most reliable)
2. **Detect actual port** from logs (flexible)
3. **Force CLI override** (doesn't always work)

Current implementation has webpack detection but not port handling, which is why the preview fails.

**Next Step**: Implement dynamic port injection for webpack configs.
