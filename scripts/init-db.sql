-- Dyad Collaborative Database Schema
-- PostgreSQL 16+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'developer' CHECK (role IN ('admin', 'developer', 'viewer')),
  avatar_url VARCHAR(500),
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  visibility VARCHAR(50) DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'public')),
  max_collaborators INT DEFAULT 10,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_max_collaborators CHECK (max_collaborators > 0 AND max_collaborators <= 100)
);

-- Project collaborators
CREATE TABLE IF NOT EXISTS project_collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_by UUID REFERENCES users(id),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Project files
CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  path VARCHAR(1000) NOT NULL,
  content TEXT,
  file_type VARCHAR(100),
  size_bytes BIGINT DEFAULT 0,
  version INT DEFAULT 1,
  locked_by UUID REFERENCES users(id),
  lock_expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, path),
  CONSTRAINT valid_version CHECK (version > 0)
);

-- File versions (history)
CREATE TABLE IF NOT EXISTS file_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID REFERENCES project_files(id) ON DELETE CASCADE,
  version INT NOT NULL,
  content TEXT,
  size_bytes BIGINT DEFAULT 0,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  change_description TEXT,
  diff TEXT,  -- Store the diff for efficient history browsing
  UNIQUE(file_id, version)
);

-- Active sessions
CREATE TABLE IF NOT EXISTS active_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  socket_id VARCHAR(255) UNIQUE,
  ip_address INET,
  user_agent TEXT,
  cursor_position JSONB DEFAULT '{}',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  disconnected_at TIMESTAMP WITH TIME ZONE
);

-- Collaboration operations log
CREATE TABLE IF NOT EXISTS operations_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_id UUID REFERENCES project_files(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  operation_type VARCHAR(50) NOT NULL,
  operation_data JSONB NOT NULL,
  version INT NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project activity log
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Project invitations
CREATE TABLE IF NOT EXISTS project_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'editor',
  invited_by UUID REFERENCES users(id),
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_visibility ON projects(visibility);
CREATE INDEX idx_projects_deleted ON projects(deleted_at);
CREATE INDEX idx_projects_name_search ON projects USING gin(name gin_trgm_ops);

CREATE INDEX idx_collaborators_project ON project_collaborators(project_id);
CREATE INDEX idx_collaborators_user ON project_collaborators(user_id);
CREATE INDEX idx_collaborators_active ON project_collaborators(last_active DESC);

CREATE INDEX idx_files_project ON project_files(project_id);
CREATE INDEX idx_files_path ON project_files(path);
CREATE INDEX idx_files_locked ON project_files(locked_by) WHERE locked_by IS NOT NULL;
CREATE INDEX idx_files_updated ON project_files(updated_at DESC);

CREATE INDEX idx_versions_file ON file_versions(file_id);
CREATE INDEX idx_versions_file_version ON file_versions(file_id, version DESC);

CREATE INDEX idx_sessions_user ON active_sessions(user_id);
CREATE INDEX idx_sessions_project ON active_sessions(project_id);
CREATE INDEX idx_sessions_socket ON active_sessions(socket_id);
CREATE INDEX idx_sessions_active ON active_sessions(last_activity DESC) WHERE disconnected_at IS NULL;

CREATE INDEX idx_operations_project_file ON operations_log(project_id, file_id);
CREATE INDEX idx_operations_version ON operations_log(version);
CREATE INDEX idx_operations_applied ON operations_log(applied_at DESC);

CREATE INDEX idx_activity_project ON activity_log(project_id);
CREATE INDEX idx_activity_user ON activity_log(user_id);
CREATE INDEX idx_activity_created ON activity_log(created_at DESC);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read) WHERE read = false;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

CREATE INDEX idx_invitations_project ON project_invitations(project_id);
CREATE INDEX idx_invitations_email ON project_invitations(email);
CREATE INDEX idx_invitations_token ON project_invitations(token);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON project_files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired locks
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS void AS $$
BEGIN
    UPDATE project_files
    SET locked_by = NULL, lock_expires_at = NULL
    WHERE lock_expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old sessions
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS void AS $$
BEGIN
    UPDATE active_sessions
    SET disconnected_at = NOW()
    WHERE last_activity < NOW() - INTERVAL '1 hour'
    AND disconnected_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Views for convenience
CREATE OR REPLACE VIEW active_project_users AS
SELECT 
    p.id as project_id,
    p.name as project_name,
    u.id as user_id,
    u.username,
    u.avatar_url,
    s.cursor_position,
    s.last_activity,
    pc.role
FROM projects p
JOIN active_sessions s ON p.id = s.project_id
JOIN users u ON s.user_id = u.id
JOIN project_collaborators pc ON pc.project_id = p.id AND pc.user_id = u.id
WHERE s.disconnected_at IS NULL
AND s.last_activity > NOW() - INTERVAL '5 minutes';

CREATE OR REPLACE VIEW project_stats AS
SELECT 
    p.id as project_id,
    p.name,
    COUNT(DISTINCT pc.user_id) as total_collaborators,
    COUNT(DISTINCT s.user_id) as active_users,
    COUNT(DISTINCT f.id) as total_files,
    SUM(f.size_bytes) as total_size_bytes,
    MAX(f.updated_at) as last_file_update,
    COUNT(DISTINCT al.id) as recent_activities
FROM projects p
LEFT JOIN project_collaborators pc ON p.id = pc.project_id
LEFT JOIN active_sessions s ON p.id = s.project_id AND s.disconnected_at IS NULL
LEFT JOIN project_files f ON p.id = f.project_id
LEFT JOIN activity_log al ON p.id = al.project_id AND al.created_at > NOW() - INTERVAL '24 hours'
GROUP BY p.id, p.name;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database schema created successfully!';
END $$;
