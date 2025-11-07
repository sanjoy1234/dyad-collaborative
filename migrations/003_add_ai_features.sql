-- Migration: Add AI Features for Dyad-Style Platform
-- Date: 2025-11-05
-- Description: Adds tables for AI model configs, chats, messages, generations, snapshots, and preview servers

-- AI Model Configurations (User's API keys and model preferences)
CREATE TABLE IF NOT EXISTS ai_model_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('auto', 'openai', 'anthropic', 'google', 'openrouter', 'local')),
    api_key_encrypted TEXT, -- Encrypted using AES-256
    model_name VARCHAR(100), -- e.g., 'gpt-4', 'claude-3-5-sonnet', 'gemini-2.5-flash'
    is_default BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}', -- Additional settings like temperature, max_tokens
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, provider, model_name)
);

CREATE INDEX IF NOT EXISTS idx_ai_model_configs_user ON ai_model_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_model_configs_default ON ai_model_configs(user_id, is_default) WHERE is_default = true;

-- AI Chats (Multiple conversations per project)
CREATE TABLE IF NOT EXISTS ai_chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL DEFAULT 'New Chat',
    model_provider VARCHAR(50), -- Which provider is being used
    model_name VARCHAR(100), -- Which specific model
    created_by UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}', -- Store chat-specific settings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_chats_project ON ai_chats(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_chats_active ON ai_chats(project_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ai_chats_created ON ai_chats(created_at DESC);

-- AI Messages (Chat history)
CREATE TABLE IF NOT EXISTS ai_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES ai_chats(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}', -- Store model, temperature, etc.
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_chat ON ai_messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_messages_role ON ai_messages(chat_id, role);

-- AI Code Generations (Track what AI generated)
CREATE TABLE IF NOT EXISTS ai_generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES ai_chats(id) ON DELETE CASCADE,
    message_id UUID REFERENCES ai_messages(id),
    files_created JSONB DEFAULT '[]', -- Array of file paths created
    files_modified JSONB DEFAULT '[]', -- Array of {path, oldContent, newContent, diff}
    files_deleted JSONB DEFAULT '[]', -- Array of file paths deleted
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'applied')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    snapshot_before UUID, -- Reference to snapshot before changes
    snapshot_after UUID, -- Reference to snapshot after changes
    error_message TEXT, -- If generation failed
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_generations_chat ON ai_generations(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_generations_status ON ai_generations(status);
CREATE INDEX IF NOT EXISTS idx_ai_generations_message ON ai_generations(message_id);

-- Project Snapshots (Version history)
CREATE TABLE IF NOT EXISTS project_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chat_id UUID REFERENCES ai_chats(id),
    generation_id UUID REFERENCES ai_generations(id),
    snapshot_type VARCHAR(50) DEFAULT 'ai_generation' CHECK (snapshot_type IN ('ai_generation', 'manual', 'rollback', 'initial')),
    snapshot_data JSONB NOT NULL, -- Full file tree: {files: [{path, content, fileType}]}
    file_count INTEGER DEFAULT 0,
    total_size_bytes BIGINT DEFAULT 0,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_project ON project_snapshots(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_chat ON project_snapshots(chat_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_generation ON project_snapshots(generation_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_type ON project_snapshots(project_id, snapshot_type);

-- Preview Servers (Track dev server status)
CREATE TABLE IF NOT EXISTS preview_servers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    port INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'stopped' CHECK (status IN ('starting', 'running', 'stopped', 'error')),
    process_id INTEGER,
    command VARCHAR(500), -- The command used to start the server
    framework VARCHAR(50), -- 'react', 'next', 'vite', 'vanilla'
    logs TEXT, -- Recent logs
    error TEXT, -- Error message if status = 'error'
    started_at TIMESTAMP WITH TIME ZONE,
    stopped_at TIMESTAMP WITH TIME ZONE,
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_preview_servers_project ON preview_servers(project_id);
CREATE INDEX IF NOT EXISTS idx_preview_servers_status ON preview_servers(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_preview_servers_port ON preview_servers(port) WHERE status = 'running';

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_model_configs_updated_at BEFORE UPDATE ON ai_model_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_chats_updated_at BEFORE UPDATE ON ai_chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_preview_servers_updated_at BEFORE UPDATE ON preview_servers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add column to projects table for default AI settings
ALTER TABLE projects ADD COLUMN IF NOT EXISTS ai_settings JSONB DEFAULT '{"default_model": "auto", "auto_preview": true, "auto_save": true}';

-- Grant permissions (adjust based on your user setup)
GRANT ALL ON ai_model_configs TO postgres;
GRANT ALL ON ai_chats TO postgres;
GRANT ALL ON ai_messages TO postgres;
GRANT ALL ON ai_generations TO postgres;
GRANT ALL ON project_snapshots TO postgres;
GRANT ALL ON preview_servers TO postgres;

-- Insert default "Auto" model config for all existing users
INSERT INTO ai_model_configs (user_id, provider, model_name, is_default)
SELECT id, 'auto', 'auto', true
FROM users
WHERE NOT EXISTS (
    SELECT 1 FROM ai_model_configs WHERE user_id = users.id AND is_default = true
);

COMMENT ON TABLE ai_model_configs IS 'Stores user API keys and model preferences for AI providers';
COMMENT ON TABLE ai_chats IS 'Multiple conversation threads per project for AI interactions';
COMMENT ON TABLE ai_messages IS 'Chat history including user prompts and AI responses';
COMMENT ON TABLE ai_generations IS 'Tracks code changes generated by AI, pending approval';
COMMENT ON TABLE project_snapshots IS 'Version history snapshots before/after AI modifications';
COMMENT ON TABLE preview_servers IS 'Tracks status of live preview dev servers for projects';
