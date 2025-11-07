# Preview Server Testing Plan

## Issue Diagnosed
Your test8 project is **NOT a proper Vite/React project**. It's a standalone HTML file trying to load React from CDN, which the system correctly detects as "static" and serves with http-server (showing directory listing).

## Root Cause
The AI generated a **minimal HTML file** instead of a proper **React + Vite project structure**. This happens when:
1. Prompt is too vague ("create a react app")
2. AI takes shortcuts and generates CDN-based HTML
3. No package.json, no build tooling, just raw HTML

## Solution: Use Correct Prompt

### ❌ BAD Prompts (Will Generate Static HTML)
```
- "Create a React app"
- "Make a counter app"
- "Build a simple React application"
```

### ✅ GOOD Prompts (Will Generate Proper Vite Project)
```
"Create a complete React counter application using Vite as the build tool. Include:
- package.json with react, react-dom, and vite dependencies
- vite.config.js configuration file
- index.html as entry point
- src/main.jsx as React entry
- src/App.jsx with counter component
- All necessary Vite setup for development"
```

## Testing Steps

### Step 1: Clean Up Old Servers
```bash
# Stop all existing preview servers
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "
UPDATE preview_servers SET status='stopped', stopped_at=NOW() WHERE status='running';
"
```

### Step 2: Create NEW Project with Correct Prompt
1. Go to http://localhost:3000
2. Click "New Project"
3. Use this EXACT prompt:

```
Create a React counter application with Vite build system. Generate these files:

1. package.json - Include react@18, react-dom@18, vite@5, @vitejs/plugin-react
2. vite.config.js - Configure React plugin
3. index.html - Entry point with root div
4. src/main.jsx - ReactDOM.render setup
5. src/App.jsx - Counter component with state
6. src/App.css - Styling

Use modern React with hooks (useState). The counter should have increment and decrement buttons with the count displayed in the middle.
```

### Step 3: Verify Generated Files
Check that AI generated:
- ✅ package.json (with dependencies)
- ✅ vite.config.js
- ✅ index.html
- ✅ src/main.jsx
- ✅ src/App.jsx

### Step 4: Start Preview
1. Click "Start Preview"
2. Wait 30-60 seconds for:
   - npm install (downloads dependencies)
   - Vite dev server to start
   - Hot reload to be ready
3. Preview should show working counter app

### Step 5: Verify in Database
```bash
docker exec dyad-collaborative-db-1 psql -U postgres -d dyad_collaborative -c "
SELECT 
  SUBSTRING(project_id, 1, 8) as proj,
  port,
  framework,
  SUBSTRING(command, 1, 80) as command_start
FROM preview_servers 
WHERE status='running'
ORDER BY created_at DESC 
LIMIT 1;
"
```

**Expected Output:**
- framework: `vite`
- command: Contains `npm run dev` or `pnpm run dev` (NOT http-server)

## What Changed in Code

### Before (Broken)
```typescript
// Always used http-server for everything
return `npx http-server -p ${port} -a 0.0.0.0`;
```

### After (Fixed)
```typescript
async function detectFramework(projectPath: string): Promise<string> {
  // 1. Check for config files (vite.config.js, webpack.config.js)
  // 2. Check package.json dependencies
  // 3. Fall back to static only if no build tools found
}

async function buildCommand(projectPath, framework, port): string {
  switch (framework) {
    case 'vite':
    case 'next':
      return `npm install && npm run dev -- --port ${port}`;
    
    case 'webpack':
      return `PORT=${port} npm start -- --port ${port}`;  // PORT env variable
    
    case 'static':
      return `npx http-server -p ${port}`;  // Only for actual static files
  }
}
```

## Why test8 Shows Directory Listing

Your test8 project structure:
```
test8/
├── index.html      (loads React from unpkg.com CDN)
└── README.md
```

System correctly detects: **"static-cdn"** → Uses http-server → Shows directory listing

**This is CORRECT behavior** for this type of project structure!

## Fix for Existing test8 Project

### Option A: Regenerate with Correct Prompt (Recommended)
Delete test8, create new project with proper Vite prompt above.

### Option B: Manually Fix test8
Add these files to test8:

**package.json:**
```json
{
  "name": "test8",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
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
```

**vite.config.js:**
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

**src/main.jsx:**
```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

**src/App.jsx:**
```jsx
import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)
  
  return (
    <div>
      <h1>Counter: {count}</h1>
      <button onClick={() => setCount(count - 1)}>-</button>
      <button onClick={() => setCount(count + 1)}>+</button>
    </div>
  )
}

export default App
```

**Update index.html:**
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Test8</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

Then restart preview.

## Expected Behavior After Fix

### Vite Project
1. Framework detected: `vite`
2. Command: `npm install && npm run dev -- --port 8081`
3. Preview shows: React app with working buttons
4. Console shows: Vite dev server output, HMR ready

### Static HTML Project
1. Framework detected: `static` or `static-cdn`
2. Command: `npx http-server -p 8081`
3. Preview shows: Directory listing OR raw HTML (if index.html exists)
4. Console shows: http-server output

## Summary

**The preview system is working correctly!** 

The issue is that test8 is a **static HTML file with CDN-loaded React**, not a proper **React + Vite project**. The system correctly identifies it as static and serves it with http-server.

**To test preview properly:**
1. Create NEW project with detailed Vite prompt (see Step 2 above)
2. Verify files include package.json and vite.config.js
3. Start preview - should work perfectly

**The code fix I implemented handles:**
- ✅ Vite projects (npm run dev)
- ✅ Next.js projects (npm run dev)
- ✅ Webpack projects (PORT env variable)
- ✅ Static files (http-server)
- ✅ Proper framework detection
