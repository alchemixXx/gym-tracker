import {
  db,
  type DbProgram,
  type DbTemplate,
  type DbMeasurement,
  type DbFoodItem,
  type DbCookingBatch,
} from './index';
import { enqueue } from './sync';

/**
 * Offline-first API layer.
 * - Reads always come from IndexedDB (instant, offline-safe).
 * - Writes go to IndexedDB immediately + enqueue for server sync.
 * - Photos are excluded from offline — those still require network.
 */

// ─── Temporary ID generation ─────────────────────────────────────────────────

let tempIdCounter = -1;
function nextTempId(): number {
  return tempIdCounter--;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getUsers() {
  return db.users.toArray();
}

// ─── Templates ───────────────────────────────────────────────────────────────

export async function getTemplates(userId: number) {
  return db.templates
    .where('user_id')
    .equals(userId)
    .reverse()
    .sortBy('updated_at');
}

export async function getTemplate(userId: number, id: number) {
  const t = await db.templates.get(id);
  if (!t || t.user_id !== userId) return null;
  return t;
}

export async function createTemplate(
  userId: number,
  data: { name: string; days: any[] },
) {
  const now = new Date().toISOString();
  const template: DbTemplate = {
    id: nextTempId(),
    user_id: userId,
    name: data.name,
    created_at: now,
    updated_at: now,
    days: (data.days || []).map((d: any, di: number) => ({
      name: d.name,
      sort_order: di,
      exercises: (d.exercises || []).map((e: any, ei: number) => ({
        name: e.name,
        sort_order: ei,
        sets: (e.sets || []).map((s: any, si: number) => ({
          weight: s.weight || null,
          reps: s.reps,
          count: s.count || 1,
          sort_order: si,
        })),
      })),
    })),
  };

  await db.templates.add(template);
  await enqueue('createTemplate', { userId, data });
  return template;
}

export async function updateTemplate(
  userId: number,
  templateId: number,
  data: any,
) {
  const existing = await db.templates.get(templateId);
  if (!existing) return;

  const updated: DbTemplate = {
    ...existing,
    name: data.name || existing.name,
    updated_at: new Date().toISOString(),
    days: data.days
      ? data.days.map((d: any, di: number) => ({
          name: d.name,
          sort_order: di,
          exercises: (d.exercises || []).map((e: any, ei: number) => ({
            name: e.name,
            sort_order: ei,
            sets: (e.sets || []).map((s: any, si: number) => ({
              weight: s.weight || null,
              reps: s.reps,
              count: s.count || 1,
              sort_order: si,
            })),
          })),
        }))
      : existing.days,
  };

  await db.templates.put(updated);
  await enqueue('updateTemplate', { userId, templateId, data });
  return updated;
}

export async function deleteTemplate(userId: number, templateId: number) {
  await db.templates.delete(templateId);
  await enqueue('deleteTemplate', { userId, templateId });
}

// ─── Programs ────────────────────────────────────────────────────────────────

export async function getPrograms(userId: number) {
  const programs = await db.programs
    .where('user_id')
    .equals(userId)
    .reverse()
    .sortBy('created_at');
  return programs.map((p: any) => ({
    ...p,
    days_total: p.days ? p.days.length : 0,
    days_completed: p.days
      ? p.days.filter((d: any) => d.completed_at).length
      : 0,
  }));
}

export async function getProgram(userId: number, id: number) {
  const p = await db.programs.get(id);
  if (!p || p.user_id !== userId) return null;
  return p;
}

export async function createProgram(userId: number, data: any) {
  const now = new Date().toISOString();
  const program: DbProgram = {
    id: nextTempId(),
    user_id: userId,
    template_id: data.template_id || null,
    name: data.name,
    status: 'active',
    start_date: data.start_date || null,
    created_at: now,
    updated_at: now,
    days: (data.days || []).map((d: any, di: number) => ({
      id: nextTempId(),
      name: d.name,
      sort_order: di,
      day_note: null,
      started_at: null,
      completed_at: null,
      duration_seconds: null,
      exercises: (d.exercises || []).map((e: any, ei: number) => ({
        id: nextTempId(),
        name: e.name,
        sort_order: ei,
        note: null,
        sets: (e.sets || []).map((s: any, si: number) => ({
          id: nextTempId(),
          weight: s.weight || null,
          reps: s.reps,
          count: s.count || 1,
          done: false,
          sort_order: si,
        })),
      })),
    })),
  };

  await db.programs.add(program);
  await enqueue('createProgram', { userId, data });
  return program;
}

export async function updateProgram(
  userId: number,
  programId: number,
  data: any,
) {
  const existing = await db.programs.get(programId);
  if (!existing) return;

  const updated: DbProgram = {
    ...existing,
    updated_at: new Date().toISOString(),
  };
  if (data.name) updated.name = data.name;
  if (data.start_date !== undefined) updated.start_date = data.start_date;

  if (data.days && Array.isArray(data.days)) {
    // Keep completed days, replace non-completed
    const completedDays = existing.days.filter((d) => d.completed_at);
    const newDays = data.days.map((d: any, di: number) => ({
      id: nextTempId(),
      name: d.name,
      sort_order: completedDays.length + di,
      day_note: null,
      started_at: null,
      completed_at: null,
      duration_seconds: null,
      exercises: (d.exercises || []).map((e: any, ei: number) => ({
        id: nextTempId(),
        name: e.name,
        sort_order: ei,
        note: null,
        sets: (e.sets || []).map((s: any, si: number) => ({
          id: nextTempId(),
          weight: s.weight || null,
          reps: Number(s.reps) || 10,
          count: Number(s.count) || 1,
          done: false,
          sort_order: si,
        })),
      })),
    }));
    updated.days = [...completedDays, ...newDays];
  }

  await db.programs.put(updated);
  await enqueue('updateProgram', { userId, programId, data });
  return updated;
}

export async function deleteProgram(userId: number, programId: number) {
  await db.programs.delete(programId);
  await enqueue('deleteProgram', { userId, programId });
}

export async function duplicateProgram(
  userId: number,
  programId: number,
  name?: string,
) {
  const source = await db.programs.get(programId);
  if (!source) return;

  const now = new Date().toISOString();
  const newProgram: DbProgram = {
    id: nextTempId(),
    user_id: userId,
    template_id: source.template_id,
    name: name?.trim() || `${source.name} (копія)`,
    status: 'active',
    start_date: new Date().toISOString().split('T')[0],
    created_at: now,
    updated_at: now,
    days: source.days.map((d, di) => ({
      id: nextTempId(),
      name: d.name,
      sort_order: di,
      day_note: null,
      started_at: null,
      completed_at: null,
      duration_seconds: null,
      exercises: d.exercises.map((e, ei) => ({
        id: nextTempId(),
        name: e.name,
        sort_order: ei,
        note: null,
        sets: e.sets.map((s, si) => ({
          id: nextTempId(),
          weight: s.weight,
          reps: s.reps,
          count: s.count,
          done: false,
          sort_order: si,
        })),
      })),
    })),
  };

  await db.programs.add(newProgram);
  await enqueue('duplicateProgram', { userId, programId, name });
  return newProgram;
}

export async function finishProgram(userId: number, programId: number) {
  const existing = await db.programs.get(programId);
  if (!existing) return;

  existing.status = 'completed';
  existing.updated_at = new Date().toISOString();
  await db.programs.put(existing);
  await enqueue('finishProgram', { userId, programId });
  return existing;
}

// ─── Program Session (in-workout updates) ────────────────────────────────────

export async function updateDay(
  userId: number,
  programId: number,
  dayId: number,
  data: any,
) {
  const program = await db.programs.get(programId);
  if (!program) return;

  const day = program.days.find((d) => d.id === dayId);
  if (!day) return;

  if (data.day_note !== undefined) day.day_note = data.day_note;
  if (data.started_at !== undefined) day.started_at = data.started_at;
  if (data.completed_at !== undefined) day.completed_at = data.completed_at;
  if (data.duration_seconds !== undefined)
    day.duration_seconds = data.duration_seconds;

  program.updated_at = new Date().toISOString();
  await db.programs.put(program);
  await enqueue('updateDay', { userId, programId, dayId, data });
}

export async function updateExercise(
  userId: number,
  programId: number,
  dayId: number,
  exerciseId: number,
  data: any,
) {
  const program = await db.programs.get(programId);
  if (!program) return;

  const day = program.days.find((d) => d.id === dayId);
  if (!day) return;

  const exercise = day.exercises.find((e) => e.id === exerciseId);
  if (!exercise) return;

  if (data.note !== undefined) exercise.note = data.note;

  program.updated_at = new Date().toISOString();
  await db.programs.put(program);
  await enqueue('updateExercise', {
    userId,
    programId,
    dayId,
    exerciseId,
    data,
  });
}

export async function updateSet(
  userId: number,
  programId: number,
  dayId: number,
  exerciseId: number,
  setId: number,
  data: any,
) {
  const program = await db.programs.get(programId);
  if (!program) return;

  const day = program.days.find((d) => d.id === dayId);
  if (!day) return;

  const exercise = day.exercises.find((e) => e.id === exerciseId);
  if (!exercise) return;

  const set = exercise.sets.find((s) => s.id === setId);
  if (!set) return;

  if (data.done !== undefined) set.done = data.done;
  if (data.weight !== undefined) set.weight = data.weight;
  if (data.reps !== undefined) set.reps = data.reps;

  program.updated_at = new Date().toISOString();
  await db.programs.put(program);
  await enqueue('updateSet', {
    userId,
    programId,
    dayId,
    exerciseId,
    setId,
    data,
  });
}

// ─── Measurements ────────────────────────────────────────────────────────────

export async function getMeasurements(userId: number) {
  const all = await db.measurements.where('user_id').equals(userId).toArray();
  // Sort by date descending
  return all.sort((a, b) => b.date.localeCompare(a.date));
}

export async function createMeasurement(userId: number, data: any) {
  const measurement: DbMeasurement = {
    id: nextTempId(),
    user_id: userId,
    date: data.date || new Date().toISOString().split('T')[0],
    weight: data.weight || null,
    notes: data.notes || null,
    created_at: new Date().toISOString(),
    entries: (data.entries || []).map((e: any, i: number) => ({
      id: nextTempId(),
      type: e.type,
      value: e.value,
    })),
    photos: [], // Photos are online-only
  };

  await db.measurements.add(measurement);
  await enqueue('createMeasurement', { userId, data });
  return measurement;
}

export async function deleteMeasurement(userId: number, measurementId: number) {
  await db.measurements.delete(measurementId);
  await enqueue('deleteMeasurement', { userId, measurementId });
}

// ─── Food Items ──────────────────────────────────────────────────────────────

export async function getFoodItems(userId: number) {
  const items = await db.foodItems.where('user_id').equals(userId).toArray();
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createFoodItem(userId: number, name: string) {
  const item: DbFoodItem = {
    id: nextTempId(),
    user_id: userId,
    name,
    created_at: new Date().toISOString(),
  };
  await db.foodItems.add(item);
  await enqueue('createFoodItem', { userId, name });
  return item;
}

export async function updateFoodItem(
  userId: number,
  foodItemId: number,
  name: string,
) {
  const existing = await db.foodItems.get(foodItemId);
  if (!existing) return;
  existing.name = name;
  await db.foodItems.put(existing);
  await enqueue('updateFoodItem', { userId, foodItemId, name });
  return existing;
}

export async function deleteFoodItem(userId: number, foodItemId: number) {
  // Also delete associated batches
  await db.cookingBatches.where('food_item_id').equals(foodItemId).delete();
  await db.foodItems.delete(foodItemId);
  await enqueue('deleteFoodItem', { userId, foodItemId });
}

// ─── Cooking Batches ─────────────────────────────────────────────────────────

export async function getBatches(userId: number, foodItemId: number) {
  const batches = await db.cookingBatches
    .where('food_item_id')
    .equals(foodItemId)
    .toArray();
  return batches.sort((a, b) => b.cooked_at.localeCompare(a.cooked_at));
}

export async function createBatch(
  userId: number,
  foodItemId: number,
  data: { raw_weight: number; cooked_weight: number; notes?: string },
) {
  const batch: DbCookingBatch = {
    id: nextTempId(),
    food_item_id: foodItemId,
    raw_weight: data.raw_weight,
    cooked_weight: data.cooked_weight,
    cooked_at: new Date().toISOString(),
    notes: data.notes || null,
  };
  await db.cookingBatches.add(batch);
  await enqueue('createBatch', { userId, foodItemId, data });
  return batch;
}

export async function deleteBatch(
  userId: number,
  foodItemId: number,
  batchId: number,
) {
  await db.cookingBatches.delete(batchId);
  await enqueue('deleteBatch', { userId, foodItemId, batchId });
}

export async function getFoodRatio(userId: number, foodItemId: number) {
  const item = await db.foodItems.get(foodItemId);
  const batches = await db.cookingBatches
    .where('food_item_id')
    .equals(foodItemId)
    .toArray();

  const batchCount = batches.length;
  let avgRatio: number | null = null;
  let avgMultiplier: number | null = null;

  if (batchCount > 0) {
    const ratioSum = batches.reduce(
      (sum, b) => sum + b.raw_weight / b.cooked_weight,
      0,
    );
    const multiplierSum = batches.reduce(
      (sum, b) => sum + b.cooked_weight / b.raw_weight,
      0,
    );
    avgRatio = Math.round((ratioSum / batchCount) * 10000) / 10000;
    avgMultiplier = Math.round((multiplierSum / batchCount) * 100) / 100;
  }

  return {
    food_item: item || null,
    batch_count: batchCount,
    avg_ratio: avgRatio,
    avg_multiplier: avgMultiplier,
  };
}

// ─── Program Import/Export ────────────────────────────────────────────────────

export async function exportProgram(userId: number, programId: number) {
  const program = await db.programs.get(programId);
  if (!program || program.user_id !== userId) return null;

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    program: {
      name: program.name,
      status: program.status,
      start_date: program.start_date,
      created_at: program.created_at,
      days: program.days.map((d) => ({
        name: d.name,
        day_note: d.day_note || null,
        completed_at: d.completed_at || null,
        exercises: d.exercises.map((e) => ({
          name: e.name,
          note: e.note || null,
          sets: e.sets.map((s) => ({
            weight: s.weight,
            reps: s.reps,
            count: s.count,
            done: s.done,
          })),
        })),
      })),
    },
  };
}

export async function importProgram(userId: number, importData: any) {
  const programData = importData.program || importData;
  if (!programData || !programData.name) return null;

  const now = new Date().toISOString();
  const program: DbProgram = {
    id: nextTempId(),
    user_id: userId,
    template_id: null,
    name: programData.name,
    status: 'active',
    start_date: new Date().toISOString().split('T')[0],
    created_at: now,
    updated_at: now,
    days: (programData.days || []).map((d: any, di: number) => ({
      id: nextTempId(),
      name: d.name,
      sort_order: di,
      day_note: d.day_note || null,
      completed_at: null,
      exercises: (d.exercises || []).map((e: any, ei: number) => ({
        id: nextTempId(),
        name: e.name,
        sort_order: ei,
        note: e.note || null,
        sets: (e.sets || []).map((s: any, si: number) => ({
          id: nextTempId(),
          weight: s.weight || null,
          reps: s.reps || 10,
          count: s.count || 1,
          done: false,
          sort_order: si,
        })),
      })),
    })),
  };

  await db.programs.add(program);
  await enqueue('importProgram', { userId, data: { program: programData } });
  return program;
}

// ─── Exercise/Day History (read from local programs) ─────────────────────────

export async function getExerciseHistory(
  userId: number,
  programId: number,
  dayName: string,
  exerciseName: string,
) {
  // Find notes for this exercise from completed days in other programs with the same day/exercise name
  const programs = await db.programs.where('user_id').equals(userId).toArray();
  const history: any[] = [];

  for (const p of programs) {
    if (p.id === programId) continue;
    for (const day of p.days) {
      if (day.name.trim() === dayName.trim() && day.completed_at) {
        for (const ex of day.exercises) {
          if (ex.name.trim() === exerciseName.trim() && ex.note) {
            history.push({
              program_name: p.name,
              completed_at: day.completed_at,
              exercise_note: ex.note,
            });
          }
        }
      }
    }
  }

  return history.sort((a, b) => b.completed_at.localeCompare(a.completed_at));
}

export async function getDayHistory(
  userId: number,
  programId: number,
  dayName: string,
) {
  const programs = await db.programs.where('user_id').equals(userId).toArray();
  const history: any[] = [];

  for (const p of programs) {
    if (p.id === programId) continue;
    for (const day of p.days) {
      if (
        day.name.trim() === dayName.trim() &&
        day.completed_at &&
        day.day_note
      ) {
        history.push({
          program_name: p.name,
          completed_at: day.completed_at,
          day_note: day.day_note,
        });
      }
    }
  }

  return history.sort((a, b) => b.completed_at.localeCompare(a.completed_at));
}
