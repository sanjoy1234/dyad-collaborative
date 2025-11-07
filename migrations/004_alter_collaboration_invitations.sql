-- Migration: Alter project_invitations table to add status and invited_user_id
-- Date: 2025-11-06
-- Description: Adds missing columns for enhanced invitation system

-- Check and add status column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'project_invitations' AND column_name = 'status'
    ) THEN
        ALTER TABLE project_invitations 
        ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'revoked'));
    END IF;
END $$;

-- Check and add invited_user_id column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'project_invitations' AND column_name = 'invited_user_id'
    ) THEN
        ALTER TABLE project_invitations 
        ADD COLUMN invited_user_id UUID REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Check and add accepted_at column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'project_invitations' AND column_name = 'accepted_at'
    ) THEN
        ALTER TABLE project_invitations 
        ADD COLUMN accepted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Check and add updated_at column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'project_invitations' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE project_invitations 
        ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Migrate existing 'accepted' boolean to new 'status' column if needed
UPDATE project_invitations 
SET status = CASE 
    WHEN accepted = true THEN 'accepted'
    ELSE 'pending'
END
WHERE status = 'pending' AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_invitations' AND column_name = 'accepted'
);

-- Drop the old 'accepted' column if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'project_invitations' AND column_name = 'accepted'
    ) THEN
        ALTER TABLE project_invitations DROP COLUMN accepted;
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_project_invitations_status ON project_invitations(status);
CREATE INDEX IF NOT EXISTS idx_project_invitations_email ON project_invitations(email);
CREATE INDEX IF NOT EXISTS idx_project_invitations_expires_at ON project_invitations(expires_at) WHERE status = 'pending';

-- Create unique constraint to prevent duplicate pending invitations
DROP INDEX IF EXISTS idx_project_invitations_unique_pending;
CREATE UNIQUE INDEX idx_project_invitations_unique_pending 
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

-- Add comments
COMMENT ON COLUMN project_invitations.status IS 'pending: not yet acted upon, accepted: collaborator added, rejected: invitation declined, expired: past expiration date, revoked: cancelled by inviter';
COMMENT ON COLUMN project_invitations.invited_user_id IS 'Set when email matches existing user, NULL for new users';
