/**
 * Diff Generation Library
 * 
 * Handles:
 * 1. Generating unified diffs between file versions
 * 2. Creating human-readable diff output
 * 3. Diff statistics and metadata
 */

import { diffLines, Change } from 'diff';

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  lineNumber?: number; // Line number in old file (for context/remove) or new file (for add)
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface CodeDiff {
  path: string;
  oldPath?: string; // For renames
  type: 'create' | 'modify' | 'delete' | 'rename';
  hunks: DiffHunk[];
  stats: {
    additions: number;
    deletions: number;
    changes: number;
  };
  oldContent?: string;
  newContent?: string;
  isBinary?: boolean;
}

export interface UnifiedDiff {
  files: CodeDiff[];
  totalStats: {
    filesChanged: number;
    additions: number;
    deletions: number;
  };
}

/**
 * Generate diff for a single file
 */
export function generateFileDiff(
  path: string,
  oldContent: string,
  newContent: string,
  type: 'create' | 'modify' | 'delete' = 'modify'
): CodeDiff {
  // Handle binary files (simple check)
  const isBinary = isBinaryContent(oldContent) || isBinaryContent(newContent);
  
  if (isBinary) {
    return {
      path,
      type,
      hunks: [],
      stats: { additions: 0, deletions: 0, changes: 0 },
      isBinary: true,
      oldContent,
      newContent,
    };
  }

  // Handle creates and deletes
  if (type === 'create') {
    return generateCreateDiff(path, newContent);
  }

  if (type === 'delete') {
    return generateDeleteDiff(path, oldContent);
  }

  // Generate line-by-line diff
  const changes = diffLines(oldContent, newContent);
  const hunks = buildHunks(changes);
  const stats = calculateStats(changes);

  return {
    path,
    type,
    hunks,
    stats,
    oldContent,
    newContent,
  };
}

/**
 * Generate diff for file creation
 */
function generateCreateDiff(path: string, content: string): CodeDiff {
  const lines = content.split('\n');
  const diffLines: DiffLine[] = lines.map((line, idx) => ({
    type: 'add' as const,
    content: line,
    lineNumber: idx + 1,
  }));

  return {
    path,
    type: 'create',
    hunks: [{
      oldStart: 0,
      oldLines: 0,
      newStart: 1,
      newLines: lines.length,
      lines: diffLines,
    }],
    stats: {
      additions: lines.length,
      deletions: 0,
      changes: lines.length,
    },
    newContent: content,
  };
}

/**
 * Generate diff for file deletion
 */
function generateDeleteDiff(path: string, content: string): CodeDiff {
  const lines = content.split('\n');
  const diffLines: DiffLine[] = lines.map((line, idx) => ({
    type: 'remove' as const,
    content: line,
    lineNumber: idx + 1,
  }));

  return {
    path,
    type: 'delete',
    hunks: [{
      oldStart: 1,
      oldLines: lines.length,
      newStart: 0,
      newLines: 0,
      lines: diffLines,
    }],
    stats: {
      additions: 0,
      deletions: lines.length,
      changes: lines.length,
    },
    oldContent: content,
  };
}

/**
 * Build diff hunks from changes
 */
