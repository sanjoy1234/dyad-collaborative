# 🎯 Preview V2 Testing Guide - Vite Development Server

## What Changed?

### Before (V1 - Broken):
- Used `http-server` to serve raw source files
- React apps showed blank pages (no JSX transformation or bundling)
- Files like `src/App.js`, `src/index.js` served as plain text
- Browser received empty HTML skeleton

### After (V2 - Fixed):
- Runs actual development servers: `npm run dev`, `vite dev`
- Vite transforms JSX and bundles modules on-the-fly
- Complete React apps with full functionality
- Based on dyad-main's proven architecture

## Architecture Overview

```
User Request
    ↓
AI Generates Vite Project
    ├── package.json (with vite scripts)
    ├── vite.config.js (dev server config)
    ├── index.html (entry point)
    └── src/
        ├── main.jsx (React entry)
        ├── App.jsx (main component)
        ├── index.css
        └── App.css
    ↓
Preview API
    ├── Detects framework: vite.config.js exists → "vite"
    ├── Builds command: "npm install && npm run dev --port 8080"
    ├── Spawns process: exec(command)
    ├── Waits for server: polls http://localhost:8080
    └── Returns URL: http://localhost:8080
    ↓
Vite Dev Server
    ├── Installs dependencies (react, react-dom, vite)
    ├── Starts development server on port 8080
    ├── Transforms JSX to JavaScript on-the-fly
    ├── Hot Module Replacement (HMR)
    └── Serves bundled React app
    ↓
Browser/iframe
    └── Shows working React application ✅
```

## Test Scenarios

### Test 1: Simple Counter App (Vite + React)

**Goal**: Verify AI generates Vite project and preview works

**Steps**:
1. Open dyad-collaborative: http://localhost:3000
2. Login with test account
3. Create new project or open existing
4. Ask AI: "Create a simple counter app with React"
5. Wait for AI to generate files (should see progress)
6. Click "Approve" to apply changes
7. Verify files appear in sidebar:
   ```
   ✅ package.json
   ✅ vite.config.js
   ✅ index.html
   ✅ src/main.jsx
   ✅ src/App.jsx
   ✅ src/index.css
   ✅ src/App.css
   ```

**Test Preview**:
1. Click "Start Preview" button (top right)
2. Should see toast: "Starting preview..." 
3. Wait up to 2 minutes (npm install + vite start)
4. Should see toast: "Preview Started - Server running on port 8080"
5. Click "Preview" tab in center panel
6. **Expected Result**: 
   - Iframe shows working counter app
   - Counter displays current count (initially 0)
   - "Increment" button increases count
   - "Decrement" button decreases count
   - "Reset" button sets count to 0
   - Styling is applied correctly

**Verify in Database**:
```bash
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "
SELECT project_id, port, status, framework, command, started_at 
FROM preview_servers 
WHERE status='running' 
ORDER BY started_at DESC 
LIMIT 1;"
```

Should show:
- `port`: 8080-8180 range
- `status`: running
- `framework`: vite
- `command`: Contains "npm install && npm run dev"

**Verify Process Running**:
```bash
docker exec dyad-collaborative-app-1 ps aux | grep vite
```

Should show Vite dev server process

**Test Direct Access**:
```bash
curl -s http://localhost:8080 | head -20
```

Should return full HTML with:
- `<script type="module" src="/src/main.jsx"></script>`
- `<div id="root"></div>`

**Test Vite Dev Server**:
```bash
curl -s http://localhost:8080/src/main.jsx | head -10
```

Should return transformed JavaScript (Vite processes the JSX)

### Test 2: Todo List App (Complex)

**Goal**: Verify Vite handles multiple components, state management, and CSS

**Prompt**: "Create a todo list app with React. Users should be able to add, delete, and mark todos as complete."

**Expected Files**:
```
package.json
vite.config.js
index.html
src/
  main.jsx
  App.jsx
  components/
    TodoList.jsx
    TodoItem.jsx
    AddTodo.jsx
  index.css
  App.css
```

**Test**:
1. Generate project with AI
2. Approve changes
3. Start preview
4. Verify in preview:
   - Can add new todos
   - Can check/uncheck todos
   - Can delete todos
   - Styling works correctly
   - State persists during interaction

### Test 3: TypeScript React App

**Prompt**: "Create a weather app with React and TypeScript"

**Expected Files**:
```
package.json (includes @types/react)
vite.config.ts
tsconfig.json
index.html
src/
  main.tsx (not .jsx!)
  App.tsx
  types/
    weather.ts
```

