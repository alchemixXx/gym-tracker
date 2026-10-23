import { pool } from '../db/pool.js';
import type { PoolClient } from 'pg';

/**
 * Shared data-access layer used by the MCP tools.
 *
 * These functions mirror the SQL used by the HTTP route handlers but are
 * callable directly (no Express req/res). The MCP server operates as a single
 * fixed user (see MCP_USER_ID), so every function takes an explicit userId and
 * scopes all queries by it — the same ownership guarantee the HTTP layer
 * enforces via requireAuth.
 */

// ---------- Types for write payloads ----------

export interface SetInput {
  weight?: number | null;
  reps: number;
  count?: number;
}

export interface ExerciseInput {
  name: string;
  sets?: SetInput[];
}

export interface DayInput {
  name: string;
  exercises?: ExerciseInput[];
}

// ---------- Read: full-structure helpers ----------

async function loadProgramDays(programId: number) {
  const daysResult = await pool.query(
    'SELECT * FROM program_days WHERE program_id = $1 ORDER BY sort_order',
    [programId],
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
  return days;
}

async function loadTemplateDays(templateId: number) {
  const daysResult = await pool.query(
    'SELECT * FROM template_days WHERE template_id = $1 ORDER BY sort_order',
    [templateId],
  );

  const days = [];
  for (const day of daysResult.rows) {
    const exercisesResult = await pool.query(
      'SELECT * FROM template_exercises WHERE template_day_id = $1 ORDER BY sort_order',
      [day.id],
    );
    const exercises = [];
    for (const exercise of exercisesResult.rows) {
      const setsResult = await pool.query(
        'SELECT * FROM template_sets WHERE template_exercise_id = $1 ORDER BY sort_order',
        [exercise.id],
      );
      exercises.push({ ...exercise, sets: setsResult.rows });
    }
    days.push({ ...day, exercises });
  }
  return days;
}

// ---------- Programs: read ----------

export async function listPrograms(userId: number) {
  const result = await pool.query(
    'SELECT * FROM programs WHERE user_id = $1 ORDER BY created_at DESC',
    [userId],
  );
  return result.rows;
}

export async function getProgram(userId: number, programId: number) {
  const programResult = await pool.query(
    'SELECT * FROM programs WHERE id = $1 AND user_id = $2',
    [programId, userId],
  );
  if (programResult.rows.length === 0) return null;
  const program = programResult.rows[0];
  const days = await loadProgramDays(programId);
  return { ...program, days };
}

// ---------- Templates: read ----------

export async function listTemplates(userId: number) {
  const result = await pool.query(
    'SELECT * FROM templates WHERE user_id = $1 ORDER BY updated_at DESC',
    [userId],
  );
  return result.rows;
}

export async function getTemplate(userId: number, templateId: number) {
  const templateResult = await pool.query(
    'SELECT * FROM templates WHERE id = $1 AND user_id = $2',
    [templateId, userId],
  );
  if (templateResult.rows.length === 0) return null;
  const template = templateResult.rows[0];
  const days = await loadTemplateDays(templateId);
  return { ...template, days };
}

// ---------- Measurements: read ----------

export async function listMeasurements(userId: number) {
  const result = await pool.query(
    'SELECT * FROM body_measurements WHERE user_id = $1 ORDER BY date DESC',
    [userId],
  );
  const measurements = [];
  for (const m of result.rows) {
    const entries = await pool.query(
      'SELECT * FROM measurement_entries WHERE measurement_id = $1',
      [m.id],
    );
    measurements.push({ ...m, entries: entries.rows });
  }
  return measurements;
}

// ---------- Analysis: aggregated read ----------

/**
 * Returns all completed training data plus measurements — the raw material an
 * LLM needs to assess progress. Only completed days are included (matches the
 * existing /analysis endpoint).
 */
export async function getAnalysisData(userId: number) {
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

  const measurements = await listMeasurements(userId);

  return { programs, measurements };
}

// ---------- Shared write helper ----------

async function insertProgramDays(
  client: PoolClient,
  programId: number,
  days: DayInput[],
  sortOffset = 0,
) {
  for (let di = 0; di < days.length; di++) {
    const day = days[di];
    const dayResult = await client.query(
      'INSERT INTO program_days (program_id, name, sort_order) VALUES ($1, $2, $3) RETURNING *',
      [programId, day.name, sortOffset + di],
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
              [savedExercise.id, set.weight ?? null, set.reps, set.count || 1, si],
            );
          }
        }
      }
    }
  }
}

