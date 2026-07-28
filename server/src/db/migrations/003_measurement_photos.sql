-- Measurement photos for visual comparison
CREATE TABLE IF NOT EXISTS measurement_photos (
  id SERIAL PRIMARY KEY,
  measurement_id INTEGER NOT NULL REFERENCES body_measurements(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_measurement_photos_measurement_id ON measurement_photos(measurement_id);
