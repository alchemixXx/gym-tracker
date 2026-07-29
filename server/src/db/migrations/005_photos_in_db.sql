-- Store photo binary data directly in the database instead of filesystem
ALTER TABLE measurement_photos
  ADD COLUMN data BYTEA,
  ADD COLUMN mime_type VARCHAR(50);

-- Migrate existing photos: we drop the filename column after data is populated
-- For existing rows without data, they will need to be re-uploaded
ALTER TABLE measurement_photos
  DROP COLUMN filename;
