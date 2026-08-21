-- Store actual workout duration in seconds
ALTER TABLE program_days ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
