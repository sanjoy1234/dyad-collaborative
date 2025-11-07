/**
 * Auto-fix utility to inject required bu      {
        name: "vite-react-app",
        private: true,
        version: "1.0.0",
        type: "module",
        scripts: {
          dev: "npx vite",
          build: "npx vite build",
          preview: "npx vite preview"
        },
        dependencies: {
          react: "^18.3.1",
          "react-dom": "^18.3.1"
        },
        devDependencies: {
          "@vitejs/plugin-react": "^4.3.4",
          "vite": "^5.4.11",
          ...(typescript ? { "@types/react": "^18.3.1", "@types/react-dom": "^18.3.1", "typescript": "^5.3.3" } : {})
        }
      }, null, 2)les
 * for React/Vite projects when AI forgets to generate them
 */

import { FileOperation } from './prompt-engineer';

export interface BuildConfigTemplate {
  path: string;
  content: string;
}

/**
 * Detects if operations contain React code but missing build config
 */
export function needsBuildConfig(operations: FileOperation[]): { needs: boolean; framework: 'vite' | 'webpack' | null } {
  const hasReactCode = operations.some(op => 
    (op.path.endsWith('.jsx') || op.path.endsWith('.tsx')) ||
    op.content.includes('import React') ||
    op.content.includes('from \'react\'') ||
    op.content.includes('useState') ||
    op.content.includes('useEffect')
  );

  const hasPackageJson = operations.some(op => op.path === 'package.json');
  const hasViteConfig = operations.some(op => op.path === 'vite.config.js' || op.path === 'vite.config.ts');
  const hasWebpackConfig = operations.some(op => op.path === 'webpack.config.js');
  const hasIndexHtml = operations.some(op => op.path === 'index.html');

  if (hasReactCode && (!hasPackageJson || !hasViteConfig) && !hasIndexHtml) {
    return { needs: true, framework: 'vite' };
  }

  return { needs: false, framework: null };
}

/**
 * Generate required build configuration files for Vite + React
 */
export function generateBuildConfig(typescript: boolean = false): BuildConfigTemplate[] {
  const mainExt = typescript ? 'tsx' : 'jsx';
  
  console.log('[BUILD-CONFIG-INJECTOR] Generating build config with NPX VITE');
  
  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: "vite-react-app",
        private: true,
        version: "1.0.0",
        type: "module",
        scripts: {
          dev: "npx vite",
          build: "npx vite build",
          preview: "npx vite preview"
        },
        dependencies: {
          react: "^18.3.1",
          "react-dom": "^18.3.1"
        }
      }, null, 2)
    },
    {
      path: typescript ? 'vite.config.ts' : 'vite.config.js',
      content: `// Simple Vite config for React - npx vite will auto-detect React
export default {}
`
    },
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.${mainExt}"></script>
  </body>
</html>
`
    }
  ];
}

/**
 * Auto-inject build config files if React project is missing them
 */
export function autoInjectBuildConfig(operations: FileOperation[], typescript: boolean = false): FileOperation[] {
  const check = needsBuildConfig(operations);
  
  if (!check.needs) {
    console.log('[Auto-Fix] Project has build config, no injection needed');
    return operations;
  }

  console.log(`[Auto-Fix] Detected React project without build config. Injecting ${check.framework} configuration...`);
  
  const buildConfigs = generateBuildConfig(typescript);
  const newOperations: FileOperation[] = [
    ...operations,
    ...buildConfigs.map(config => ({
      type: 'create' as const,
      path: config.path,
      content: config.content,
      oldContent: ''
    }))
  ];

  console.log('[Auto-Fix] Injected files:', buildConfigs.map(c => c.path).join(', '));
  
  return newOperations;
}

/**
 * Ensure main entry point exists for React project
 */
export function ensureMainEntryPoint(operations: FileOperation[], typescript: boolean = false): FileOperation[] {
  const mainExt = typescript ? 'tsx' : 'jsx';
  const mainPath = `src/main.${mainExt}`;
  
  const hasMain = operations.some(op => 
    op.path === mainPath || 
    op.path === 'src/index.jsx' || 
    op.path === 'src/index.tsx' ||
    op.path === 'src/index.js' ||
    op.path === 'src/main.js'
  );

  // Find the actual App file and its extension
  const appFile = operations.find(op =>
    op.path.match(/src\/App\.(jsx?|tsx?)$/)
  );

  if (appFile && !hasMain) {
    console.log('[Auto-Fix] Adding missing main entry point');
    
    // Extract the actual extension from the App file
    const appExtMatch = appFile.path.match(/\.(jsx?|tsx?)$/);
    const appExt = appExtMatch ? appExtMatch[1] : mainExt;
    
    return [
      ...operations,
      {
        type: 'create' as const,
        path: mainPath,
        content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.${appExt}'

ReactDOM.createRoot(document.getElementById('root')${typescript ? '!' : ''}).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
        oldContent: ''
      }
    ];
  }

  return operations;
}
