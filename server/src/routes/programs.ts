import { Router } from 'express';
import { pool } from '../db/pool.js';

export const programRoutes = Router();

// GET /api/users/:userId/programs — list user's programs
programRoutes.get('/:userId/programs', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM programs WHERE user_id = $1 ORDER BY created_at DESC',
      [req.params.userId],
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch programs' });
  }
});

// GET /api/users/:userId/programs/:id — get program with full structure
programRoutes.get('/:userId/programs/:id', async (req, res) => {
  try {
    const { userId, id } = req.params;

    const programResult = await pool.query(
      'SELECT * FROM programs WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    if (programResult.rows.length === 0) {
      return res.status(404).json({ error: 'Program not found' });
    }

    const program = programResult.rows[0];

    const daysResult = await pool.query(
      'SELECT * FROM program_days WHERE program_id = $1 ORDER BY sort_order',
      [id],
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

    res.json({ ...program, days });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch program' });
  }
});

// POST /api/users/:userId/programs — create program (optionally from template)
programRoutes.post('/:userId/programs', async (req, res) => {
  const { userId } = req.params;
  const { name, start_date, template_id, days } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // Dedup: if a program with this name already exists for the user, return it
  const existing = await pool.query(
    'SELECT * FROM programs WHERE user_id = $1 AND name = $2',
    [userId, name.trim()],
  );
  if (existing.rows.length > 0) {
    const existingProgram = existing.rows[0];
    // Fetch full structure to return consistent response
    const daysResult = await pool.query(
      'SELECT * FROM program_days WHERE program_id = $1 ORDER BY sort_order',
      [existingProgram.id],
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
    return res.status(200).json({ ...existingProgram, days });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const programResult = await client.query(
      'INSERT INTO programs (user_id, template_id, name, start_date) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, template_id || null, name.trim(), start_date || null],
    );
    const program = programResult.rows[0];

    let sourceDays = days;

    // If creating from template, fetch template structure
    if (template_id && !days) {
      const templateDays = await client.query(
        'SELECT * FROM template_days WHERE template_id = $1 ORDER BY sort_order',
        [template_id],
      );

      sourceDays = [];
      for (const tDay of templateDays.rows) {
        const templateExercises = await client.query(
          'SELECT * FROM template_exercises WHERE template_day_id = $1 ORDER BY sort_order',
          [tDay.id],
        );

        const exercises = [];
        for (const tEx of templateExercises.rows) {
          const templateSets = await client.query(
            'SELECT * FROM template_sets WHERE template_exercise_id = $1 ORDER BY sort_order',
            [tEx.id],
          );
          exercises.push({
            name: tEx.name,
            sets: templateSets.rows.map((s: any) => ({
              weight: s.weight,
              reps: s.reps,
              count: s.count,
            })),
          });
        }
        sourceDays.push({ name: tDay.name, exercises });
      }
    }

    const resultDays = [];
    if (sourceDays && Array.isArray(sourceDays)) {
      for (let di = 0; di < sourceDays.length; di++) {
        const day = sourceDays[di];
        const dayResult = await client.query(
          'INSERT INTO program_days (program_id, name, sort_order) VALUES ($1, $2, $3) RETURNING *',
          [program.id, day.name, di],
        );
        const savedDay = dayResult.rows[0];

        const resultExercises = [];
        if (day.exercises && Array.isArray(day.exercises)) {
          for (let ei = 0; ei < day.exercises.length; ei++) {
            const exercise = day.exercises[ei];
            const exResult = await client.query(
              'INSERT INTO program_exercises (program_day_id, name, sort_order) VALUES ($1, $2, $3) RETURNING *',
              [savedDay.id, exercise.name, ei],
            );
            const savedExercise = exResult.rows[0];

            const resultSets = [];
            if (exercise.sets && Array.isArray(exercise.sets)) {
              for (let si = 0; si < exercise.sets.length; si++) {
                const set = exercise.sets[si];
                const setResult = await client.query(
                  'INSERT INTO program_sets (program_exercise_id, weight, reps, count, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                  [
                    savedExercise.id,
                    set.weight || null,
                    set.reps,
                    set.count || 1,
                    si,
                  ],
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
    res.status(201).json({ ...program, days: resultDays });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to create program' });
  } finally {
    client.release();
  }
});

// PUT /api/users/:userId/programs/:id — update program (meta and/or full structure)
programRoutes.put('/:userId/programs/:id', async (req, res) => {
  const { userId, id } = req.params;
  const { name, start_date, days } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify ownership
    const check = await client.query(
      'SELECT id FROM programs WHERE id = $1 AND user_id = $2',
      [id, userId],
    );
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Program not found' });
    }

    // Update meta fields
    await client.query(
      'UPDATE programs SET name = COALESCE($1, name), start_date = COALESCE($2, start_date), updated_at = NOW() WHERE id = $3',
      [name, start_date, id],
    );

    // Replace full structure if days provided
    if (days && Array.isArray(days)) {
      // Delete old days (cascades to exercises and sets)
      await client.query('DELETE FROM program_days WHERE program_id = $1', [
        id,
      ]);

      for (let di = 0; di < days.length; di++) {
        const day = days[di];
        const dayResult = await client.query(
          'INSERT INTO program_days (program_id, name, sort_order) VALUES ($1, $2, $3) RETURNING *',
          [id, day.name, di],
        );
        const savedDay = dayResult.rows[0];

        if (day.exercises && Array.isArray(day.exercises)) {
          for (let ei = 0; ei < day.exercises.length; ei++) {
            const exercise = day.exercises[ei];
            const exResult = await client.query(
              'INSERT INTO program_exercises (program_day_id, name, sort_order) VALUES ($1, $2, $3) RETURNING *',
              [savedDay.id, exercise.name, ei],
            );
            const savedExercise = exResult.rows[0];

            if (exercise.sets && Array.isArray(exercise.sets)) {
              for (let si = 0; si < exercise.sets.length; si++) {
                const set = exercise.sets[si];
                await client.query(
                  'INSERT INTO program_sets (program_exercise_id, weight, reps, count, sort_order) VALUES ($1, $2, $3, $4, $5)',
                  [
                    savedExercise.id,
                    set.weight || null,
                    set.reps,
                    set.count || 1,
                    si,
                  ],
                );
              }
            }
          }
        }
      }
    }

    await client.query('COMMIT');

    // Fetch and return updated program with full structure
    const programResult = await pool.query(
      'SELECT * FROM programs WHERE id = $1',
      [id],
    );
    const program = programResult.rows[0];

    const daysResult = await pool.query(
      'SELECT * FROM program_days WHERE program_id = $1 ORDER BY sort_order',
      [id],
    );

    const resultDays = [];
    for (const d of daysResult.rows) {
      const exercisesResult = await pool.query(
        'SELECT * FROM program_exercises WHERE program_day_id = $1 ORDER BY sort_order',
        [d.id],
      );
      const exercises = [];
      for (const ex of exercisesResult.rows) {
        const setsResult = await pool.query(
          'SELECT * FROM program_sets WHERE program_exercise_id = $1 ORDER BY sort_order',
          [ex.id],
        );
        exercises.push({ ...ex, sets: setsResult.rows });
      }
      resultDays.push({ ...d, exercises });
    }

    res.json({ ...program, days: resultDays });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to update program' });
  } finally {
    client.release();
  }
});

// DELETE /api/users/:userId/programs/:id
programRoutes.delete('/:userId/programs/:id', async (req, res) => {
  const { userId, id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM programs WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Program not found' });
    }
    res.json({ message: 'Program deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete program' });
  }
});

// GET /api/users/:userId/programs/:programId/exercise-history — get notes from last 3 trainings for same exercise+day
programRoutes.get(
  '/:userId/programs/:programId/exercise-history',
  async (req, res) => {
    const { userId, programId } = req.params;
    const { dayName, exerciseName } = req.query;

    if (!dayName || !exerciseName) {
      return res
        .status(400)
        .json({ error: 'dayName and exerciseName are required' });
    }

    try {
      // Find exercise notes from completed days with the same day name and exercise name
      // across ALL user programs (excluding the current one), ordered by completion date
      const result = await pool.query(
        `SELECT pe.note AS exercise_note, pd.day_note, pd.completed_at, p.name AS program_name
         FROM program_exercises pe
         JOIN program_days pd ON pe.program_day_id = pd.id
         JOIN programs p ON pd.program_id = p.id
         WHERE p.user_id = $1
           AND p.id != $2
           AND LOWER(pd.name) = LOWER($3)
           AND LOWER(pe.name) = LOWER($4)
           AND pd.completed_at IS NOT NULL
           AND (pe.note IS NOT NULL AND pe.note != '')
         ORDER BY pd.completed_at DESC
         LIMIT 3`,
        [userId, programId, dayName, exerciseName],
      );

      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch exercise history' });
    }
  },
);

// GET /api/users/:userId/programs/:programId/day-history — get day_notes from last 3 trainings for same day name
programRoutes.get(
  '/:userId/programs/:programId/day-history',
  async (req, res) => {
    const { userId, programId } = req.params;
    const { dayName } = req.query;

    if (!dayName) {
      return res.status(400).json({ error: 'dayName is required' });
    }

    try {
      const result = await pool.query(
        `SELECT pd.day_note, pd.completed_at, p.name AS program_name
         FROM program_days pd
         JOIN programs p ON pd.program_id = p.id
         WHERE p.user_id = $1
           AND p.id != $2
           AND LOWER(pd.name) = LOWER($3)
           AND pd.completed_at IS NOT NULL
           AND (pd.day_note IS NOT NULL AND pd.day_note != '')
         ORDER BY pd.completed_at DESC
         LIMIT 3`,
        [userId, programId, dayName],
      );

      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch day history' });
    }
  },
);

// PUT /api/users/:userId/programs/:id/days/:dayId — update day (note, completed)
programRoutes.put(
  '/:userId/programs/:programId/days/:dayId',
  async (req, res) => {
    const { dayId } = req.params;
    const { day_note, completed_at } = req.body;

    try {
      const result = await pool.query(
        `UPDATE program_days SET 
        day_note = COALESCE($1, day_note),
        completed_at = COALESCE($2, completed_at)
      WHERE id = $3 RETURNING *`,
        [day_note, completed_at, dayId],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Day not found' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update day' });
    }
  },
);

// PUT /api/users/:userId/programs/:programId/days/:dayId/exercises/:exId — update exercise note
programRoutes.put(
  '/:userId/programs/:programId/days/:dayId/exercises/:exId',
  async (req, res) => {
    const { exId } = req.params;
    const { note } = req.body;

    try {
      const result = await pool.query(
        'UPDATE program_exercises SET note = $1 WHERE id = $2 RETURNING *',
        [note, exId],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Exercise not found' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update exercise' });
    }
  },
);

// PUT /api/users/:userId/programs/:programId/days/:dayId/exercises/:exId/sets/:setId — mark set done
programRoutes.put(
  '/:userId/programs/:programId/days/:dayId/exercises/:exId/sets/:setId',
  async (req, res) => {
    const { setId } = req.params;
    const { done, weight, reps, count } = req.body;

    try {
      const result = await pool.query(
        `UPDATE program_sets SET 
        done = COALESCE($1, done),
        weight = COALESCE($2, weight),
        reps = COALESCE($3, reps),
        count = COALESCE($4, count)
      WHERE id = $5 RETURNING *`,
        [done, weight, reps, count, setId],
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Set not found' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update set' });
    }
  },
);
