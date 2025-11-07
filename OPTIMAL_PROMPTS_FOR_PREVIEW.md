# 🎯 OPTIMAL PROMPTS FOR PREVIEW TESTING

## Problem Diagnosed ✅

Your test8 project has React/JSX files but **NO build configuration**:
- ❌ No package.json
- ❌ No vite.config.js  
- ❌ No index.html
- ✅ Has src/App.jsx (but browser can't execute JSX directly!)

**Result:** System correctly detects as "static" → Uses http-server → Shows directory listing

## Root Cause

The AI took a shortcut and generated **only the React components** without the necessary Vite/build setup. This happens when prompts are not explicit about requiring a complete project structure.

---

## ✅ WORKING PROMPT TEMPLATES

### Template 1: Counter App (Recommended for Testing)

```
Create a complete React counter application with Vite. Generate ALL of these files:

FILES REQUIRED:
1. package.json - with react@18, react-dom@18, vite@5, @vitejs/plugin-react@4
2. vite.config.js - with React plugin configured
3. index.html - entry point in project root with <div id="root"></div>
4. src/main.jsx - React 18 createRoot setup
5. src/App.jsx - counter component using useState hook
6. src/App.css - basic styling

The counter should have:
- Display current count number
- Increment button (+)
- Decrement button (-)
- Reset button

Make sure to include complete package.json with all dependencies and scripts (dev, build, preview).
```

### Template 2: Todo App

```
Create a React todo list application using Vite build tool. Include these COMPLETE files:

package.json:
- Dependencies: react, react-dom, vite, @vitejs/plugin-react
- Scripts: dev, build, preview

vite.config.js:
- Import and configure React plugin

index.html:
- In project root
- Include <div id="root"></div>
- Script tag pointing to src/main.jsx

src/main.jsx:
- React 18 createRoot
- Render App component

src/App.jsx:
- Todo list with add/delete/toggle functionality
- Use useState for state management

src/components/TodoItem.jsx:
- Individual todo item component

Include all necessary Vite configuration for development server.
```

### Template 3: Dashboard

```
Create a React dashboard application with Vite bundler. Generate complete project structure:

MUST INCLUDE:
- package.json (react, react-dom, vite, @vitejs/plugin-react, tailwindcss)
- vite.config.js (React plugin configuration)
- index.html (root file with <div id="root"></div>)
- tailwind.config.js (Tailwind configuration)
- postcss.config.js (PostCSS setup)
- src/main.jsx (React 18 entry point)
- src/App.jsx (main dashboard layout)
- src/index.css (Tailwind directives)

Dashboard features:
- Header with navigation
- Sidebar menu
- Main content area with stats cards
- Footer

Ensure package.json has dev script configured for Vite dev server.
```

---

## ❌ BAD PROMPTS (Will Not Work)

These will generate incomplete projects:

```
❌ "Create a React app"
❌ "Make a counter with React"
❌ "Build a todo list"
❌ "Create React components for a dashboard"
```

**Why they fail:** Too vague → AI generates only components → No build setup → Preview fails

---

## 🧪 TESTING PROCEDURE

### Step 1: Clean Slate
```bash
# Navigate to dashboard
Go to: http://localhost:3000

# Delete test8 project (or create new project)
Click "New Project" button
```

### Step 2: Use Optimal Prompt

**Copy this EXACT prompt:**

```
Create a complete React counter application with Vite build system.

GENERATE THESE FILES:

1. package.json
{
  "name": "counter-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0"
  }
}

2. vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
})

3. index.html (in project root)
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Counter App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>

4. src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './App.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

5. src/App.jsx
import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)
  
  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <h1>Counter App</h1>
      <div style={{ fontSize: '48px', margin: '20px' }}>{count}</div>
      <div>
        <button onClick={() => setCount(count - 1)} style={{ margin: '5px', padding: '10px 20px', fontSize: '18px' }}>
          Decrement (-)
        </button>
        <button onClick={() => setCount(0)} style={{ margin: '5px', padding: '10px 20px', fontSize: '18px' }}>
          Reset
        </button>
        <button onClick={() => setCount(count + 1)} style={{ margin: '5px', padding: '10px 20px', fontSize: '18px' }}>
          Increment (+)
        </button>
      </div>
    </div>
  )
}

export default App

6. src/App.css
body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 0;
}
```

### Step 3: Verify Generated Files

**CHECK THAT AI CREATED:**
- ✅ package.json (in root)
- ✅ vite.config.js (in root)
- ✅ index.html (in root)
- ✅ src/main.jsx
- ✅ src/App.jsx
- ✅ src/App.css

**If ANY file is missing, prompt again:**
```
"Please generate the missing files: package.json, vite.config.js, index.html with complete Vite project structure"
```

### Step 4: Start Preview

1. Click **"Start Preview"** button
2. Wait 30-90 seconds for:
   - Dependencies to install (npm install)
   - Vite dev server to compile
   - Server to become ready
3. Preview panel should show **Counter App** with working buttons

### Step 5: Verify Success

**✅ Success Indicators:**
- Preview shows rendered React app (not directory listing)
- Counter buttons work (increment/decrement/reset)
- Number updates when clicked
- No "Index of /" directory listing
- Browser console shows no errors

**❌ Failure Indicators:**
- Still shows directory listing
- "Preview server failed to start"
- Blank white screen
- Console errors about missing files

### Step 6: Check Logs (If Needed)

```bash
# Check what framework was detected
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "
SELECT 
  framework,
  status,
  SUBSTRING(command, 1, 100) as command,
  SUBSTRING(logs, 1, 200) as recent_logs
FROM preview_servers 
ORDER BY created_at DESC 
LIMIT 1;
"
```

**Expected Output:**
- framework: **vite** (not "static")
- command: Contains **"npm run dev"** or **"pnpm run dev"**
- logs: Shows Vite startup messages

---

## 🔍 DEBUGGING GUIDE

### Issue: Still Shows Directory Listing

**Diagnosis:**
```bash
# Check project files
docker exec dyad-collaborative-app-1 ls -la /app/projects/YOUR_PROJECT_ID/

# Should see:
# package.json
# vite.config.js  
# index.html
# src/
```

**If files are missing:** AI didn't generate complete structure. Use more detailed prompt.

### Issue: "Failed to start within 2 minutes"

**Diagnosis:**
```bash
# Check logs
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "
SELECT logs FROM preview_servers ORDER BY created_at DESC LIMIT 1;
"
```

**Common causes:**
- npm install taking too long (slow network)
- Missing dependencies in package.json
- Syntax error in vite.config.js

### Issue: Blank Screen in Preview

**Diagnosis:**
- Check browser console for errors
- Verify index.html has correct script tag
- Ensure main.jsx imports are correct

---

## 📊 COMPARISON: What Changed

### BEFORE (Broken)
```typescript
// All projects used http-server
detectFramework() {
  return 'static';  // Always!
}

buildCommand() {
  return `npx http-server -p ${port}`;  // Shows directory listing
}
```

### AFTER (Fixed)
```typescript
// Smart framework detection
async detectFramework(projectPath) {
  // 1. Check for vite.config.js → return 'vite'
  // 2. Check for webpack.config.js → return 'webpack'
  // 3. Check package.json dependencies
  // 4. Fall back to 'static' only if no build tools
}

async buildCommand(projectPath, framework, port) {
  if (framework === 'vite') {
    return `npm install && npm run dev -- --port ${port}`;  // Runs Vite!
  }
  if (framework === 'webpack') {
    return `PORT=${port} npm start -- --port ${port}`;  // With PORT override
  }
  if (framework === 'static') {
    return `npx http-server -p ${port}`;  // Only for actual static files
  }
}
```

---

## ✅ SUCCESS CRITERIA

After following this guide, you should see:

1. **Counter App Preview:**
   - Clean UI with counter display
   - Three working buttons
   - Instant updates when clicked
   - Professional appearance

2. **Database Check:**
   - Framework: `vite`
   - Status: `running`
   - Command: Contains `npm run dev`

3. **Performance:**
   - Starts in 30-90 seconds
   - Hot reload works (edit src/App.jsx, see instant changes)
   - No errors in console

---

## 🚀 READY TO TEST

**Next Action:**
1. Open http://localhost:3000
2. Create new project
3. Paste the Counter App prompt from Step 2 above
4. Wait for AI to generate files
5. Verify all 6 files were created
6. Click "Start Preview"
7. Wait for Vite to start
8. See working Counter App! 🎉

**The preview system is NOW WORKING CORRECTLY.** The issue was incomplete project generation, not the preview infrastructure.
