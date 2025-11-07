// Type definitions for Dyad Collaborative Platform

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: 'admin' | 'developer' | 'viewer';
  created_at: string;
  last_login?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  owner_id: string;
  created_at: string | Date;
  updated_at: string | Date;
  settings?: ProjectSettings | unknown;
}

export interface ProjectSettings {
  language?: string;
  framework?: string;
  theme?: string;
  autoSave?: boolean;
  tabSize?: number;
}

export interface ProjectCollaborator {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  invited_by: string;
  joined_at: Date | string;
  user?: User;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  path: string;
  content: string | null;
  file_type?: string | null;
  size_bytes?: number | null;
  version?: number | null;
  locked_by?: string | null;
  lock_expires_at?: Date | string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
}

export interface FileVersion {
  id: string;
  file_id: string;
  version: number;
  content: string;
  created_by: string;
  created_at: string;
  change_description?: string;
}

export interface ActiveSession {
  id: string;
  user_id: string;
  project_id: string;
  socket_id: string;
  cursor_position?: CursorPosition;
  active_file?: string;
  connected_at: string;
  last_heartbeat: string;
  user?: User;
}

export interface CursorPosition {
  line: number;
  column: number;
  fileId?: string;
}

export interface Operation {
  id: string;
  type: 'insert' | 'delete' | 'replace';
  position: number;
  content?: string;
  length?: number;
  userId: string;
  fileId: string;
  timestamp: number;
  version: number;
}

export interface OperationLog {
  id: string;
  project_id: string;
  file_id: string;
  user_id: string;
  operation_type: 'insert' | 'delete' | 'replace';
  position: number;
  content?: string;
  length?: number;
  version_before: number;
  version_after: number;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  project_id: string;
  user_id: string;
  activity_type: 'file_created' | 'file_updated' | 'file_deleted' | 
                 'user_joined' | 'user_left' | 'project_created' | 
                 'project_updated' | 'collaborator_added' | 'collaborator_removed';
  file_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  user?: User;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  read: boolean;
  action_url?: string;
  created_at: string;
}

// WebSocket Events
export interface WebSocketEvent {
  type: string;
  payload: any;
  timestamp: number;
}

export interface JoinProjectEvent {
  projectId: string;
  userId: string;
}

export interface LeaveProjectEvent {
  projectId: string;
  userId: string;
}

export interface FileOpenEvent {
  fileId: string;
  userId: string;
  projectId: string;
}

export interface FileCloseEvent {
  fileId: string;
  userId: string;
  projectId: string;
}

export interface OperationEvent {
  operation: Operation;
  projectId: string;
}

export interface CursorMoveEvent {
  userId: string;
  fileId: string;
  position: CursorPosition;
  projectId: string;
}

export interface FileLockEvent {
  fileId: string;
  userId: string;
  locked: boolean;
  projectId: string;
}

export interface PresenceUpdate {
  userId: string;
  projectId: string;
  activeFile?: string;
  cursorPosition?: CursorPosition;
  status: 'online' | 'idle' | 'offline';
}

// UI State Types
export interface EditorState {
  activeFile?: ProjectFile;
  openFiles: ProjectFile[];
  unsavedChanges: Map<string, boolean>;
  cursorPosition: CursorPosition;
}

export interface CollaboratorState {
  collaborators: Map<string, ActiveSession>;
  cursors: Map<string, CursorPosition>;
}

export interface ProjectState {
  currentProject?: Project;
  projects: Project[];
  files: ProjectFile[];
  collaborators: ProjectCollaborator[];
  activities: ActivityLog[];
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Auth Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface AuthSession {
  user: User;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

// File Tree Types
export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  isOpen?: boolean;
  isLocked?: boolean;
  lockedBy?: string;
}

// Conflict Resolution Types
export interface Conflict {
  id: string;
  fileId: string;
  operations: Operation[];
  detectedAt: number;
  resolvedBy?: string;
  resolution?: 'accept_local' | 'accept_remote' | 'merge';
}

// Settings Types
export interface UserSettings {
  theme: 'light' | 'dark' | 'auto';
  fontSize: number;
  tabSize: number;
  autoSave: boolean;
  autoSaveDelay: number;
  showMinimap: boolean;
  wordWrap: 'on' | 'off' | 'wordWrapColumn';
  notifications: {
    email: boolean;
    push: boolean;
    activity: boolean;
  };
}

export interface ProjectInvitation {
  id: string;
  project_id: string;
  email: string;
  role: 'editor' | 'viewer';
  invited_by: string;
  token: string;
  expires_at: string;
  accepted: boolean;
  created_at: string;
  project?: Project;
}

// ============================================
// AI Features Types (Dyad-Style)
// ============================================

export type AIProvider = 'auto' | 'openai' | 'anthropic' | 'google' | 'openrouter' | 'local';

export type AIModel = 
  // OpenAI Models
  | 'gpt-4' 
  | 'gpt-4-turbo' 
  | 'gpt-4.1-mini'
  | 'gpt-3.5-turbo'
  // Anthropic Models
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-opus-20240229'
  | 'claude-3-sonnet-20240229'
  | 'claude-3-haiku-20240307'
  // Google Models
  | 'gemini-2.5-flash'
  | 'gemini-2.5-pro'
  | 'gemini-1.5-flash'
  | 'gemini-1.5-pro'
  // OpenRouter Models
  | 'deepseek/deepseek-v3'
  | 'anthropic/claude-3.5-sonnet'
  | 'google/gemini-pro-1.5'
  // Local Models
  | 'ollama/codellama'
  | 'ollama/llama3.1'
  // Auto
  | 'auto';

export interface AIModelConfig {
  id: string;
  user_id: string;
  provider: AIProvider;
  api_key_encrypted?: string;
  model_name?: AIModel | string;
  is_default: boolean;
  settings?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
  };
  created_at: string | Date;
  updated_at: string | Date;
}

