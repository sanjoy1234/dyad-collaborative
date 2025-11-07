/**
 * Prompt Engineering for Code Generation
 * 
 * This module handles:
 * 1. System prompts for React/Next.js code generation
 * 2. Project context injection
 * 3. AI response parsing (extracting file operations)
 * 4. Code generation best practices
 */

import { FileNode } from '@/types';

// Supported frameworks
export type Framework = 'nextjs' | 'react' | 'vite' | 'node' | 'unknown';

// File operation types
export interface FileOperation {
  type: 'create' | 'modify' | 'delete';
  path: string;
  content?: string; // For create/modify
  oldContent?: string; // For modify (to generate diff)
  reason?: string; // Why this change was made
}

export interface ParsedAIResponse {
  operations: FileOperation[];
  explanation: string;
  error?: string;
}

export interface ProjectContext {
  framework: Framework;
  fileTree: FileNode[];
  existingFiles: Map<string, string>; // path -> content
  dependencies: Record<string, string>; // from package.json
  selectedFiles?: string[]; // Files user wants to modify
  typescript: boolean;
}

/**
 * Detect framework from package.json
 */
export function detectFramework(dependencies: Record<string, string>): Framework {
  if (dependencies['next'] || dependencies['Next.js']) {
    return 'nextjs';
  }
  if (dependencies['react']) {
    return 'react';
  }
  if (dependencies['vite']) {
    return 'vite';
  }
  if (dependencies['express'] || dependencies['fastify'] || dependencies['koa']) {
    return 'node';
  }
  return 'unknown';
}

/**
 * Build system prompt for code generation
 */
export function buildSystemPrompt(context: ProjectContext): string {
  const { framework, typescript, dependencies, fileTree } = context;

  // File tree representation (limit depth for token efficiency)
  const fileTreeStr = buildFileTreeString(fileTree, 3);

  // Framework-specific instructions
  const frameworkInstructions = getFrameworkInstructions(framework, typescript);

  const systemPrompt = `You are an expert ${framework === 'nextjs' ? 'Next.js' : framework} developer and code generator.

## Your Task
Generate, modify, or delete files based on the user's request. Output ONLY valid JSON.

## Project Context
Framework: ${framework}
TypeScript: ${typescript ? 'Yes' : 'No'}
Dependencies: ${Object.keys(dependencies).slice(0, 20).join(', ')}${Object.keys(dependencies).length > 20 ? '...' : ''}

Current File Structure:
${fileTreeStr}

## Output Format (STRICT JSON)
{
  "operations": [
    {
      "type": "create" | "modify" | "delete",
      "path": "src/components/Button.tsx",
      "content": "...full file content...",
      "reason": "Created reusable button component"
    }
  ],
  "explanation": "Brief summary of changes made"
}

## Critical Rules
1. **JSON ONLY**: No markdown, no code blocks, no explanations outside JSON
2. **Full Content**: Always provide complete file content, never use "...existing code..." placeholders
3. **Correct Paths**: Use existing project structure (${framework === 'nextjs' ? 'src/app/, src/components/' : 'src/'})
4. **No External Deps**: Only use dependencies already in package.json
5. **TypeScript**: ${typescript ? 'All files must use .tsx/.ts extensions with proper types' : 'Use .jsx/.js extensions'}
6. **Imports**: Use correct import paths (@ aliases, relative paths)
7. **Server Components**: ${framework === 'nextjs' ? 'Use "use client" directive when needed (hooks, events, state)' : 'N/A'}

${frameworkInstructions}

## Examples

Example 1 - Create new component:
{
  "operations": [
    {
      "type": "create",
      "path": "src/components/Button.tsx",
      "content": "interface ButtonProps {\\n  children: React.ReactNode;\\n  onClick?: () => void;\\n}\\n\\nexport function Button({ children, onClick }: ButtonProps) {\\n  return (\\n    <button onClick={onClick} className=\\"px-4 py-2 bg-blue-500 text-white rounded\\">\\n      {children}\\n    </button>\\n  );\\n}",
      "reason": "Created reusable Button component with TypeScript props"
    }
  ],
  "explanation": "Created a Button component with onClick handler and Tailwind styling"
}

Example 2 - Modify existing file:
{
  "operations": [
    {
      "type": "modify",
      "path": "src/app/page.tsx",
      "content": "import { Button } from '@/components/Button';\\n\\nexport default function Home() {\\n  return (\\n    <main className=\\"p-8\\">\\n      <h1>Welcome</h1>\\n      <Button onClick={() => alert('Clicked!')}>Click Me</Button>\\n    </main>\\n  );\\n}",
      "reason": "Added Button component to homepage"
    }
  ],
  "explanation": "Updated homepage to use the new Button component"
}

Example 3 - Multiple operations:
{
  "operations": [
    {
      "type": "create",
      "path": "src/components/TodoList.tsx",
      "content": "...",
      "reason": "Created TodoList component"
    },
    {
      "type": "create",
      "path": "src/components/TodoItem.tsx",
      "content": "...",
      "reason": "Created TodoItem child component"
    },
    {
      "type": "modify",
      "path": "src/app/page.tsx",
      "content": "...",
      "reason": "Integrated TodoList into homepage"
    }
  ],
  "explanation": "Built complete todo list feature with list and item components"
}

Now, generate code based on the user's request. Remember: JSON ONLY, NO MARKDOWN.`;

  return systemPrompt;
}

