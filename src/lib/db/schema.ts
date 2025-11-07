import { pgTable, text, timestamp, uuid, jsonb, integer, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: text('role').notNull().default('developer'), // admin, developer, viewer
  avatar_url: text('avatar_url'),
  bio: text('bio'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
  last_login: timestamp('last_login'),
  is_active: boolean('is_active').default(true),
  email_verified: boolean('email_verified').default(false),
}, (table) => ({
  emailIdx: uniqueIndex('users_email_idx').on(table.email),
  usernameIdx: uniqueIndex('users_username_idx').on(table.username),
}));

// Projects table
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  owner_id: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
  settings: jsonb('settings'),
}, (table) => ({
  ownerIdx: index('projects_owner_idx').on(table.owner_id),
  updatedAtIdx: index('projects_updated_at_idx').on(table.updated_at),
}));

// Project collaborators table
export const projectCollaborators = pgTable('project_collaborators', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('editor'), // owner, editor, viewer
  invited_by: uuid('invited_by').notNull().references(() => users.id),
  joined_at: timestamp('joined_at').notNull().defaultNow(),
}, (table) => ({
  projectUserIdx: uniqueIndex('project_collaborators_project_user_idx').on(table.project_id, table.user_id),
  userIdx: index('project_collaborators_user_idx').on(table.user_id),
}));

// Project files table
export const projectFiles = pgTable('project_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  path: text('path').notNull(),
  content: text('content'),
  file_type: text('file_type'),
  size_bytes: integer('size_bytes').default(0),
  version: integer('version').default(1),
  locked_by: uuid('locked_by').references(() => users.id),
  lock_expires_at: timestamp('lock_expires_at'),
  created_by: uuid('created_by').references(() => users.id),
  updated_by: uuid('updated_by').references(() => users.id),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  projectPathIdx: uniqueIndex('project_files_project_path_idx').on(table.project_id, table.path),
  projectIdx: index('project_files_project_idx').on(table.project_id),
  lockedByIdx: index('project_files_locked_by_idx').on(table.locked_by),
}));

// File versions table
export const fileVersions = pgTable('file_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  file_id: uuid('file_id').notNull().references(() => projectFiles.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  content: text('content').notNull(),
  created_by: uuid('created_by').notNull().references(() => users.id),
  created_at: timestamp('created_at').notNull().defaultNow(),
  change_description: text('change_description'),
}, (table) => ({
  fileVersionIdx: uniqueIndex('file_versions_file_version_idx').on(table.file_id, table.version),
  fileIdx: index('file_versions_file_idx').on(table.file_id),
}));

// Active sessions table
export const activeSessions = pgTable('active_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  project_id: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  socket_id: text('socket_id').notNull(),
  cursor_position: jsonb('cursor_position'),
  active_file: uuid('active_file').references(() => projectFiles.id, { onDelete: 'set null' }),
  connected_at: timestamp('connected_at').notNull().defaultNow(),
  last_heartbeat: timestamp('last_heartbeat').notNull().defaultNow(),
}, (table) => ({
  socketIdx: uniqueIndex('active_sessions_socket_idx').on(table.socket_id),
  projectIdx: index('active_sessions_project_idx').on(table.project_id),
  userProjectIdx: index('active_sessions_user_project_idx').on(table.user_id, table.project_id),
}));

// Operations log table
export const operationsLog = pgTable('operations_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  file_id: uuid('file_id').notNull().references(() => projectFiles.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  operation_type: text('operation_type').notNull(), // insert, delete, replace
  position: integer('position').notNull(),
  content: text('content'),
  length: integer('length'),
  version_before: integer('version_before').notNull(),
  version_after: integer('version_after').notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  fileIdx: index('operations_log_file_idx').on(table.file_id),
  projectIdx: index('operations_log_project_idx').on(table.project_id),
  createdAtIdx: index('operations_log_created_at_idx').on(table.created_at),
}));

// Activity log table
export const activityLog = pgTable('activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  activity_type: text('activity_type').notNull(),
  file_id: uuid('file_id').references(() => projectFiles.id, { onDelete: 'set null' }),
  metadata: jsonb('metadata'),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  projectIdx: index('activity_log_project_idx').on(table.project_id),
  userIdx: index('activity_log_user_idx').on(table.user_id),
  createdAtIdx: index('activity_log_created_at_idx').on(table.created_at),
}));

// Notifications table
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // info, warning, error, success
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: boolean('read').notNull().default(false),
  action_url: text('action_url'),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userReadIdx: index('notifications_user_read_idx').on(table.user_id, table.read),
  createdAtIdx: index('notifications_created_at_idx').on(table.created_at),
}));

// Project invitations table - Enhanced for MVP Phase 1
export const projectInvitations = pgTable('project_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').notNull().default('editor'), // 'editor' or 'viewer'
  invited_by: uuid('invited_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  invited_user_id: uuid('invited_user_id').references(() => users.id, { onDelete: 'cascade' }), // Set if user already exists
  token: text('token').notNull().unique(),
  status: text('status').notNull().default('pending'), // 'pending', 'accepted', 'rejected', 'expired', 'revoked'
  expires_at: timestamp('expires_at').notNull(),
  accepted_at: timestamp('accepted_at'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  tokenIdx: uniqueIndex('project_invitations_token_idx').on(table.token),
  projectEmailIdx: index('project_invitations_project_email_idx').on(table.project_id, table.email),
  statusIdx: index('project_invitations_status_idx').on(table.status),
  emailIdx: index('project_invitations_email_idx').on(table.email),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  ownedProjects: many(projects),
  collaborations: many(projectCollaborators),
  sessions: many(activeSessions),
  activities: many(activityLog),
  notifications: many(notifications),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.owner_id],
    references: [users.id],
  }),
  collaborators: many(projectCollaborators),
  files: many(projectFiles),
  sessions: many(activeSessions),
  activities: many(activityLog),
  invitations: many(projectInvitations),
}));