function buildHunks(changes: Change[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let oldLineNum = 1;
  let newLineNum = 1;

  const CONTEXT_LINES = 3; // Lines of context before/after changes

  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const lines = change.value.split('\n').filter((l, idx, arr) => {
      // Keep empty line if it's not the last element
      return idx < arr.length - 1 || l !== '';
    });

    if (change.added || change.removed) {
      // Start new hunk if needed
      if (!currentHunk) {
        currentHunk = {
          oldStart: Math.max(1, oldLineNum - CONTEXT_LINES),
          oldLines: 0,
          newStart: Math.max(1, newLineNum - CONTEXT_LINES),
          newLines: 0,
          lines: [],
        };

        // Add context lines before change
        const contextStart = Math.max(0, i - 1);
        if (contextStart < i && changes[contextStart] && !changes[contextStart].added && !changes[contextStart].removed) {
          const contextLines = changes[contextStart].value.split('\n').slice(-CONTEXT_LINES);
          contextLines.forEach(line => {
            currentHunk!.lines.push({
              type: 'context',
              content: line,
              lineNumber: oldLineNum,
            });
            currentHunk!.oldLines++;
            currentHunk!.newLines++;
          });
        }
      }

      // Add changed lines
      lines.forEach(line => {
        if (change.added) {
          currentHunk!.lines.push({
            type: 'add',
            content: line,
            lineNumber: newLineNum,
          });
          currentHunk!.newLines++;
          newLineNum++;
        } else if (change.removed) {
          currentHunk!.lines.push({
            type: 'remove',
            content: line,
            lineNumber: oldLineNum,
          });
          currentHunk!.oldLines++;
          oldLineNum++;
        }
      });
    } else {
      // Context line
      if (currentHunk) {
        // Add context after change
        const contextLines = lines.slice(0, CONTEXT_LINES);
        contextLines.forEach(line => {
          currentHunk!.lines.push({
            type: 'context',
            content: line,
            lineNumber: oldLineNum,
          });
          currentHunk!.oldLines++;
          currentHunk!.newLines++;
          oldLineNum++;
          newLineNum++;
        });

        // Close hunk
        hunks.push(currentHunk);
        currentHunk = null;

        // Skip remaining context lines
        oldLineNum += lines.length - contextLines.length;
        newLineNum += lines.length - contextLines.length;
      } else {
        // No active hunk, just advance line numbers
        oldLineNum += lines.length;
        newLineNum += lines.length;
      }
    }
  }

  // Close last hunk if any
  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

/**
 * Calculate diff statistics
 */
function calculateStats(changes: Change[]): { additions: number; deletions: number; changes: number } {
  let additions = 0;
  let deletions = 0;

  for (const change of changes) {
    const lineCount = change.value.split('\n').filter(l => l !== '').length;
    if (change.added) {
      additions += lineCount;
    } else if (change.removed) {
      deletions += lineCount;
    }
  }

  return {
    additions,
    deletions,
    changes: additions + deletions,
  };
}

/**
 * Check if content is binary
 */
function isBinaryContent(content: string): boolean {
  // Check for null bytes (common in binary files)
  return content.includes('\0');
}

/**
 * Generate unified diff for multiple files
 */
export function generateUnifiedDiff(
  files: Array<{
    path: string;
    oldContent?: string;
    newContent?: string;
    type?: 'create' | 'modify' | 'delete';
  }>
): UnifiedDiff {
  const diffs: CodeDiff[] = [];
  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const file of files) {
    const type = file.type || (
      !file.oldContent ? 'create' :
      !file.newContent ? 'delete' :
      'modify'
    );

    const diff = generateFileDiff(
      file.path,
      file.oldContent || '',
      file.newContent || '',
      type
    );

    diffs.push(diff);
    totalAdditions += diff.stats.additions;
    totalDeletions += diff.stats.deletions;
  }

  return {
    files: diffs,
    totalStats: {
      filesChanged: diffs.length,
      additions: totalAdditions,
      deletions: totalDeletions,
    },
  };
}

/**
 * Format diff as unified diff string (Git-style)
 */
export function formatUnifiedDiff(diff: CodeDiff): string {
  let output = '';

  // Header
  if (diff.type === 'create') {
    output += `--- /dev/null\n`;
    output += `+++ b/${diff.path}\n`;
  } else if (diff.type === 'delete') {
    output += `--- a/${diff.path}\n`;
    output += `+++ /dev/null\n`;
  } else {
    output += `--- a/${diff.path}\n`;
    output += `+++ b/${diff.path}\n`;
  }

  // Hunks
  for (const hunk of diff.hunks) {
    output += `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@\n`;
    
    for (const line of hunk.lines) {
      const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
      output += `${prefix}${line.content}\n`;
    }
  }

  return output;
}

/**
 * Format diff as HTML (for UI display)
 */
export function formatDiffAsHTML(diff: CodeDiff): string {
  let html = '<div class="diff-file">';
  html += `<div class="diff-header">${diff.path} `;
  html += `<span class="diff-stats">`;
  html += `<span class="additions">+${diff.stats.additions}</span> `;
  html += `<span class="deletions">-${diff.stats.deletions}</span>`;
  html += `</span></div>`;

  if (diff.isBinary) {
    html += '<div class="binary-file">Binary file</div>';
  } else {
    for (const hunk of diff.hunks) {
      html += '<div class="diff-hunk">';
      html += `<div class="hunk-header">@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@</div>`;
      
      for (const line of hunk.lines) {
        const className = line.type === 'add' ? 'line-add' : 
                         line.type === 'remove' ? 'line-remove' : 
                         'line-context';
        const prefix = line.type === 'add' ? '+' : 
                      line.type === 'remove' ? '-' : 
                      ' ';
        html += `<div class="${className}"><span class="line-prefix">${prefix}</span>${escapeHtml(line.content)}</div>`;
      }
      
      html += '</div>';
    }
  }

  html += '</div>';
  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Get diff summary (for display in UI)
 */
export function getDiffSummary(diff: UnifiedDiff): string {
  const { filesChanged, additions, deletions } = diff.totalStats;
  const parts: string[] = [];

  if (filesChanged === 1) {
    parts.push('1 file changed');
  } else {
    parts.push(`${filesChanged} files changed`);
  }

  if (additions > 0) {
    parts.push(`${additions} insertion${additions === 1 ? '' : 's'}(+)`);
  }

  if (deletions > 0) {
    parts.push(`${deletions} deletion${deletions === 1 ? '' : 's'}(-)`);
  }

  return parts.join(', ');
}
