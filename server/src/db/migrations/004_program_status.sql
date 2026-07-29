-- Add status column to programs: pending, active, completed
ALTER TABLE programs ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