**Test**:
1. Generate with TypeScript
2. Verify Vite compiles TypeScript correctly
3. Preview shows working app

### Test 4: Next.js App (If Supported)

**Prompt**: "Create a Next.js app with a home page and about page"

**Expected Framework**: next

**Command**: `npm install && npm run dev -- --port 8080`

**Test**: Verify Next.js dev server starts and pages render

### Test 5: Static HTML (Fallback)

**Prompt**: "Create a simple HTML page with CSS and vanilla JavaScript"

**Expected**:
- No package.json
- Just index.html, style.css, script.js

**Command**: `npx http-server -p 8080 -a 0.0.0.0 --cors`

**Test**: Verify static files are served correctly

### Test 6: Existing Multi-File React Project (Migration)

**Scenario**: Project generated before V2 (has src/App.js, src/index.js, public/index.html)

**Expected Behavior**:
- Framework detected as "react" (no vite.config.js)
- Preview fails or uses http-server
- **Show clear error**: "This project was created with an older version. Please regenerate it for preview support."

**Alternative**: Add migration guide to convert to Vite structure

### Test 7: Server Startup Timeout

**Test**: Simulate slow server startup

**Expected**:
- Wait up to 2 minutes
- Show progress in logs
- If timeout: Clear error message
- Kill process cleanly
- Database marked as 'stopped'

### Test 8: Stop Preview

**Test**:
1. Start preview (counter app)
2. Wait for it to fully load
3. Click "Stop Preview"
4. Verify:
   - Toast: "Preview Stopped"
   - Preview iframe shows placeholder
   - Process killed (check with `ps aux | grep vite`)
   - Database status = 'stopped'
   - Port released (can start another preview)

### Test 9: Multiple Projects

**Test**:
1. Create 3 projects
2. Generate Vite apps in each
3. Start previews for all 3
4. Verify:
   - Each gets unique port (8080, 8081, 8082)
   - All run simultaneously
   - No port conflicts
   - Each preview shows correct app

### Test 10: Error Handling

**Test A**: Missing Files
- Delete package.json from project
- Try to start preview
- Expected: Clear error message

**Test B**: Port Exhaustion
- Start 101 previews (8080-8180)
- Try to start 102nd
- Expected: "No available ports" error

**Test C**: Process Crash
- Start preview
- Kill process manually: `docker exec dyad-collaborative-app-1 pkill -f vite`
- Check status via API
- Expected: Database updated to 'stopped'

## Verification Commands

### Check All Running Previews
```bash
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "
SELECT 
  p.name as project,
  ps.port,
  ps.status,
  ps.framework,
  ps.started_at,
  EXTRACT(EPOCH FROM (NOW() - ps.started_at)) as uptime_seconds
FROM preview_servers ps
JOIN projects p ON p.id = ps.project_id
WHERE ps.status = 'running'
ORDER BY ps.started_at DESC;"
```

### Check Processes in Container
```bash
docker exec dyad-collaborative-app-1 ps aux | grep -E 'vite|node|npm' | grep -v grep
```

### View Server Logs
```bash
docker logs dyad-collaborative-app-1 --tail 100 | grep -i preview
```

### Test Port Availability
```bash
# Should connect successfully for running previews
for port in $(seq 8080 8090); do
  echo -n "Port $port: "
  curl -s -o /dev/null -w "%{http_code}" http://localhost:$port || echo "Not responding"
done
```

### Check File Structure
```bash
# List all project directories
docker exec dyad-collaborative-app-1 find /app/projects -maxdepth 2 -type d | sort

# Check specific project
docker exec dyad-collaborative-app-1 ls -la /app/projects/{PROJECT_ID}/

# Verify Vite config exists
docker exec dyad-collaborative-app-1 cat /app/projects/{PROJECT_ID}/vite.config.js
```

## Performance Benchmarks

### Expected Timings:
- **File Generation**: 10-30 seconds (AI)
- **Dependency Install**: 20-60 seconds (npm install)
- **Server Start**: 5-15 seconds (Vite)
- **Total Preview Time**: 30-90 seconds from "Start Preview" click

### Resource Usage:
- **Memory per Preview**: 100-300MB
- **CPU**: Moderate during install/compile, low during idle
- **Disk**: ~50-100MB per project (node_modules)

## Troubleshooting Guide

### Issue: Preview Shows Blank Page

**Cause**: Old React project (pre-V2) without Vite

**Check**:
```bash
# Does project have vite.config.js?
docker exec dyad-collaborative-app-1 ls /app/projects/{PROJECT_ID}/vite.config.js
```