/**
 * Get framework-specific instructions
 */
function getFrameworkInstructions(framework: Framework, typescript: boolean): string {
  switch (framework) {
    case 'nextjs':
      return `## Next.js 14+ Best Practices
- Use App Router (not Pages Router)
- Server Components by default (no "use client" unless needed)
- "use client" required for: useState, useEffect, onClick, event handlers, browser APIs
- File structure: src/app/ for pages, src/components/ for components
- API routes: src/app/api/[route]/route.ts
- Metadata: export const metadata = { title: '...' }
- Images: Use next/image component
- Links: Use next/link component
- Styling: Tailwind CSS (classes already available)`;

    case 'react':
    case 'vite':
      return `## React + Vite Project Structure (REQUIRED FOR PREVIEW)

**CRITICAL**: For preview to work, you MUST generate a complete Vite project structure with these EXACT files:

### 1. package.json - ALWAYS include this EXACTLY as shown (DO NOT change versions):
{
  "name": "vite-react-app",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
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

**CRITICAL**: Use EXACTLY these versions. vite@5.x requires @vitejs/plugin-react@4.x. DO NOT use vite@3.x or @vitejs/plugin-react@3.x - they are incompatible and will cause npm install to fail.

### 2. vite.config.${typescript ? 'ts' : 'js'} - Required for Vite (copy EXACTLY):
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()]
})

### 3. index.html - Entry point (root level, NOT in public/):
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.${typescript ? 'tsx' : 'jsx'}"></script>
  </body>
</html>

### 4. src/main.${typescript ? 'tsx' : 'jsx'} - React entry point:
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.${typescript ? 'tsx' : 'jsx'}'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')${typescript ? '!' : ''}).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

### 5. src/App.${typescript ? 'tsx' : 'jsx'} - Main component:
import { useState } from 'react'
import './App.css'

function App() {
  // Your component code here
  return (
    <div className="App">
      <h1>Hello World</h1>
    </div>
  )
}

export default App

### 6. src/index.css - Global styles (minimal):
:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

### 7. src/App.css - Component styles (minimal):
.App {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

## File Operation Rules:
1. ALWAYS create package.json FIRST (with exact scripts above)
2. ALWAYS create vite.config.${typescript ? 'ts' : 'js'} 
3. ALWAYS create index.html at ROOT level (not in public/)
4. ALWAYS create src/main.${typescript ? 'tsx' : 'jsx'} (not src/index.js!)
5. ALWAYS create src/App.${typescript ? 'tsx' : 'jsx'}
6. Use .${typescript ? 'tsx' : 'jsx'} extension for React components
7. Import React in files that use JSX: import React from 'react'
8. For additional components: src/components/ComponentName.${typescript ? 'tsx' : 'jsx'}

## Best Practices:
- Functional components with hooks
- Use ${typescript ? 'TypeScript interfaces for props' : 'proper prop validation'}
- State management: useState, useContext, useReducer
- Side effects: useEffect with proper dependencies
- Styling: Import CSS files, use CSS modules, or inline styles
- File structure: src/components/, src/hooks/, src/utils/`;

    case 'node':
      return `## Node.js Best Practices
- Use async/await for async operations
- Error handling with try/catch
- Module exports: export { }
- Environment variables: process.env
- File structure: src/routes/, src/controllers/, src/models/`;

    default:
      return `## General Best Practices
- Clean, readable code
- Proper error handling
- Consistent naming conventions
- Comment complex logic`;
  }
}

/**
 * Build file tree string representation
 */
function buildFileTreeString(nodes: FileNode[], maxDepth: number, depth: number = 0): string {
  if (depth >= maxDepth) return '';

  const indent = '  '.repeat(depth);
  let result = '';

  for (const node of nodes) {
    if (node.type === 'folder') {
      result += `${indent}${node.name}/\n`;
      if (node.children) {
        result += buildFileTreeString(node.children, maxDepth, depth + 1);
      }
    } else {
      result += `${indent}${node.name}\n`;
    }
  }

  return result;
}

