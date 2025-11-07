'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  ChevronRight,
  ChevronDown,
  Home,
  Settings,
  Eye,
  Code,
  PanelLeftClose,
  PanelRightClose,
  RefreshCw,
  X,
} from 'lucide-react';
import { Project, ProjectFile, ProjectCollaborator } from '@/types';
import { ChatInterface } from '@/components/ai/ChatInterface';
import { CodeDiffViewer } from '@/components/ai/CodeDiffViewer';
import { ModelConfigModal } from '@/components/ai/ModelConfigModal';
import { CollaboratorsList } from '@/components/collaboration/CollaboratorsList';
import { useCollaboration } from '@/hooks/useCollaboration';
import dynamic from 'next/dynamic';

// Dynamically import Monaco Editor to avoid SSR issues
const MonacoEditor = dynamic(
  () => import('@/components/editor/MonacoEditor').then((mod) => mod.MonacoEditor),
  { ssr: false }
);

interface DyadEditorClientProps {
  project: Project;
  files: ProjectFile[];
  collaborators: ProjectCollaborator[];
  currentUser: {
    id: string;
    email?: string | null;
    name?: string | null;
  };
  userRole: string;
}

interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileTreeNode[];
  file?: ProjectFile;
}

export function DyadEditorClient({
  project,
  files: initialFiles,
  collaborators,
  currentUser,
  userRole,
}: DyadEditorClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  
  // State
  const [files, setFiles] = useState<ProjectFile[]>(initialFiles);
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']));
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null);
  const [modelConfigOpen, setModelConfigOpen] = useState(false);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  // Panel visibility
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [collaboratorsPanelOpen, setCollaboratorsPanelOpen] = useState(false);
  
  // View mode for center panel
  const [centerView, setCenterView] = useState<'preview' | 'code' | 'diff'>('preview');
  
  // File content editing
  const [fileContent, setFileContent] = useState<string>('');
  const [isFileModified, setIsFileModified] = useState(false);

  // Real-time collaboration
  const collaboration = useCollaboration({
    projectId: project.id,
    userId: currentUser.id,
    enabled: true,
  });

  useEffect(() => {
    // Load model configuration
    loadModelConfig();
    
    // Initialize Socket.IO server
    fetch('/api/socket').catch((error) => {
      console.error('Failed to initialize Socket.IO:', error);
    });
  }, []);

  const loadModelConfig = async () => {
    try {
      const response = await fetch('/api/ai/models/config');
      if (response.ok) {
        const data = await response.json();
        if (data.model) {
          setCurrentModel(data.model);
        }
      }
    } catch (error) {
      console.error('Failed to load model config:', error);
    }
  };

  const refreshFiles = async () => {
    try {
      const response = await fetch(`/api/projects/${project.id}/files`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
        toast({
          title: 'Files Refreshed',
          description: 'File tree updated successfully',
        });
      }
    } catch (error) {
      console.error('Failed to refresh files:', error);
      toast({
        title: 'Error',
        description: 'Failed to refresh files',
        variant: 'destructive',
      });
    }
  };

  // Build file tree from flat file list
  const buildFileTree = useCallback((fileList: ProjectFile[]): FileTreeNode[] => {
    const root: FileTreeNode = { name: '', path: '/', type: 'folder', children: [] };

    fileList.forEach((file) => {
      const parts = file.path.split('/').filter(Boolean);
      let current = root;

      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        const currentPath = '/' + parts.slice(0, index + 1).join('/');

        if (!current.children) {
          current.children = [];
        }

        let child = current.children.find((c) => c.name === part);

        if (!child) {
          child = {
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'folder',
            children: isFile ? undefined : [],
            file: isFile ? file : undefined,
          };
          current.children.push(child);
        }

        if (!isFile) {
          current = child;
        }
      });
    });

    // Sort: folders first, then files, alphabetically
    const sortNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
      return nodes.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'folder' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    };

    const sortRecursive = (node: FileTreeNode) => {
      if (node.children) {
        node.children = sortNodes(node.children);
        node.children.forEach(sortRecursive);
      }
    };

    sortRecursive(root);
    return root.children || [];
  }, []);

  const fileTree = buildFileTree(files);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleFileSelect = (file: ProjectFile) => {
    setSelectedFile(file);
    setFileContent(file.content || '');
    setIsFileModified(false);
    setCenterView('code');
    
    // Notify collaboration about file open
    collaboration.openFile(file.id, file.path);
  };
  
  const handleFileContentChange = (newContent: string) => {
    setFileContent(newContent);
    setIsFileModified(newContent !== (selectedFile?.content || ''));
  };
  
  const handleSaveFile = async () => {
    if (!selectedFile || !isFileModified) return;
    
    try {
      const response = await fetch(`/api/projects/${project.id}/files/${selectedFile.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: fileContent,
        }),
      });
      
      if (response.ok) {
        const updatedFile = await response.json();
        setFiles(files.map(f => f.id === selectedFile.id ? updatedFile : f));
        setSelectedFile(updatedFile);
        setIsFileModified(false);
        
        toast({
          title: 'File Saved',
          description: `${selectedFile.path} has been saved`,
        });
      } else {
        throw new Error('Failed to save file');
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      toast({
        title: 'Error',
        description: 'Failed to save file',
        variant: 'destructive',
      });
    }
  };

  const handleFileToggleForContext = (path: string) => {
    setSelectedFiles((prev) => {
      if (prev.includes(path)) {
        return prev.filter((p) => p !== path);
      } else {
        return [...prev, path];
      }
    });
  };

  const handleGenerationComplete = (generationId: string) => {
    setCurrentGenerationId(generationId);
    setCenterView('diff');
  };

  const handleApproveReject = async () => {
    // Refresh files after approval/rejection
    await refreshFiles();
    setCurrentGenerationId(null);
    setCenterView('preview');
    // Refresh preview if it was running
    if (previewUrl) {
      await startPreview();
    }
  };

  const startPreview = async () => {
    setPreviewLoading(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/preview/start`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setPreviewUrl(data.url);
        toast({
          title: 'Preview Started',
          description: `Server running on port ${data.server.port}`,
        });
      } else {
        const error = await response.json();
        toast({
          title: 'Preview Error',
          description: error.error || 'Failed to start preview',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to start preview:', error);
      toast({
        title: 'Error',
        description: 'Failed to start preview server',
        variant: 'destructive',
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const stopPreview = async () => {
    try {
      await fetch(`/api/projects/${project.id}/preview/start`, {
        method: 'DELETE',
      });
      setPreviewUrl(null);
      toast({
        title: 'Preview Stopped',
        description: 'Server has been stopped',
      });
    } catch (error) {
      console.error('Failed to stop preview:', error);
    }
  };

  const renderFileTree = (nodes: FileTreeNode[], depth = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedFolders.has(node.path);
      const isSelected = selectedFiles.includes(node.path);
      const isCurrentFile = selectedFile?.id === node.file?.id;

      if (node.type === 'folder') {
        return (
          <div key={node.path}>
            <div
              className={`flex items-center gap-2 px-2 py-1.5 hover:bg-muted cursor-pointer rounded-sm ${
                isCurrentFile ? 'bg-muted' : ''
              }`}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              onClick={() => toggleFolder(node.path)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 flex-shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 flex-shrink-0" />
              )}
              {isExpanded ? (
                <FolderOpenIcon className="h-4 w-4 flex-shrink-0 text-blue-500" />
              ) : (
                <FolderIcon className="h-4 w-4 flex-shrink-0 text-blue-500" />
              )}
              <span className="text-sm truncate">{node.name}</span>
            </div>
            {isExpanded && node.children && (
              <div>{renderFileTree(node.children, depth + 1)}</div>
            )}
          </div>
        );
      } else {
        return (
          <div
            key={node.path}
            className={`flex items-center gap-2 px-2 py-1.5 hover:bg-muted cursor-pointer rounded-sm ${
              isCurrentFile ? 'bg-primary text-primary-foreground' : ''
            } ${isSelected ? 'bg-blue-50' : ''}`}
            style={{ paddingLeft: `${depth * 12 + 24}px` }}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => handleFileToggleForContext(node.path)}
              onClick={(e) => e.stopPropagation()}
              className="h-3 w-3"
            />
            <FileIcon className="h-4 w-4 flex-shrink-0" />
            <span
              className="text-sm truncate flex-1"
              onClick={() => node.file && handleFileSelect(node.file)}
            >
              {node.name}
            </span>
          </div>
        );
      }
    });
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Top Bar */}
      <div className="h-14 border-b flex items-center justify-between px-4 bg-background">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard')}
          >
            <Home className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <h1 className="font-semibold">{project.name}</h1>
          {project.settings && typeof project.settings === 'object' && 'framework' in project.settings && project.settings.framework && (
            <Badge variant="secondary">{String(project.settings.framework)}</Badge>
          )}
          {/* Real-time collaboration status */}
          {collaboration.isConnected && (
            <div className="flex items-center gap-2 ml-4">
              <div className="flex -space-x-2">
                {collaboration.activeUsers.slice(0, 3).map((user) => (
                  <div
                    key={user.userId}
                    className="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-xs font-medium text-white"
                    style={{ backgroundColor: user.color }}
                    title={`${user.username} (${user.role})`}
                  >
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                ))}
                {collaboration.activeUsers.length > 3 && (
                  <div className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium">
                    +{collaboration.activeUsers.length - 3}
                  </div>
                )}
              </div>
              <Badge variant="outline" className="text-green-600 border-green-600">
                <div className="w-2 h-2 rounded-full bg-green-600 mr-1 animate-pulse" />
                Live
              </Badge>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isFileModified && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveFile}
            >
              Save File
            </Button>
          )}
          <Button
            variant={collaboratorsPanelOpen ? "secondary" : "outline"}
            size="sm"
            onClick={() => setCollaboratorsPanelOpen(!collaboratorsPanelOpen)}
          >
            Collaborators ({collaborators.length})
          </Button>
          {previewUrl ? (
            <Button
              variant="outline"
              size="sm"
              onClick={stopPreview}
            >
              <X className="h-4 w-4 mr-2" />
              Stop Preview
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={startPreview}
              disabled={previewLoading}
            >
              {previewLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              Start Preview
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setModelConfigOpen(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Configure Model
          </Button>
        </div>
      </div>

      {/* Main 3-Panel Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Panel - File Explorer */}
        {leftPanelOpen && (
          <div className="w-80 border-r flex flex-col bg-background">
            <div className="p-3 border-b flex items-center justify-between">
              <h2 className="font-semibold text-sm">Files</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLeftPanelOpen(false)}
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2">{renderFileTree(fileTree)}</div>
            </ScrollArea>
            {selectedFiles.length > 0 && (
              <div className="p-3 border-t bg-muted/50">
                <p className="text-xs text-muted-foreground">
                  {selectedFiles.length} file(s) selected for AI context
                </p>
              </div>
            )}
          </div>
        )}

        {!leftPanelOpen && (
          <div className="w-12 border-r flex flex-col items-center py-2 bg-background">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLeftPanelOpen(true)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Center Panel - Preview/Code/Diff */}
        <div className="flex-1 flex flex-col bg-background">
          <Tabs value={centerView} onValueChange={(v) => setCenterView(v as any)} className="flex flex-col h-full">
            <div className="border-b px-4 flex-shrink-0">
              <TabsList>
                <TabsTrigger value="preview">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="code">
                  <Code className="h-4 w-4 mr-2" />
                  Code
                </TabsTrigger>
                <TabsTrigger value="diff">
                  <FileIcon className="h-4 w-4 mr-2" />
                  Diff
                  {currentGenerationId && (
                    <Badge variant="secondary" className="ml-2">
                      1
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="preview" className="flex-1 m-0 p-0">
              {previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              ) : (
                <div className="h-full flex items-center justify-center border rounded-lg bg-muted/50 m-4">
                  <div className="text-center">
                    <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">Preview not available</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Click "Start Preview" above to see your app running
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={startPreview}
                      disabled={previewLoading}
                    >
                      {previewLoading ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Starting...
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-2" />
                          Start Preview
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="code" className="flex-1 m-0 overflow-hidden">
              {selectedFile ? (
                <div className="h-full flex flex-col overflow-hidden">
                  <div className="px-4 py-2 border-b flex items-center justify-between bg-muted/50">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{selectedFile.path}</span>
                      <Badge variant="secondary">{selectedFile.file_type}</Badge>
                      {isFileModified && (
                        <Badge variant="outline" className="text-orange-600">
                          Modified
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isFileModified && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={handleSaveFile}
                        >
                          Save
                        </Button>
                      )}
                      {userRole === 'viewer' && (
                        <Badge variant="secondary">Read-only</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <MonacoEditor
                      value={fileContent}
                      onChange={handleFileContentChange}
                      language={selectedFile.file_type}
                      readOnly={userRole === 'viewer'}
                      path={selectedFile.path}
                    />
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a file to view its contents</p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="diff" className="flex-1 m-0">
              <CodeDiffViewer
                generationId={currentGenerationId}
                onApprove={handleApproveReject}
                onReject={handleApproveReject}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Panel - Chat */}
        {rightPanelOpen && (
          <div className="w-96 border-l flex flex-col bg-background">
            <ChatInterface
              projectId={project.id}
              selectedFiles={selectedFiles}
              onGenerationComplete={handleGenerationComplete}
              onOpenModelConfig={() => setModelConfigOpen(true)}
              currentModel={currentModel}
            />
          </div>
        )}

        {!rightPanelOpen && (
          <div className="w-12 border-l flex flex-col items-center py-2 bg-background">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRightPanelOpen(true)}
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
            </Button>
          </div>
        )}
        
        {/* Collaborators Panel - Overlay on right side */}
        {collaboratorsPanelOpen && (
          <div className="absolute right-0 top-14 bottom-0 w-96 bg-background border-l shadow-lg z-10 flex flex-col">
            <div className="p-3 border-b flex items-center justify-between">
              <h2 className="font-semibold text-sm">Collaborators</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCollaboratorsPanelOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4">
                <CollaboratorsList
                  projectId={project.id}
                  projectName={project.name}
                  currentUserId={currentUser.id}
                  isOwner={project.owner_id === currentUser.id}
                />
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Model Config Modal */}
      <ModelConfigModal
        open={modelConfigOpen}
        onOpenChange={setModelConfigOpen}
        onSave={(config) => {
          setCurrentModel(config.model);
          loadModelConfig();
        }}
      />
    </div>
  );
}