**Solution**: Regenerate project with AI (will use new Vite template)

### Issue: "No available ports"

**Cause**: All ports 8080-8180 in use (101 previews running)

**Check**:
```bash
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "
SELECT COUNT(*) FROM preview_servers WHERE status='running';"
```

**Solution**: Stop unused previews or increase port range

### Issue: "Server failed to start within 2 minutes"

**Cause**: 
- Slow npm install (large dependencies)
- Compilation errors
- Port already in use

**Check Logs**:
```bash
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "
SELECT logs, error FROM preview_servers WHERE project_id = '{PROJECT_ID}' ORDER BY created_at DESC LIMIT 1;"
```

**Solution**: 
- Check project files for errors
- Verify package.json is valid
- Try regenerating

### Issue: Preview Works But Hot Reload Doesn't

**Expected**: This is normal - we don't watch file changes from dyad-collaborative UI

**Explanation**: Vite dev server runs in isolation. To get HMR, user would need to edit files directly in the container or use a proper IDE integration.

### Issue: Process Zombie / Won't Stop

**Check**:
```bash
docker exec dyad-collaborative-app-1 ps aux | grep {PROCESS_ID}
```

**Solution**:
```bash
# Force kill process group
docker exec dyad-collaborative-app-1 kill -9 -{PROCESS_ID}

# Or restart container
docker restart dyad-collaborative-app-1
```

## Success Criteria

### MVP (Minimum Viable Product):
- ✅ AI generates Vite project with correct structure
- ✅ Preview starts Vite dev server successfully
- ✅ React app displays and is interactive
- ✅ Start/Stop preview works reliably
- ✅ Multiple projects can have simultaneous previews

### Full Success:
- ✅ All MVP criteria
- ✅ Works with TypeScript
- ✅ Handles complex multi-component apps
- ✅ Clear error messages on failures
- ✅ Performance: Preview starts within 2 minutes
- ✅ Stable: No crashes, memory leaks, or zombie processes
- ✅ Documentation: Clear user guide and troubleshooting

## Next Steps After Successful Testing

1. **Documentation**:
   - Update user guide with preview instructions
   - Add "How Preview Works" section
   - Include troubleshooting guide

2. **UI Improvements**:
   - Show preview server status (Starting → Installing → Compiling → Ready)
   - Display server logs in UI
   - Add progress indicator for long startups
   - Show which port is being used

3. **Optimizations**:
   - Cache node_modules between previews
   - Pre-install common dependencies
   - Use pnpm for faster installs
   - Implement preview warm-up (keep server running)

4. **Advanced Features**:
   - Hot reload integration
   - File watching (auto-restart on changes)
   - Environment variables support
   - Custom domains/subdomains
   - HTTPS support
   - Screenshot/thumbnail generation

## Migration Guide for Existing Projects

If you have projects created before V2:

### Option A: Regenerate (Recommended)
1. Open project
2. Ask AI: "Regenerate this project with Vite support"
3. Review changes
4. Approve
5. Start preview - should now work!

### Option B: Manual Conversion
1. Create `vite.config.js`
2. Update `package.json` (add vite, @vitejs/plugin-react)
3. Move index.html to root
4. Rename src/index.js → src/main.jsx
5. Update imports in main.jsx
6. Run `npm install` manually (via terminal)

### Option C: Keep As-Is
- Leave project unchanged
- Preview won't work
- Can still edit code, just no live preview
- Or download and run locally

## Comparison: V1 vs V2

| Feature | V1 (http-server) | V2 (Vite Dev Server) |
|---------|------------------|----------------------|
| React Support | ❌ Blank pages | ✅ Full support |
| JSX Transform | ❌ No | ✅ Yes (Vite) |
| Hot Reload | ❌ No | ✅ Yes (HMR) |
| TypeScript | ❌ No | ✅ Yes |
| Build Time | ⚡ Instant (0s) | 🐌 Slow (30-90s) |
| Resource Usage | 💚 Low (10MB) | 💛 Medium (200MB) |
| Complexity | 💚 Simple | 💛 Complex |
| Production Ready | ❌ No | ✅ Yes (with build) |

## Conclusion

Preview V2 implements a proper development server approach, matching dyad-main's proven architecture. While slower to start (due to npm install), it provides a **fully functional React development environment** instead of broken blank pages.

**Trade-off**: We trade instant preview (V1) for working preview (V2). This is acceptable because non-working preview is useless anyway.

**Future**: We can optimize startup time with caching, pre-installed dependencies, and smarter build strategies.
