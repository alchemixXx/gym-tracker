import { Router } from 'express';
import { pool } from '../db/pool.js';

export const foodRoutes = Router();

// GET /api/users/:userId/food-items — list food items
foodRoutes.get('/:userId/food-items', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM food_items WHERE user_id = $1 ORDER BY name ASC',
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch food items' });
  }
});

// POST /api/users/:userId/food-items — create food item
foodRoutes.post('/:userId/food-items', async (req, res) => {
  const { userId } = req.params;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO food_items (user_id, name) VALUES ($1, $2) RETURNING *',
      [userId, name.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create food item' });
  }
});

// PUT /api/users/:userId/food-items/:id — update food item
foodRoutes.put('/:userId/food-items/:id', async (req, res) => {
  const { userId, id } = req.params;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const result = await pool.query(
      'UPDATE food_items SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [name.trim(), id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Food item not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update food item' });
  }
});

// DELETE /api/users/:userId/food-items/:id — delete food item (cascades batches)
foodRoutes.delete('/:userId/food-items/:id', async (req, res) => {
  const { userId, id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM food_items WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Food item not found' });
    }
    res.json({ message: 'Food item deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete food item' });
  }
});

// GET /api/users/:userId/food-items/:id/batches — list batches for a food item
foodRoutes.get('/:userId/food-items/:id/batches', async (req, res) => {
  const { userId, id } = req.params;
  try {
    // Verify food item belongs to user
    const item = await pool.query(
      'SELECT id FROM food_items WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (item.rows.length === 0) {
      return res.status(404).json({ error: 'Food item not found' });
    }

    const result = await pool.query(
      'SELECT * FROM cooking_batches WHERE food_item_id = $1 ORDER BY cooked_at DESC',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

// POST /api/users/:userId/food-items/:id/batches — add a cooking batch
foodRoutes.post('/:userId/food-items/:id/batches', async (req, res) => {
  const { userId, id } = req.params;
  const { raw_weight, cooked_weight, notes } = req.body;

  if (!raw_weight || !cooked_weight || raw_weight <= 0 || cooked_weight <= 0) {
    return res.status(400).json({ error: 'raw_weight and cooked_weight must be positive numbers' });
  }

  try {
    // Verify food item belongs to user
    const item = await pool.query(
      'SELECT id FROM food_items WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (item.rows.length === 0) {
      return res.status(404).json({ error: 'Food item not found' });
    }

    const result = await pool.query(
      'INSERT INTO cooking_batches (food_item_id, raw_weight, cooked_weight, notes) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, raw_weight, cooked_weight, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create batch' });
  }
});

// DELETE /api/users/:userId/food-items/:id/batches/:batchId — delete a batch
foodRoutes.delete('/:userId/food-items/:id/batches/:batchId', async (req, res) => {
  const { userId, id, batchId } = req.params;
  try {
    // Verify food item belongs to user
    const item = await pool.query(
      'SELECT id FROM food_items WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (item.rows.length === 0) {
      return res.status(404).json({ error: 'Food item not found' });
    }

    const result = await pool.query(
      'DELETE FROM cooking_batches WHERE id = $1 AND food_item_id = $2 RETURNING *',
      [batchId, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    res.json({ message: 'Batch deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete batch' });
  }
});

// GET /api/users/:userId/food-items/:id/ratio — average ratio across all batches
foodRoutes.get('/:userId/food-items/:id/ratio', async (req, res) => {
  const { userId, id } = req.params;
  try {
    const item = await pool.query(
      'SELECT id, name FROM food_items WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (item.rows.length === 0) {
      return res.status(404).json({ error: 'Food item not found' });
    }

    const result = await pool.query(
      `SELECT 
        COUNT(*)::int as batch_count,
        ROUND(AVG(raw_weight / cooked_weight), 4) as avg_ratio,
        ROUND(AVG(cooked_weight / raw_weight), 2) as avg_multiplier
      FROM cooking_batches WHERE food_item_id = $1`,
      [id]
    );

    const stats = result.rows[0];
    res.json({
      food_item: item.rows[0],
      batch_count: stats.batch_count,
      avg_ratio: stats.avg_ratio ? parseFloat(stats.avg_ratio) : null,
      avg_multiplier: stats.avg_multiplier ? parseFloat(stats.avg_multiplier) : null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate ratio' });
  }
});