export const projectCollaboratorsRelations = relations(projectCollaborators, ({ one }) => ({
  project: one(projects, {
    fields: [projectCollaborators.project_id],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectCollaborators.user_id],
    references: [users.id],
  }),
}));

export const projectFilesRelations = relations(projectFiles, ({ one, many }) => ({
  project: one(projects, {
    fields: [projectFiles.project_id],
    references: [projects.id],
  }),
  versions: many(fileVersions),
  operations: many(operationsLog),
}));

export const fileVersionsRelations = relations(fileVersions, ({ one }) => ({
  file: one(projectFiles, {
    fields: [fileVersions.file_id],
    references: [projectFiles.id],
  }),
  createdBy: one(users, {
    fields: [fileVersions.created_by],
    references: [users.id],
  }),
}));

export const activeSessionsRelations = relations(activeSessions, ({ one }) => ({
  user: one(users, {
    fields: [activeSessions.user_id],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [activeSessions.project_id],
    references: [projects.id],
  }),
}));

// AI Model Configurations table
export const aiModelConfigs = pgTable('ai_model_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'auto', 'openai', 'anthropic', 'google', 'openrouter', 'local'
  api_key_encrypted: text('api_key_encrypted'),
  model_name: text('model_name'),
  is_default: boolean('is_default').default(false),
  settings: jsonb('settings').default({}),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdx: index('idx_ai_model_configs_user').on(table.user_id),
  defaultIdx: index('idx_ai_model_configs_default').on(table.user_id, table.is_default),
}));

// AI Chats table
export const aiChats = pgTable('ai_chats', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('New Chat'),
  model_provider: text('model_provider'),
  model_name: text('model_name'),
  created_by: uuid('created_by').references(() => users.id),
  is_active: boolean('is_active').default(true),
  metadata: jsonb('metadata').default({}),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  projectIdx: index('idx_ai_chats_project').on(table.project_id),
  activeIdx: index('idx_ai_chats_active').on(table.project_id, table.is_active),
  createdIdx: index('idx_ai_chats_created').on(table.created_at),
}));

// AI Messages table
export const aiMessages = pgTable('ai_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  chat_id: uuid('chat_id').notNull().references(() => aiChats.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user', 'assistant', 'system'
  content: text('content').notNull(),
  tokens_used: integer('tokens_used').default(0),
  metadata: jsonb('metadata').default({}),
  created_by: uuid('created_by').references(() => users.id),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  chatIdx: index('idx_ai_messages_chat').on(table.chat_id, table.created_at),
  roleIdx: index('idx_ai_messages_role').on(table.chat_id, table.role),
}));

// AI Generations table
export const aiGenerations = pgTable('ai_generations', {
  id: uuid('id').primaryKey().defaultRandom(),
  chat_id: uuid('chat_id').notNull().references(() => aiChats.id, { onDelete: 'cascade' }),
  message_id: uuid('message_id').references(() => aiMessages.id),
  files_created: jsonb('files_created').default([]),
  files_modified: jsonb('files_modified').default([]),
  files_deleted: jsonb('files_deleted').default([]),
  status: text('status').notNull().default('pending'), // 'pending', 'approved', 'rejected', 'applied'
  approved_by: uuid('approved_by').references(() => users.id),
  approved_at: timestamp('approved_at'),
  snapshot_before: uuid('snapshot_before'),
  snapshot_after: uuid('snapshot_after'),
  error_message: text('error_message'),
  metadata: jsonb('metadata').default({}),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  chatIdx: index('idx_ai_generations_chat').on(table.chat_id, table.created_at),
  statusIdx: index('idx_ai_generations_status').on(table.status),
  messageIdx: index('idx_ai_generations_message').on(table.message_id),
}));

// Project Snapshots table
export const projectSnapshots = pgTable('project_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  chat_id: uuid('chat_id').references(() => aiChats.id),
  generation_id: uuid('generation_id').references(() => aiGenerations.id),
  snapshot_type: text('snapshot_type').notNull().default('ai_generation'), // 'ai_generation', 'manual', 'rollback', 'initial'
  snapshot_data: jsonb('snapshot_data').notNull(),
  file_count: integer('file_count').default(0),
  total_size_bytes: integer('total_size_bytes').default(0),
  description: text('description'),
  created_by: uuid('created_by').references(() => users.id),
  created_at: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  projectIdx: index('idx_snapshots_project').on(table.project_id, table.created_at),
  chatIdx: index('idx_snapshots_chat').on(table.chat_id),
  generationIdx: index('idx_snapshots_generation').on(table.generation_id),
  typeIdx: index('idx_snapshots_type').on(table.project_id, table.snapshot_type),
}));

// Preview Servers table
export const previewServers = pgTable('preview_servers', {
  id: uuid('id').primaryKey().defaultRandom(),
  project_id: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  port: integer('port').notNull(),
  status: text('status').notNull().default('stopped'), // 'starting', 'running', 'stopped', 'error'
  process_id: integer('process_id'),
  command: text('command'),
  framework: text('framework'), // 'react', 'next', 'vite', 'vanilla'
  logs: text('logs'),
  error: text('error'),
  started_at: timestamp('started_at'),
  stopped_at: timestamp('stopped_at'),
  last_heartbeat: timestamp('last_heartbeat'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  projectIdx: index('idx_preview_servers_project').on(table.project_id),
  statusIdx: index('idx_preview_servers_status').on(table.status),
}));
