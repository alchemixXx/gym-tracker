import { Router } from 'express';
import { pool } from '../db/pool.js';

export const templateRoutes = Router();

// GET /api/users/:userId/templates — list user's templates
templateRoutes.get('/:userId/templates', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM templates WHERE user_id = $1 ORDER BY updated_at DESC',
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// GET /api/users/:userId/templates/:id — get template with full structure
templateRoutes.get('/:userId/templates/:id', async (req, res) => {
  try {
    const { userId, id } = req.params;

    const templateResult = await pool.query(
      'SELECT * FROM templates WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = templateResult.rows[0];

    // Fetch days
    const daysResult = await pool.query(
      'SELECT * FROM template_days WHERE template_id = $1 ORDER BY sort_order',
      [id]
    );

    const days = [];
    for (const day of daysResult.rows) {
      const exercisesResult = await pool.query(
        'SELECT * FROM template_exercises WHERE template_day_id = $1 ORDER BY sort_order',
        [day.id]
      );

      const exercises = [];
      for (const exercise of exercisesResult.rows) {
        const setsResult = await pool.query(
          'SELECT * FROM template_sets WHERE template_exercise_id = $1 ORDER BY sort_order',
          [exercise.id]
        );
        exercises.push({ ...exercise, sets: setsResult.rows });
      }
      days.push({ ...day, exercises });
    }

    res.json({ ...template, days });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// POST /api/users/:userId/templates — create template with full structure
templateRoutes.post('/:userId/templates', async (req, res) => {
  const { userId } = req.params;
  const { name, days } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const templateResult = await client.query(
      'INSERT INTO templates (user_id, name) VALUES ($1, $2) RETURNING *',
      [userId, name.trim()]
    );
    const template = templateResult.rows[0];

    const resultDays = [];
    if (days && Array.isArray(days)) {
      for (let di = 0; di < days.length; di++) {
        const day = days[di];
        const dayResult = await client.query(
          'INSERT INTO template_days (template_id, name, sort_order) VALUES ($1, $2, $3) RETURNING *',
          [template.id, day.name, di]
        );
        const savedDay = dayResult.rows[0];

        const resultExercises = [];
        if (day.exercises && Array.isArray(day.exercises)) {
          for (let ei = 0; ei < day.exercises.length; ei++) {
            const exercise = day.exercises[ei];
            const exResult = await client.query(
              'INSERT INTO template_exercises (template_day_id, name, sort_order) VALUES ($1, $2, $3) RETURNING *',
              [savedDay.id, exercise.name, ei]
            );
            const savedExercise = exResult.rows[0];

            const resultSets = [];
            if (exercise.sets && Array.isArray(exercise.sets)) {
              for (let si = 0; si < exercise.sets.length; si++) {
                const set = exercise.sets[si];
                const setResult = await client.query(
                  'INSERT INTO template_sets (template_exercise_id, weight, reps, count, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                  [savedExercise.id, set.weight || null, set.reps, set.count || 1, si]
                );
                resultSets.push(setResult.rows[0]);
              }
            }
            resultExercises.push({ ...savedExercise, sets: resultSets });
          }
        }
        resultDays.push({ ...savedDay, exercises: resultExercises });
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ ...template, days: resultDays });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to create template' });
  } finally {
    client.release();
  }
});

// PUT /api/users/:userId/templates/:id — update template (replace full structure)
templateRoutes.put('/:userId/templates/:id', async (req, res) => {
  const { userId, id } = req.params;
  const { name, days } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify ownership
    const check = await client.query(
      'SELECT id FROM templates WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Template not found' });
    }

    // Update template name
    if (name) {
      await client.query(
        'UPDATE templates SET name = $1, updated_at = NOW() WHERE id = $2',
        [name.trim(), id]
      );
    } else {
      await client.query('UPDATE templates SET updated_at = NOW() WHERE id = $1', [id]);
    }

    // Replace days structure
    if (days && Array.isArray(days)) {
      // Delete old days (cascades to exercises and sets)
      await client.query('DELETE FROM template_days WHERE template_id = $1', [id]);

      for (let di = 0; di < days.length; di++) {
        const day = days[di];
        const dayResult = await client.query(
          'INSERT INTO template_days (template_id, name, sort_order) VALUES ($1, $2, $3) RETURNING *',
          [id, day.name, di]
        );
        const savedDay = dayResult.rows[0];

        if (day.exercises && Array.isArray(day.exercises)) {
          for (let ei = 0; ei < day.exercises.length; ei++) {
            const exercise = day.exercises[ei];
            const exResult = await client.query(
              'INSERT INTO template_exercises (template_day_id, name, sort_order) VALUES ($1, $2, $3) RETURNING *',
              [savedDay.id, exercise.name, ei]
            );
            const savedExercise = exResult.rows[0];

            if (exercise.sets && Array.isArray(exercise.sets)) {
              for (let si = 0; si < exercise.sets.length; si++) {
                const set = exercise.sets[si];
                await client.query(
                  'INSERT INTO template_sets (template_exercise_id, weight, reps, count, sort_order) VALUES ($1, $2, $3, $4, $5)',
                  [savedExercise.id, set.weight || null, set.reps, set.count || 1, si]
                );
              }
            }
          }
        }
      }
    }

    await client.query('COMMIT');

    // Fetch and return updated template
    const updatedTemplate = await pool.query('SELECT * FROM templates WHERE id = $1', [id]);
    res.json(updatedTemplate.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to update template' });
  } finally {
    client.release();
  }
});

// DELETE /api/users/:userId/templates/:id
templateRoutes.delete('/:userId/templates/:id', async (req, res) => {
  const { userId, id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM templates WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});
