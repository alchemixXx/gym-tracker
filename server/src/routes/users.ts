import { Router } from 'express';
import { pool } from '../db/pool.js';

export const userRoutes = Router();

// GET /api/users/:id — get user by id (authenticated user can only get themselves)
userRoutes.get('/:id', async (req, res) => {
  const userId = req.user?.userId;
  const paramId = parseInt(req.params.id, 10);

  if (userId !== paramId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const result = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [paramId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// PUT /api/users/:id — update user name (authenticated, own account only)
userRoutes.put('/:id', async (req, res) => {
  const userId = req.user?.userId;
  const paramId = parseInt(req.params.id, 10);

  if (userId !== paramId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const result = await pool.query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email, created_at',
      [name.trim(), paramId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id — delete own account
userRoutes.delete('/:id', async (req, res) => {
  const userId = req.user?.userId;
  const paramId = parseInt(req.params.id, 10);

  if (userId !== paramId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING *',
      [paramId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});
