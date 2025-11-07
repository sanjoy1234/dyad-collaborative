-- Migration: Add Enhanced Project Invitations for Real-Time Collaboration
-- Date: 2025-11-06
-- Description: Creates/enhances project invitations table with status tracking and proper constraints
-- Phase: MVP Phase 1 - Invitation System

-- Create or enhance project_invitations table
CREATE TABLE IF NOT EXISTS project_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'revoked')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_project_invitations_token ON project_invitations(token);
CREATE INDEX IF NOT EXISTS idx_project_invitations_project_email ON project_invitations(project_id, email);
CREATE INDEX IF NOT EXISTS idx_project_invitations_status ON project_invitations(status);
CREATE INDEX IF NOT EXISTS idx_project_invitations_email ON project_invitations(email);
CREATE INDEX IF NOT EXISTS idx_project_invitations_expires_at ON project_invitations(expires_at) WHERE status = 'pending';

-- Add composite unique constraint to prevent duplicate pending invitations
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_invitations_unique_pending 
    ON project_invitations(project_id, email) 
    WHERE status = 'pending';

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_project_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
DROP TRIGGER IF EXISTS trigger_update_project_invitations_updated_at ON project_invitations;
CREATE TRIGGER trigger_update_project_invitations_updated_at
    BEFORE UPDATE ON project_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_project_invitations_updated_at();

-- Function to auto-expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
    UPDATE project_invitations
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'pending' 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comment on table and important columns
COMMENT ON TABLE project_invitations IS 'Stores project collaboration invitations for MVP Phase 1';
COMMENT ON COLUMN project_invitations.status IS 'pending: not yet acted upon, accepted: collaborator added, rejected: invitation declined, expired: past expiration date, revoked: cancelled by inviter';
COMMENT ON COLUMN project_invitations.token IS 'Unique token used in invitation URL for accepting invitation';
COMMENT ON COLUMN project_invitations.invited_user_id IS 'Set when email matches existing user, NULL for new users';
