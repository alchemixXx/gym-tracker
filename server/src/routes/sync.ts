import { Router } from 'express';
import { pool } from '../db/pool.js';

export const syncRoutes = Router();

/**
 * GET /api/users/:userId/sync
 *
 * Returns all data for a user in one request, structured for the client's
 * IndexedDB to consume directly. Photos are excluded from the payload
 * (only metadata is included in measurements).
 */
syncRoutes.get('/:userId/sync', async (req, res) => {
  const { userId } = req.params;

  try {
    // ─── Templates (denormalized) ──────────────────────────────────────────
    const templatesResult = await pool.query(
      'SELECT * FROM templates WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId],
    );

    const templates = [];
    for (const t of templatesResult.rows) {
      const daysResult = await pool.query(
        'SELECT * FROM template_days WHERE template_id = $1 ORDER BY sort_order',
        [t.id],
      );

      const days = [];
      for (const day of daysResult.rows) {
        const exercisesResult = await pool.query(
          'SELECT * FROM template_exercises WHERE template_day_id = $1 ORDER BY sort_order',
          [day.id],
        );

        const exercises = [];
        for (const ex of exercisesResult.rows) {
          const setsResult = await pool.query(
            'SELECT * FROM template_sets WHERE template_exercise_id = $1 ORDER BY sort_order',
            [ex.id],
          );
          exercises.push({
            name: ex.name,
            sort_order: ex.sort_order,
            sets: setsResult.rows.map((s: any) => ({
              weight: s.weight ? parseFloat(s.weight) : null,
              reps: s.reps,
              count: s.count,
              sort_order: s.sort_order,
            })),
          });
        }
        days.push({
          name: day.name,
          sort_order: day.sort_order,
          exercises,
        });
      }

      templates.push({
        id: t.id,
        user_id: t.user_id,
        name: t.name,
        created_at: t.created_at?.toISOString?.() || t.created_at,
        updated_at: t.updated_at?.toISOString?.() || t.updated_at,
        days,
      });
    }

    // ─── Programs (denormalized) ───────────────────────────────────────────
    const programsResult = await pool.query(
      'SELECT * FROM programs WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );

    const programs = [];
    for (const p of programsResult.rows) {
      const daysResult = await pool.query(
        'SELECT * FROM program_days WHERE program_id = $1 ORDER BY sort_order',
        [p.id],
      );

      const days = [];
      for (const day of daysResult.rows) {
        const exercisesResult = await pool.query(
          'SELECT * FROM program_exercises WHERE program_day_id = $1 ORDER BY sort_order',
          [day.id],
        );

        const exercises = [];
        for (const ex of exercisesResult.rows) {
          const setsResult = await pool.query(
            'SELECT * FROM program_sets WHERE program_exercise_id = $1 ORDER BY sort_order',
            [ex.id],
          );
          exercises.push({
            id: ex.id,
            name: ex.name,
            sort_order: ex.sort_order,
            note: ex.note || null,
            sets: setsResult.rows.map((s: any) => ({
              id: s.id,
              weight: s.weight ? parseFloat(s.weight) : null,
              reps: s.reps,
              count: s.count,
              done: s.done,
              sort_order: s.sort_order,
            })),
          });
        }
        days.push({
          id: day.id,
          name: day.name,
          sort_order: day.sort_order,
          day_note: day.day_note || null,
          completed_at:
            day.completed_at?.toISOString?.() || day.completed_at || null,
          exercises,
        });
      }

      programs.push({
        id: p.id,
        user_id: p.user_id,
        template_id: p.template_id || null,
        name: p.name,
        status: p.status || 'active',
        start_date:
          p.start_date?.toISOString?.()?.split('T')[0] || p.start_date || null,
        created_at: p.created_at?.toISOString?.() || p.created_at,
        updated_at: p.updated_at?.toISOString?.() || p.updated_at,
        days,
      });
    }

    // ─── Measurements (with entries + photo metadata only) ─────────────────
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
      const photos = await pool.query(
        'SELECT id, measurement_id, original_name, mime_type, created_at FROM measurement_photos WHERE measurement_id = $1 ORDER BY created_at',
        [m.id],
      );

      measurements.push({
        id: m.id,
        user_id: m.user_id,
        date: m.date?.toISOString?.()?.split('T')[0] || m.date,
        weight: m.weight ? parseFloat(m.weight) : null,
        notes: m.notes || null,
        created_at: m.created_at?.toISOString?.() || m.created_at,
        entries: entries.rows.map((e: any) => ({
          id: e.id,
          type: e.type,
          value: parseFloat(e.value),
        })),
        photos: photos.rows.map((ph: any) => ({
          id: ph.id,
          original_name: ph.original_name,
          mime_type: ph.mime_type,
          created_at: ph.created_at?.toISOString?.() || ph.created_at,
        })),
      });
    }

    // ─── Food Items ────────────────────────────────────────────────────────
    const foodItemsResult = await pool.query(
      'SELECT * FROM food_items WHERE user_id = $1 ORDER BY name ASC',
      [userId],
    );

    const foodItems = foodItemsResult.rows.map((f: any) => ({
      id: f.id,
      user_id: f.user_id,
      name: f.name,
      created_at: f.created_at?.toISOString?.() || f.created_at,
    }));

    // ─── Cooking Batches (for all user's food items) ───────────────────────
    const foodItemIds = foodItems.map((f: any) => f.id);
    let cookingBatches: any[] = [];

    if (foodItemIds.length > 0) {
      const batchesResult = await pool.query(
        'SELECT * FROM cooking_batches WHERE food_item_id = ANY($1) ORDER BY cooked_at DESC',
        [foodItemIds],
      );
      cookingBatches = batchesResult.rows.map((b: any) => ({
        id: b.id,
        food_item_id: b.food_item_id,
        raw_weight: parseFloat(b.raw_weight),
        cooked_weight: parseFloat(b.cooked_weight),
        cooked_at: b.cooked_at?.toISOString?.() || b.cooked_at,
        notes: b.notes || null,
      }));
    }

    // ─── All Users (so other devices can populate user list) ──────────────
    const usersResult = await pool.query('SELECT * FROM users ORDER BY name');
    const users = usersResult.rows.map((u: any) => ({
      id: u.id,
      name: u.name,
      created_at: u.created_at?.toISOString?.() || u.created_at,
    }));

    // ─── Response ──────────────────────────────────────────────────────────
    res.json({
      users,
      templates,
      programs,
      measurements,
      foodItems,
      cookingBatches,
      synced_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync endpoint error:', error);
    res.status(500).json({ error: 'Failed to sync data' });
  }
});
