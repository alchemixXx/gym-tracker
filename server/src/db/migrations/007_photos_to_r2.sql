-- Migrate photo storage from DB (BYTEA) to Cloudflare R2 (store URL + key reference)
ALTER TABLE measurement_photos
  ADD COLUMN IF NOT EXISTS url TEXT,
  ADD COLUMN IF NOT EXISTS storage_key TEXT;

-- Drop the binary data column — no longer needed
ALTER TABLE measurement_photos
  DROP COLUMN IF EXISTS data;