export interface AIChat {
  id: string;
  project_id: string;
  name: string;
  model_provider?: AIProvider;
  model_name?: AIModel | string;
  created_by?: string;
  is_active: boolean;
  metadata?: {
    message_count?: number;
    total_tokens?: number;
    last_activity?: string;
  };
  created_at: string | Date;
  updated_at: string | Date;
}

export type AIMessageRole = 'user' | 'assistant' | 'system';

export interface AIMessage {
  id: string;
  chat_id: string;
  role: AIMessageRole;
  content: string;
  tokens_used?: number;
  metadata?: {
    model?: string;
    temperature?: number;
    finish_reason?: string;
    error?: string;
  };
  created_by?: string;
  created_at: string | Date;
}

export type GenerationStatus = 'pending' | 'approved' | 'rejected' | 'applied';

export interface FileChange {
  path: string;
  oldContent?: string;
  newContent: string;
  diff?: string;
  action: 'create' | 'modify' | 'delete';
}

export interface AIGeneration {
  id: string;
  chat_id: string;
  message_id?: string;
  files_created: FileChange[];
  files_modified: FileChange[];
  files_deleted: string[];
  status: GenerationStatus;
  approved_by?: string;
  approved_at?: string | Date;
  snapshot_before?: string;
  snapshot_after?: string;
  error_message?: string;
  metadata?: {
    total_files_changed?: number;
    lines_added?: number;
    lines_removed?: number;
  };
  created_at: string | Date;
}

export type SnapshotType = 'ai_generation' | 'manual' | 'rollback' | 'initial';

export interface ProjectSnapshot {
  id: string;
  project_id: string;
  chat_id?: string;
  generation_id?: string;
  snapshot_type: SnapshotType;
  snapshot_data: {
    files: Array<{
      path: string;
      content: string;
      file_type: string;
    }>;
  };
  file_count: number;
  total_size_bytes: number;
  description?: string;
  created_by?: string;
  created_at: string | Date;
}

export type PreviewServerStatus = 'starting' | 'running' | 'stopped' | 'error';
export type Framework = 'react' | 'next' | 'vite' | 'vanilla' | 'unknown';

export interface PreviewServer {
  id: string;
  project_id: string;
  port: number;
  status: PreviewServerStatus;
  process_id?: number;
  command?: string;
  framework?: Framework;
  logs?: string;
  error?: string;
  started_at?: string | Date;
  stopped_at?: string | Date;
  last_heartbeat?: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
}

// Chat UI Types
export interface ChatMessage extends AIMessage {
  isStreaming?: boolean;
  generation?: AIGeneration;
}

export interface CodeDiff {
  path: string;
  language: string;
  oldCode: string;
  newCode: string;
  diff: string;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

// API Request/Response Types
export interface CreateChatRequest {
  project_id: string;
  name?: string;
  model_provider?: AIProvider;
  model_name?: AIModel | string;
}

export interface SendMessageRequest {
  chat_id: string;
  content: string;
  model_provider?: AIProvider;
  model_name?: AIModel | string;
}

export interface SendMessageResponse {
  message: AIMessage;
  generation?: AIGeneration;
  stream?: ReadableStream;
}

export interface ApproveGenerationRequest {
  generation_id: string;
  create_snapshot?: boolean;
}

export interface ModelAvailability {
  provider: AIProvider;
  models: Array<{
    name: AIModel | string;
    display_name: string;
    description?: string;
    context_window?: number;
    pricing?: {
      input_per_1k_tokens?: number;
      output_per_1k_tokens?: number;
    };
    is_free?: boolean;
    requires_api_key: boolean;
  }>;
}
