-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Templates
CREATE TABLE IF NOT EXISTS templates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS template_days (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS template_exercises (
  id SERIAL PRIMARY KEY,
  template_day_id INTEGER NOT NULL REFERENCES template_days(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS template_sets (
  id SERIAL PRIMARY KEY,
  template_exercise_id INTEGER NOT NULL REFERENCES template_exercises(id) ON DELETE CASCADE,
  weight DECIMAL(6,1),
  reps INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Programs
CREATE TABLE IF NOT EXISTS programs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  start_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS program_days (
  id SERIAL PRIMARY KEY,
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  day_note TEXT,
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS program_exercises (
  id SERIAL PRIMARY KEY,
  program_day_id INTEGER NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  note TEXT
);

CREATE TABLE IF NOT EXISTS program_sets (
  id SERIAL PRIMARY KEY,
  program_exercise_id INTEGER NOT NULL REFERENCES program_exercises(id) ON DELETE CASCADE,
  weight DECIMAL(6,1),
  reps INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Body Measurements
CREATE TABLE IF NOT EXISTS body_measurements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight DECIMAL(5,1),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS measurement_entries (
  id SERIAL PRIMARY KEY,
  measurement_id INTEGER NOT NULL REFERENCES body_measurements(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  value DECIMAL(6,1) NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_programs_user_id ON programs(user_id);
CREATE INDEX IF NOT EXISTS idx_body_measurements_user_id ON body_measurements(user_id);
CREATE INDEX IF NOT EXISTS idx_body_measurements_date ON body_measurements(user_id, date);
