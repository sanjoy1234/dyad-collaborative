/**
 * File Operations Manager - Atomic File Operations
 * 
 * Handles:
 * 1. Atomic file operations (all-or-nothing)
 * 2. File creation, modification, deletion
 * 3. Transaction rollback on errors
 * 4. File system safety checks
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { FileOperation } from './prompt-engineer';

export interface FileOperationResult {
  success: boolean;
  operations: FileOperation[];
  filesChanged: string[];
  error?: string;
  rollbackPerformed?: boolean;
}

export interface FileBackup {
  path: string;
  content: string | null; // null for non-existent files
  existed: boolean;
}

/**
 * Apply file operations atomically
 * If any operation fails, all changes are rolled back
 */
export async function applyFileOperations(
  projectId: string,
  operations: FileOperation[]
): Promise<FileOperationResult> {
  const projectPath = getProjectPath(projectId);
  const backups: FileBackup[] = [];
  const filesChanged: string[] = [];

  // Ensure project directory exists
  await ensureProjectDirectory(projectPath);

  try {
    // Phase 1: Create backups and validate
    for (const op of operations) {
      const fullPath = path.join(projectPath, op.path);
      
      // Security check: prevent path traversal
      if (!isPathSafe(projectPath, fullPath)) {
        throw new Error(`Unsafe path detected: ${op.path}`);
      }

      // Create backup of existing file
      const backup = await createBackup(fullPath);
      backups.push(backup);
    }

    // Phase 2: Apply operations
    for (const op of operations) {
      const fullPath = path.join(projectPath, op.path);

      switch (op.type) {
        case 'create':
          await createFile(fullPath, op.content!);
          filesChanged.push(op.path);
          break;

        case 'modify':
          await modifyFile(fullPath, op.content!);
          filesChanged.push(op.path);
          break;

        case 'delete':
          await deleteFile(fullPath);
          filesChanged.push(op.path);
          break;

        default:
          throw new Error(`Unknown operation type: ${(op as any).type}`);
      }
    }

    return {
      success: true,
      operations,
      filesChanged,
    };
  } catch (error) {
    console.error('File operation failed, rolling back:', error);

    // Rollback: restore from backups
    await rollbackChanges(backups);

    return {
      success: false,
      operations,
      filesChanged: [],
      error: error instanceof Error ? error.message : 'Unknown error',
      rollbackPerformed: true,
    };
  }
}

/**
 * Create backup of a file
 */
async function createBackup(filePath: string): Promise<FileBackup> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return {
      path: filePath,
      content,
      existed: true,
    };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist
      return {
        path: filePath,
        content: null,
        existed: false,
      };
    }
    throw error;
  }
}

/**
 * Rollback changes using backups
 */