async function insertTemplateDays(
  client: PoolClient,
  templateId: number,
  days: DayInput[],
) {
  for (let di = 0; di < days.length; di++) {
    const day = days[di];
    const dayResult = await client.query(
      'INSERT INTO template_days (template_id, name, sort_order) VALUES ($1, $2, $3) RETURNING *',
      [templateId, day.name, di],
    );
    const savedDay = dayResult.rows[0];

    if (day.exercises && Array.isArray(day.exercises)) {
      for (let ei = 0; ei < day.exercises.length; ei++) {
        const exercise = day.exercises[ei];
        const exResult = await client.query(
          'INSERT INTO template_exercises (template_day_id, name, sort_order) VALUES ($1, $2, $3) RETURNING *',
          [savedDay.id, exercise.name, ei],
        );
        const savedExercise = exResult.rows[0];

        if (exercise.sets && Array.isArray(exercise.sets)) {
          for (let si = 0; si < exercise.sets.length; si++) {
            const set = exercise.sets[si];
            await client.query(
              'INSERT INTO template_sets (template_exercise_id, weight, reps, count, sort_order) VALUES ($1, $2, $3, $4, $5)',
              [savedExercise.id, set.weight ?? null, set.reps, set.count || 1, si],
            );
          }
        }
      }
    }
  }
}

// ---------- Programs: write ----------

export async function createProgram(
  userId: number,
  input: { name: string; start_date?: string | null; template_id?: number | null; days?: DayInput[] },
) {
  const name = input.name.trim();

  // Dedup: return the existing program if one with this name already exists
  const existing = await pool.query(
    'SELECT * FROM programs WHERE user_id = $1 AND name = $2',
    [userId, name],
  );
  if (existing.rows.length > 0) {
    const program = existing.rows[0];
    const days = await loadProgramDays(program.id);
    return { program: { ...program, days }, created: false };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const programResult = await client.query(
      'INSERT INTO programs (user_id, template_id, name, start_date) VALUES ($1, $2, $3, $4) RETURNING *',
      [userId, input.template_id ?? null, name, input.start_date ?? null],
    );
    const program = programResult.rows[0];

    let sourceDays = input.days;

    // Build structure from template if requested and no explicit days given
    if (input.template_id && !input.days) {
      const templateDays = await client.query(
        'SELECT * FROM template_days WHERE template_id = $1 ORDER BY sort_order',
        [input.template_id],
      );
      sourceDays = [];
      for (const tDay of templateDays.rows) {
        const templateExercises = await client.query(
          'SELECT * FROM template_exercises WHERE template_day_id = $1 ORDER BY sort_order',
          [tDay.id],
        );
        const exercises: ExerciseInput[] = [];
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

    if (sourceDays && Array.isArray(sourceDays)) {
      await insertProgramDays(client, program.id, sourceDays);
    }

    await client.query('COMMIT');
    const full = await getProgram(userId, program.id);
    return { program: full, created: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateProgram(
  userId: number,
  programId: number,
  input: { name?: string; start_date?: string | null; days?: DayInput[] },
): Promise<
  | { ok: true; program: any }
  | { ok: false; reason: 'not_found' | 'completed' }
> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const check = await client.query(
      'SELECT id, status FROM programs WHERE id = $1 AND user_id = $2',
      [programId, userId],
    );
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'not_found' };
    }
    if (check.rows[0].status === 'completed') {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'completed' };
    }

    await client.query(
      'UPDATE programs SET name = COALESCE($1, name), start_date = COALESCE($2, start_date), updated_at = NOW() WHERE id = $3',
      [input.name ?? null, input.start_date ?? null, programId],
    );

    // Replace structure for non-completed days only; completed days are preserved
    if (input.days && Array.isArray(input.days)) {
      await client.query(
        'DELETE FROM program_days WHERE program_id = $1 AND completed_at IS NULL',
        [programId],
      );
      const completedCount = await client.query(
        'SELECT COUNT(*) as cnt FROM program_days WHERE program_id = $1',
        [programId],
      );
      const sortOffset = Number(completedCount.rows[0].cnt);
      await insertProgramDays(client, programId, input.days, sortOffset);
    }

    await client.query('COMMIT');
    const full = await getProgram(userId, programId);
    return { ok: true, program: full };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ---------- Templates: write ----------

export async function createTemplate(
  userId: number,
  input: { name: string; days?: DayInput[] },
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const templateResult = await client.query(
      'INSERT INTO templates (user_id, name) VALUES ($1, $2) RETURNING *',
      [userId, input.name.trim()],
    );
    const template = templateResult.rows[0];

    if (input.days && Array.isArray(input.days)) {
      await insertTemplateDays(client, template.id, input.days);
    }

    await client.query('COMMIT');
    return await getTemplate(userId, template.id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateTemplate(
  userId: number,
  templateId: number,
  input: { name?: string; days?: DayInput[] },
): Promise<{ ok: true; template: any } | { ok: false; reason: 'not_found' }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const check = await client.query(
      'SELECT id FROM templates WHERE id = $1 AND user_id = $2',
      [templateId, userId],
    );
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'not_found' };
    }

    if (input.name) {
      await client.query(
        'UPDATE templates SET name = $1, updated_at = NOW() WHERE id = $2',
        [input.name.trim(), templateId],
      );
    } else {
      await client.query(
        'UPDATE templates SET updated_at = NOW() WHERE id = $1',
        [templateId],
      );
    }

    if (input.days && Array.isArray(input.days)) {
      await client.query('DELETE FROM template_days WHERE template_id = $1', [
        templateId,
      ]);
      await insertTemplateDays(client, templateId, input.days);
    }

    await client.query('COMMIT');
    const full = await getTemplate(userId, templateId);
    return { ok: true, template: full };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
