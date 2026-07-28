import { Router } from 'express';
import { pool } from '../db/pool.js';

export const measurementRoutes = Router();

// GET /api/users/:userId/measurements — list measurements
measurementRoutes.get('/:userId/measurements', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM body_measurements WHERE user_id = $1 ORDER BY date DESC',
      [req.params.userId],
    );

    // Fetch entries and photos for each measurement
    const measurements = [];
    for (const m of result.rows) {
      const entries = await pool.query(
        'SELECT * FROM measurement_entries WHERE measurement_id = $1',
        [m.id],
      );
      const photos = await pool.query(
        'SELECT * FROM measurement_photos WHERE measurement_id = $1 ORDER BY created_at',
        [m.id],
      );
      measurements.push({ ...m, entries: entries.rows, photos: photos.rows });
    }

    res.json(measurements);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch measurements' });
  }
});

// GET /api/users/:userId/measurements/:id
measurementRoutes.get('/:userId/measurements/:id', async (req, res) => {
  try {
    const { userId, id } = req.params;
    const result = await pool.query(
      'SELECT * FROM body_measurements WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Measurement not found' });
    }

    const entries = await pool.query(
      'SELECT * FROM measurement_entries WHERE measurement_id = $1',
      [id],
    );

    res.json({ ...result.rows[0], entries: entries.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch measurement' });
  }
});

// POST /api/users/:userId/measurements — create measurement
measurementRoutes.post('/:userId/measurements', async (req, res) => {
  const { userId } = req.params;
  const { date, weight, notes, entries } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      'INSERT INTO body_measurements (user_id, date, weight, notes) VALUES ($1, $2, $3, $4) RETURNING *',
      [
        userId,
        date || new Date().toISOString().split('T')[0],
        weight || null,
        notes || null,
      ],
    );
    const measurement = result.rows[0];

    const savedEntries = [];
    if (entries && Array.isArray(entries)) {
      for (const entry of entries) {
        const entryResult = await client.query(
          'INSERT INTO measurement_entries (measurement_id, type, value) VALUES ($1, $2, $3) RETURNING *',
          [measurement.id, entry.type, entry.value],
        );
        savedEntries.push(entryResult.rows[0]);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ ...measurement, entries: savedEntries });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to create measurement' });
  } finally {
    client.release();
  }
});

// DELETE /api/users/:userId/measurements/:id
measurementRoutes.delete('/:userId/measurements/:id', async (req, res) => {
  const { userId, id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM body_measurements WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Measurement not found' });
    }
    res.json({ message: 'Measurement deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete measurement' });
  }
});