async function rollbackChanges(backups: FileBackup[]): Promise<void> {
  for (const backup of backups) {
    try {
      if (backup.existed && backup.content !== null) {
        // Restore original file
        await fs.mkdir(path.dirname(backup.path), { recursive: true });
        await fs.writeFile(backup.path, backup.content, 'utf-8');
      } else {
        // Remove newly created file
        try {
          await fs.unlink(backup.path);
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            console.error(`Failed to remove file during rollback: ${backup.path}`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to rollback file: ${backup.path}`, error);
    }
  }
}

/**
 * Create a new file
 */
async function createFile(filePath: string, content: string): Promise<void> {
  // Check if file already exists
  try {
    await fs.access(filePath);
    throw new Error(`File already exists: ${filePath}`);
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  // Create parent directories
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  // Write file
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Modify an existing file
 */
async function modifyFile(filePath: string, content: string): Promise<void> {
  // Check if file exists
  try {
    await fs.access(filePath);
  } catch (error) {
    throw new Error(`File does not exist: ${filePath}`);
  }

  // Write new content
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Delete a file
 */
async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, that's fine
      return;
    }
    throw error;
  }
}

/**
 * Check if path is safe (no traversal outside project directory)
 */
function isPathSafe(projectPath: string, fullPath: string): boolean {
  const normalized = path.normalize(fullPath);
  return normalized.startsWith(projectPath);
}

/**
 * Get project file system path
 */
function getProjectPath(projectId: string): string {
  const basePath = process.env.PROJECTS_BASE_PATH || '/app/projects';
  return path.join(basePath, projectId);
}

/**
 * Ensure project directory exists
 */
async function ensureProjectDirectory(projectPath: string): Promise<void> {
  try {
    await fs.access(projectPath);
  } catch (error) {
    // Directory doesn't exist, create it
    console.log(`Creating project directory: ${projectPath}`);
    await fs.mkdir(projectPath, { recursive: true });
  }
}

/**
 * Read file content
 */
export async function readFile(projectId: string, filePath: string): Promise<string> {
  const projectPath = getProjectPath(projectId);
  
  // Ensure project directory exists
  await ensureProjectDirectory(projectPath);
  
  const fullPath = path.join(projectPath, filePath);

  if (!isPathSafe(projectPath, fullPath)) {
    throw new Error(`Unsafe path: ${filePath}`);
  }

  try {
    return await fs.readFile(fullPath, 'utf-8');
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    }
    throw error;
  }
}

/**
 * Check if file exists
 */
export async function fileExists(projectId: string, filePath: string): Promise<boolean> {
  const projectPath = getProjectPath(projectId);
  const fullPath = path.join(projectPath, filePath);

  if (!isPathSafe(projectPath, fullPath)) {
    return false;
  }

  try {
    await fs.access(fullPath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * List all files in project
 */
export async function listProjectFiles(projectId: string): Promise<Map<string, string>> {
  const projectPath = getProjectPath(projectId);
  const files = new Map<string, string>();

  // Ensure project directory exists
  await ensureProjectDirectory(projectPath);

  async function walkDir(dir: string, basePath: string = ''): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.join(basePath, entry.name);

        // Skip ignored files/directories
        if (shouldIgnore(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          await walkDir(fullPath, relativePath);
        } else if (entry.isFile()) {
          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            files.set(relativePath, content);
          } catch (error) {
            console.error(`Error reading file ${relativePath}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(`Error walking directory ${dir}:`, error);
    }
  }

  await walkDir(projectPath);
  return files;
}

/**
 * Check if file/directory should be ignored
 */
function shouldIgnore(name: string): boolean {
  const ignorePatterns = [
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
    '.turbo',
    '.cache',
    'coverage',
    '.DS_Store',
  ];

  return ignorePatterns.includes(name);
}

/**
 * Get file metadata
 */
export async function getFileMetadata(
  projectId: string,
  filePath: string
): Promise<{ size: number; modifiedAt: Date } | null> {
  const projectPath = getProjectPath(projectId);
  const fullPath = path.join(projectPath, filePath);

  if (!isPathSafe(projectPath, fullPath)) {
    return null;
  }

  try {
    const stats = await fs.stat(fullPath);
    return {
      size: stats.size,
      modifiedAt: stats.mtime,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Validate file operations before applying
 */
export function validateFileOperations(operations: FileOperation[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const paths = new Set<string>();

  for (const op of operations) {
    // Check for duplicate paths
    if (paths.has(op.path)) {
      errors.push(`Duplicate operation for path: ${op.path}`);
    }
    paths.add(op.path);

    // Validate operation type
    if (!['create', 'modify', 'delete'].includes(op.type)) {
      errors.push(`Invalid operation type: ${op.type}`);
    }

    // Validate path format
    if (op.path.includes('..')) {
      errors.push(`Path traversal detected: ${op.path}`);
    }

    // Allow common project paths - removed overly strict restriction
    // Now allows: src/, public/, package.json, README.md, config files, etc.
    const allowedPaths = /^(src\/|public\/|\.\/|[^/]+\.(json|md|js|ts|tsx|jsx|css|html|txt|yml|yaml|env|gitignore)$)/;
    if (!allowedPaths.test(op.path)) {
      errors.push(`Invalid path format: ${op.path}. Must be in src/, public/, or be a root-level config/doc file.`);
    }

    // Validate content for create/modify
    if ((op.type === 'create' || op.type === 'modify') && !op.content) {
      errors.push(`Missing content for ${op.type} operation: ${op.path}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
