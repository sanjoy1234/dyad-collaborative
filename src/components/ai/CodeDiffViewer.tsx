'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Check,
  X,
  FileCode,
  FilePlus,
  FileMinus,
  FileEdit,
  Loader2,
  ChevronDown,
  ChevronRight,
  Download,
  Copy,
} from 'lucide-react';

interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  lineNumber?: number;
}

interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

interface CodeDiff {
  path: string;
  type: 'create' | 'modify' | 'delete';
  hunks: DiffHunk[];
  stats: {
    additions: number;
    deletions: number;
    changes: number;
  };
}

interface UnifiedDiff {
  files: CodeDiff[];
  totalStats: {
    additions: number;
    deletions: number;
    changes: number;
  };
}

interface Generation {
  id: string;
  status: 'pending' | 'applied' | 'rejected' | 'error';
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
  diffs: UnifiedDiff;
  explanation?: string;
  errorMessage?: string;
}

interface CodeDiffViewerProps {
  generationId: string | null;
  onApprove?: () => void;
  onReject?: () => void;
}

export function CodeDiffViewer({ generationId, onApprove, onReject }: CodeDiffViewerProps) {
  const { toast } = useToast();
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (generationId) {
      loadGeneration(generationId);
    } else {
      setGeneration(null);
    }
  }, [generationId]);

  const loadGeneration = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/ai/generations/${id}`);
      if (response.ok) {
        const data = await response.json();
        setGeneration(data);
        // Expand all files by default
        setExpandedFiles(new Set(data.diffs?.files?.map((f: CodeDiff) => f.path) || []));
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load generation details',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to load generation:', error);
      toast({
        title: 'Error',
        description: 'Failed to load generation details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!generation) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/ai/generations/${generation.id}/approve`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Changes Applied',
          description: `${data.filesChanged.length} file(s) updated successfully`,
        });
        setGeneration((prev) => prev ? { ...prev, status: 'applied' } : null);
        if (onApprove) onApprove();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to apply changes',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to approve:', error);
      toast({
        title: 'Error',
        description: 'Failed to apply changes',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!generation) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/ai/generations/${generation.id}/reject`, {
        method: 'POST',
      });

      if (response.ok) {
        toast({
          title: 'Changes Rejected',
          description: 'The proposed changes have been rejected',
        });
        setGeneration((prev) => prev ? { ...prev, status: 'rejected' } : null);
        if (onReject) onReject();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to reject changes',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to reject:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject changes',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const toggleFileExpansion = (path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const getFileIcon = (type: 'create' | 'modify' | 'delete') => {
    switch (type) {
      case 'create':
        return <FilePlus className="h-4 w-4 text-green-600" />;
      case 'modify':
        return <FileEdit className="h-4 w-4 text-blue-600" />;
      case 'delete':
        return <FileMinus className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending Review</Badge>;
      case 'applied':
        return <Badge className="bg-green-600">Applied</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return null;
    }
  };

  if (!generationId) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
        <FileCode className="h-16 w-16 mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2">No changes to review</p>
        <p className="text-sm">
          Generated code changes will appear here for review
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!generation) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <X className="h-16 w-16 mb-4 text-destructive" />
        <p className="text-lg font-medium mb-2">Failed to load changes</p>
        <p className="text-sm text-muted-foreground">
          The generation could not be loaded
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            <h3 className="font-semibold">Code Changes</h3>
          </div>
          {getStatusBadge(generation.status)}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          {generation.filesCreated.length > 0 && (
            <div className="flex items-center gap-1 text-green-600">
              <FilePlus className="h-4 w-4" />
              <span>{generation.filesCreated.length} created</span>
            </div>
          )}
          {generation.filesModified.length > 0 && (
            <div className="flex items-center gap-1 text-blue-600">
              <FileEdit className="h-4 w-4" />
              <span>{generation.filesModified.length} modified</span>
            </div>
          )}
          {generation.filesDeleted.length > 0 && (
            <div className="flex items-center gap-1 text-red-600">
              <FileMinus className="h-4 w-4" />
              <span>{generation.filesDeleted.length} deleted</span>
            </div>
          )}
        </div>

        {generation.diffs?.totalStats && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="text-green-600">
              +{generation.diffs.totalStats.additions} additions
            </span>
            <span className="text-red-600">
              -{generation.diffs.totalStats.deletions} deletions
            </span>
          </div>
        )}

        {generation.explanation && (
          <p className="text-sm text-muted-foreground">{generation.explanation}</p>
        )}

        {generation.errorMessage && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {generation.errorMessage}
          </div>
        )}

        {/* Actions */}
        {generation.status === 'pending' && (
          <div className="flex gap-2">
            <Button
              onClick={handleApprove}
              disabled={actionLoading}
              className="flex-1"
            >
              {actionLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Approve & Apply
            </Button>
            <Button
              onClick={handleReject}
              disabled={actionLoading}
              variant="destructive"
              className="flex-1"
            >
              <X className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </div>
        )}
      </div>

      {/* Diff Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {generation.diffs?.files?.map((fileDiff) => (
            <Card key={fileDiff.path} className="overflow-hidden">
              <div
                className="flex items-center justify-between p-3 bg-muted cursor-pointer hover:bg-muted/80"
                onClick={() => toggleFileExpansion(fileDiff.path)}
              >
                <div className="flex items-center gap-2">
                  {expandedFiles.has(fileDiff.path) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {getFileIcon(fileDiff.type)}
                  <span className="font-mono text-sm">{fileDiff.path}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {fileDiff.stats.additions > 0 && (
                    <span className="text-green-600">+{fileDiff.stats.additions}</span>
                  )}
                  {fileDiff.stats.deletions > 0 && (
                    <span className="text-red-600">-{fileDiff.stats.deletions}</span>
                  )}
                </div>
              </div>

              {expandedFiles.has(fileDiff.path) && (
                <div className="border-t">
                  {fileDiff.hunks.map((hunk, hunkIndex) => (
                    <div key={hunkIndex} className="font-mono text-xs">
                      <div className="px-3 py-1 bg-muted/50 text-muted-foreground">
                        @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                      </div>
                      {hunk.lines.map((line, lineIndex) => (
                        <div
                          key={lineIndex}
                          className={`px-3 py-0.5 ${
                            line.type === 'add'
                              ? 'bg-green-50 text-green-900'
                              : line.type === 'remove'
                              ? 'bg-red-50 text-red-900'
                              : 'bg-background'
                          }`}
                        >
                          <span
                            className={`inline-block w-4 ${
                              line.type === 'add'
                                ? 'text-green-600'
                                : line.type === 'remove'
                                ? 'text-red-600'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                          </span>
                          <span className="whitespace-pre">{line.content}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
