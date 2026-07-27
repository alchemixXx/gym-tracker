-- Food items (products: rice, lentils, chicken, etc.)
CREATE TABLE IF NOT EXISTS food_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Cooking batches (raw weight → cooked weight per cook)
CREATE TABLE IF NOT EXISTS cooking_batches (
  id SERIAL PRIMARY KEY,
  food_item_id INTEGER NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
  raw_weight DECIMAL(7,1) NOT NULL,
  cooked_weight DECIMAL(7,1) NOT NULL,
  cooked_at TIMESTAMP DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_food_items_user_id ON food_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cooking_batches_food_item_id ON cooking_batches(food_item_id);
