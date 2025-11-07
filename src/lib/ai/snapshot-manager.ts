/**
 * Snapshot Manager - Version Control System
 * 
 * Handles:
 * 1. Creating project snapshots before AI changes
 * 2. Storing complete file tree state
 * 3. Restoring previous versions (rollback)
 * 4. Snapshot metadata and history
 */

import { db } from '@/lib/db';
import { projectSnapshots, aiGenerations, projectFiles } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { FileNode } from '@/types';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SnapshotData {
  files: Array<{
    path: string;
    content: string;
    type: 'file' | 'directory';
    size: number;
  }>;
  fileTree: FileNode[];
  metadata: {
    totalFiles: number;
    totalSize: number;
    timestamp: string;
  };
}

export interface SnapshotInfo {
  id: string;
  projectId: string;
  createdBy: string;
  generationId?: string;
  snapshotData: SnapshotData;
  description?: string;
  createdAt: Date;
}

/**
 * Create a snapshot of current project state
 */
export async function createSnapshot(
  projectId: string,
  userId: string,
  description?: string,
  generationId?: string
): Promise<string> {
  try {
    // Get project path
    const projectPath = getProjectPath(projectId);

    // Read entire project file tree
    const snapshotData = await captureProjectState(projectPath);

    // Save snapshot to database
    const [snapshot] = await db
      .insert(projectSnapshots)
      .values({
        project_id: projectId,
        created_by: userId,
        generation_id: generationId,
        snapshot_data: snapshotData as any,
        description: description || 'Automatic snapshot before AI changes',
      })
      .returning();

    console.log(`Created snapshot ${snapshot.id} for project ${projectId}`);
    return snapshot.id;
  } catch (error) {
    console.error('Failed to create snapshot:', error);
    throw new Error(`Snapshot creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Capture current project state
 */
async function captureProjectState(projectPath: string): Promise<SnapshotData> {
  const files: SnapshotData['files'] = [];
  let totalSize = 0;

  // Walk directory tree
  async function walkDir(dir: string, basePath: string = ''): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.join(basePath, entry.name);

        // Skip node_modules, .git, and other common ignore patterns
        if (shouldIgnore(entry.name, relativePath)) {
          continue;
        }

        if (entry.isDirectory()) {
          files.push({
            path: relativePath,
            content: '',
            type: 'directory',
            size: 0,
          });
          await walkDir(fullPath, relativePath);
        } else if (entry.isFile()) {
          const content = await fs.readFile(fullPath, 'utf-8');
          const size = Buffer.byteLength(content, 'utf-8');
          
          files.push({
            path: relativePath,
            content,
            type: 'file',
            size,
          });

          totalSize += size;
        }
      }
    } catch (error) {
      console.error(`Error walking directory ${dir}:`, error);
    }
  }

  await walkDir(projectPath);

  // Build file tree
  const fileTree = buildFileTree(files);

  return {
    files,
    fileTree,
    metadata: {
      totalFiles: files.filter(f => f.type === 'file').length,
      totalSize,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Build file tree structure from flat file list
 */
function buildFileTree(files: SnapshotData['files']): FileNode[] {
  const root: FileNode[] = [];
  const pathMap = new Map<string, FileNode>();

  // Sort files by path
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sortedFiles) {
    const parts = file.path.split(path.sep);
    const name = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join(path.sep);

    const node: FileNode = {
      id: file.path,
      name,
      type: file.type === 'directory' ? 'folder' : 'file',
      path: file.path,
      children: file.type === 'directory' ? [] : undefined,
    };

    pathMap.set(file.path, node);

    if (parentPath === '') {
      // Root level
      root.push(node);
    } else {
      // Add to parent
      const parent = pathMap.get(parentPath);
      if (parent && parent.children) {
        parent.children.push(node);
      }
    }
  }

  return root;
}

/**
 * Check if file/directory should be ignored
 */
function shouldIgnore(name: string, relativePath: string): boolean {
  const ignorePatterns = [
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
    '.turbo',
    '.cache',
    'coverage',
    '.env.local',
    '.env.*.local',
    '.DS_Store',
  ];

  return ignorePatterns.some(pattern => {
    if (pattern.startsWith('.') && pattern.includes('*')) {
      // Glob pattern
      const regex = new RegExp(pattern.replace('*', '.*'));
      return regex.test(name);
    }
    return name === pattern || relativePath.includes(`/${pattern}/`);
  });
}

/**
 * Get project file system path
 */
function getProjectPath(projectId: string): string {
  // In production, projects are stored in /app/projects/{projectId}
  // In development, might be different
  const basePath = process.env.PROJECTS_BASE_PATH || '/app/projects';
  return path.join(basePath, projectId);
}

/**
 * Restore project to a previous snapshot
 */
export async function restoreSnapshot(
  snapshotId: string,
  projectId: string,
  userId: string
): Promise<void> {
  try {
    // Get snapshot
    const [snapshot] = await db
      .select()
      .from(projectSnapshots)
      .where(and(
        eq(projectSnapshots.id, snapshotId),
        eq(projectSnapshots.project_id, projectId)
      ))
      .limit(1);

    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    // Create backup snapshot of current state before restoring
    await createSnapshot(projectId, userId, `Backup before restoring to snapshot ${snapshotId}`);

    // Restore files
    const projectPath = getProjectPath(projectId);
    const snapshotData = snapshot.snapshot_data as SnapshotData;

    // Clear existing files (except ignored directories)
    await clearProjectFiles(projectPath);

    // Restore files from snapshot
    for (const file of snapshotData.files) {
      const fullPath = path.join(projectPath, file.path);

      if (file.type === 'directory') {
        await fs.mkdir(fullPath, { recursive: true });
      } else {
        // Ensure parent directory exists
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, file.content, 'utf-8');
      }
    }

    console.log(`Restored project ${projectId} to snapshot ${snapshotId}`);
  } catch (error) {
    console.error('Failed to restore snapshot:', error);
    throw new Error(`Snapshot restoration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Clear project files (keep ignored directories)
 */
async function clearProjectFiles(projectPath: string): Promise<void> {
  try {
    const entries = await fs.readdir(projectPath, { withFileTypes: true });

    for (const entry of entries) {
      if (shouldIgnore(entry.name, entry.name)) {
        continue; // Keep ignored files/directories
      }

      const fullPath = path.join(projectPath, entry.name);
      
      if (entry.isDirectory()) {
        await fs.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.unlink(fullPath);
      }
    }
  } catch (error) {
    console.error('Error clearing project files:', error);
    throw error;
  }
}

/**
 * Get snapshot by ID
 */
export async function getSnapshot(snapshotId: string): Promise<SnapshotInfo | null> {
  try {
    const [snapshot] = await db
      .select()
      .from(projectSnapshots)
      .where(eq(projectSnapshots.id, snapshotId))
      .limit(1);

    if (!snapshot) {
      return null;
    }

    return {
      id: snapshot.id,
      projectId: snapshot.project_id,
      createdBy: snapshot.created_by || '',
      generationId: snapshot.generation_id || undefined,
      snapshotData: snapshot.snapshot_data as SnapshotData,
      description: snapshot.description || undefined,
      createdAt: snapshot.created_at,
    };
  } catch (error) {
    console.error('Error getting snapshot:', error);
    return null;
  }
}

/**
 * List all snapshots for a project
 */
export async function listSnapshots(
  projectId: string,
  limit: number = 50
): Promise<SnapshotInfo[]> {
  try {
    const snapshots = await db
      .select()
      .from(projectSnapshots)
      .where(eq(projectSnapshots.project_id, projectId))
      .orderBy(desc(projectSnapshots.created_at))
      .limit(limit);

    return snapshots.map(snapshot => ({
      id: snapshot.id,
      projectId: snapshot.project_id,
      createdBy: snapshot.created_by || '',
      generationId: snapshot.generation_id || undefined,
      snapshotData: snapshot.snapshot_data as SnapshotData,
      description: snapshot.description || undefined,
      createdAt: snapshot.created_at,
    }));
  } catch (error) {
    console.error('Error listing snapshots:', error);
    return [];
  }
}

/**
 * Delete old snapshots (keep last N)
 */
export async function pruneSnapshots(
  projectId: string,
  keepCount: number = 10
): Promise<number> {
  try {
    const snapshots = await listSnapshots(projectId, 1000);
    
    if (snapshots.length <= keepCount) {
      return 0; // Nothing to prune
    }

    const toDelete = snapshots.slice(keepCount);
    let deletedCount = 0;

    for (const snapshot of toDelete) {
      await db
        .delete(projectSnapshots)
        .where(eq(projectSnapshots.id, snapshot.id));
      deletedCount++;
    }

    console.log(`Pruned ${deletedCount} old snapshots from project ${projectId}`);
    return deletedCount;
  } catch (error) {
    console.error('Error pruning snapshots:', error);
    return 0;
  }
}

/**
 * Get snapshot diff (compare two snapshots)
 */
export async function compareSnapshots(
  snapshotId1: string,
  snapshotId2: string
): Promise<{
  filesAdded: string[];
  filesRemoved: string[];
  filesModified: string[];
}> {
  const snapshot1 = await getSnapshot(snapshotId1);
  const snapshot2 = await getSnapshot(snapshotId2);

  if (!snapshot1 || !snapshot2) {
    throw new Error('One or both snapshots not found');
  }

  const files1 = new Map(snapshot1.snapshotData.files.map(f => [f.path, f.content]));
  const files2 = new Map(snapshot2.snapshotData.files.map(f => [f.path, f.content]));

  const filesAdded: string[] = [];
  const filesRemoved: string[] = [];
  const filesModified: string[] = [];

  // Check for added and modified files
  for (const [path, content2] of files2.entries()) {
    if (!files1.has(path)) {
      filesAdded.push(path);
    } else if (files1.get(path) !== content2) {
      filesModified.push(path);
    }
  }

  // Check for removed files
  for (const path of files1.keys()) {
    if (!files2.has(path)) {
      filesRemoved.push(path);
    }
  }

  return {
    filesAdded,
    filesRemoved,
    filesModified,
  };
}
