-- Add started_at to track when a training session was started
ALTER TABLE program_days ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