/**
 * Inject project context into user prompt
 */
export function injectProjectContext(
  userPrompt: string,
  context: ProjectContext
): string {
  let enhancedPrompt = userPrompt;

  // Add selected files context if any
  if (context.selectedFiles && context.selectedFiles.length > 0) {
    enhancedPrompt += `\n\nSelected files to modify:\n`;
    for (const filePath of context.selectedFiles) {
      const content = context.existingFiles.get(filePath);
      if (content) {
        enhancedPrompt += `\n--- ${filePath} ---\n${content}\n`;
      }
    }
  }

  return enhancedPrompt;
}

/**
 * Parse AI response to extract file operations
 */
export function parseAIResponse(response: string): ParsedAIResponse {
  try {
    // Clean response - remove markdown code blocks if present
    let cleaned = response.trim();
    
    // Remove markdown code block markers
    cleaned = cleaned.replace(/^```json\n?/i, '');
    cleaned = cleaned.replace(/^```\n?/i, '');
    cleaned = cleaned.replace(/\n?```$/i, '');
    cleaned = cleaned.trim();

    // Try to find JSON object in response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        operations: [],
        explanation: '',
        error: 'No JSON object found in response',
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (!parsed.operations || !Array.isArray(parsed.operations)) {
      return {
        operations: [],
        explanation: parsed.explanation || '',
        error: 'Invalid response structure: missing operations array',
      };
    }

    // Validate each operation
    const validOperations: FileOperation[] = [];
    for (const op of parsed.operations) {
      if (!op.type || !['create', 'modify', 'delete'].includes(op.type)) {
        console.warn('Invalid operation type:', op.type);
        continue;
      }

      if (!op.path || typeof op.path !== 'string') {
        console.warn('Invalid operation path:', op.path);
        continue;
      }

      // For create/modify, content is required
      if ((op.type === 'create' || op.type === 'modify') && !op.content) {
        console.warn('Missing content for operation:', op.path);
        continue;
      }

      validOperations.push({
        type: op.type,
        path: op.path,
        content: op.content,
        oldContent: op.oldContent,
        reason: op.reason || 'No reason provided',
      });
    }

    return {
      operations: validOperations,
      explanation: parsed.explanation || 'No explanation provided',
    };
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    return {
      operations: [],
      explanation: '',
      error: error instanceof Error ? error.message : 'Failed to parse response',
    };
  }
}

/**
 * Validate file operations before execution
 */
export function validateOperations(
  operations: FileOperation[],
  context: ProjectContext
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const op of operations) {
    // Check path format
    if (op.path.includes('..')) {
      errors.push(`Invalid path (contains ..): ${op.path}`);
    }

    // Allow common project paths - removed overly strict restriction
    // Now allows: src/, public/, package.json, README.md, config files, etc.
    const allowedPaths = /^(src\/|public\/|\.\/|[^/]+\.(json|md|js|ts|tsx|jsx|css|html|txt|yml|yaml|env|gitignore)$)/;
    if (!allowedPaths.test(op.path)) {
      errors.push(`Invalid path format: ${op.path}. Must be in src/, public/, or be a root-level config/doc file.`);
    }

    // Check file extension for TypeScript projects
    if (context.typescript && op.type !== 'delete') {
      if (op.path.match(/\.(jsx|js)$/)) {
        errors.push(`Use .tsx/.ts extensions in TypeScript project: ${op.path}`);
      }
    }

    // Check content length (prevent huge files)
    if (op.content && op.content.length > 100000) {
      errors.push(`File too large (>100KB): ${op.path}`);
    }

    // Validate modify operations have existing file
    if (op.type === 'modify' && !context.existingFiles.has(op.path)) {
      errors.push(`Cannot modify non-existent file: ${op.path}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Estimate token count for prompt (rough estimate)
 */
export function estimateTokenCount(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Build complete prompt for code generation
 */
export function buildCodeGenerationPrompt(
  userRequest: string,
  context: ProjectContext
): { systemPrompt: string; userPrompt: string; estimatedTokens: number } {
  const systemPrompt = buildSystemPrompt(context);
  const userPrompt = injectProjectContext(userRequest, context);

  const estimatedTokens = 
    estimateTokenCount(systemPrompt) + 
    estimateTokenCount(userPrompt);

  return {
    systemPrompt,
    userPrompt,
    estimatedTokens,
  };
}
