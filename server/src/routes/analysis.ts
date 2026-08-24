import { Router } from 'express';
import { pool } from '../db/pool.js';

export const analysisRoutes = Router();

/**
 * GET /api/users/:userId/analysis
 *
 * Returns raw data needed for client-side analysis engine.
 * The heavy computation happens client-side (offline-first architecture),
 * but this endpoint allows fetching fresh data for analysis when online.
 */
analysisRoutes.get('/:userId/analysis', async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch all programs with full structure (completed days only for performance)
    const programsResult = await pool.query(
      'SELECT * FROM programs WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );

    const programs = [];
    for (const program of programsResult.rows) {
      const daysResult = await pool.query(
        `SELECT * FROM program_days WHERE program_id = $1 
         AND completed_at IS NOT NULL 
         ORDER BY sort_order`,
        [program.id],
      );

      const days = [];
      for (const day of daysResult.rows) {
        const exercisesResult = await pool.query(
          'SELECT * FROM program_exercises WHERE program_day_id = $1 ORDER BY sort_order',
          [day.id],
        );

        const exercises = [];
        for (const exercise of exercisesResult.rows) {
          const setsResult = await pool.query(
            'SELECT * FROM program_sets WHERE program_exercise_id = $1 ORDER BY sort_order',
            [exercise.id],
          );
          exercises.push({ ...exercise, sets: setsResult.rows });
        }
        days.push({ ...day, exercises });
      }
      programs.push({ ...program, days });
    }

    // Fetch measurements
    const measurementsResult = await pool.query(
      'SELECT * FROM body_measurements WHERE user_id = $1 ORDER BY date DESC',
      [userId],
    );

    const measurements = [];
    for (const m of measurementsResult.rows) {
      const entries = await pool.query(
        'SELECT * FROM measurement_entries WHERE measurement_id = $1',
        [m.id],
      );
      measurements.push({ ...m, entries: entries.rows });
    }

    res.json({ programs, measurements });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analysis data' });
  }
});
