-- Store photo binary data directly in the database instead of filesystem
ALTER TABLE measurement_photos
  ADD COLUMN IF NOT EXISTS data BYTEA,
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(50);

-- Drop filename column if it still exists
ALTER TABLE measurement_photos
  DROP COLUMN IF EXISTS filename;
