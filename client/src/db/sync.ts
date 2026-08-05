import { db, type DbSyncQueueItem, type SyncAction } from './index';
import { api, getBaseUrl, getTokens } from '../api';
import { ref } from 'vue';

/** Reactive sync state */
export const syncState = ref<'idle' | 'syncing' | 'error'>('idle');
export const pendingCount = ref(0);
export const lastSyncAt = ref<string | null>(null);

// ─── Queue Management ────────────────────────────────────────────────────────

export async function enqueue(action: SyncAction, payload: any): Promise<void> {
  await db.syncQueue.add({
    action,
    payload,
    created_at: new Date().toISOString(),
    retries: 0,
  });
  pendingCount.value = await db.syncQueue.count();

  // Trigger immediate push if online (don't await — fire and forget)
  if (navigator.onLine) {
    pushPendingChanges().catch(console.error);
  }
}

async function updatePendingCount(): Promise<void> {
  pendingCount.value = await db.syncQueue.count();
}

// ─── Full Pull (download all user data) ──────────────────────────────────────

const PULL_MAX_RETRIES = 10;
const PULL_RETRY_DELAY_MS = 3000;

async function fetchWithRetry(url: string): Promise<any> {
  for (let attempt = 0; attempt <= PULL_MAX_RETRIES; attempt++) {
    try {
      const headers: Record<string, string> = {};
      const tokens = getTokens();
      if (tokens?.accessToken) {
        headers['Authorization'] = `Bearer ${tokens.accessToken}`;
      }
      const res = await fetch(url, { headers });
      if (res.ok) {
        return res.json();
      }
      // Server error (502/503/504) — retry
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        if (attempt < PULL_MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, PULL_RETRY_DELAY_MS));
          continue;
        }
      }
      throw new Error(`Sync pull failed: ${res.status}`);
    } catch (err: any) {
      // Network error (server unreachable) — retry
      if (err.message?.includes('Sync pull failed')) throw err;
      if (attempt < PULL_MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, PULL_RETRY_DELAY_MS));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Sync pull failed: max retries exceeded');
}

export async function pullAllData(userId: number): Promise<void> {
  syncState.value = 'syncing';
  try {
    // Use retry logic to handle cold-starting servers (free hosting)
    const data = await fetchWithRetry(`${getBaseUrl()}/users/${userId}/sync`);

    // Safety check: if the response has no synced_at timestamp, it's invalid
    if (!data.synced_at) {
      throw new Error('Invalid sync response: missing synced_at');
    }

    // Check for pending changes before entering transaction
    const pendingItems = await db.syncQueue.count();

    // If we have pending (un-pushed) changes and server returned empty data,
    // skip the replace to avoid wiping local-only data
    const hasServerData =
      (data.templates?.length ?? 0) > 0 ||
      (data.programs?.length ?? 0) > 0 ||
      (data.measurements?.length ?? 0) > 0 ||
      (data.foodItems?.length ?? 0) > 0;

    if (!hasServerData && pendingItems > 0) {
      // Server has nothing but we have unsynced local changes — don't wipe
      syncState.value = 'idle';
      return;
    }

    // Replace local data for this user in a transaction
    await db.transaction(
      'rw',
      [
        db.users,
        db.templates,
        db.programs,
        db.measurements,
        db.foodItems,
        db.cookingBatches,
        db.syncMeta,
      ],
      async () => {
        // Always update users list
        if (data.users?.length) await db.users.bulkPut(data.users);

        // Clear and replace user-specific data
        await db.templates.where('user_id').equals(userId).delete();
        await db.programs.where('user_id').equals(userId).delete();
        await db.measurements.where('user_id').equals(userId).delete();

        const userFoodItems = await db.foodItems
          .where('user_id')
          .equals(userId)
          .toArray();
        for (const item of userFoodItems) {
          await db.cookingBatches
            .where('food_item_id')
            .equals(item.id)
            .delete();
        }
        await db.foodItems.where('user_id').equals(userId).delete();

        // Store fresh data from server
        if (data.templates?.length) await db.templates.bulkPut(data.templates);
        if (data.programs?.length) await db.programs.bulkPut(data.programs);
        if (data.measurements?.length)
          await db.measurements.bulkPut(data.measurements);
        if (data.foodItems?.length) await db.foodItems.bulkPut(data.foodItems);
        if (data.cookingBatches?.length)
          await db.cookingBatches.bulkPut(data.cookingBatches);

        // Update sync timestamp
        await db.syncMeta.put({
          key: `lastSync_${userId}`,
          value: new Date().toISOString(),
        });
      },
    );

    lastSyncAt.value = new Date().toISOString();
    syncState.value = 'idle';
  } catch (err) {
    syncState.value = 'error';
    throw err;
  }
}

// ─── Push (replay sync queue) ────────────────────────────────────────────────

const MAX_RETRIES = 5;

// Prevent concurrent push calls from racing
let pushInProgress: Promise<void> | null = null;

/**
 * ID remapping for offline-created entities.
 * When a program/template is created offline, it gets a negative temp ID.
 * Subsequent actions (updateDay, updateSet, etc.) reference those temp IDs.
 * After the create action succeeds on the server, we capture the real IDs
 * and remap them for all following queue items.
 */
type IdMap = Map<number, number>;

function remapId(idMap: IdMap, id: number): number {
  return idMap.get(id) ?? id;
}

/**
 * Normalize a server program response to match the local IndexedDB schema.
 * Server responses from create/duplicate include foreign keys (program_id,
 * program_day_id, etc.) and raw timestamp formats that need cleanup.
 */
function normalizeServerProgram(sp: any): any {
  return {
    id: sp.id,
    user_id: sp.user_id,
    template_id: sp.template_id || null,
    name: sp.name,
    status: sp.status || 'active',
    start_date: sp.start_date?.split?.('T')[0] || sp.start_date || null,
    created_at: sp.created_at?.toISOString?.() || sp.created_at,
    updated_at: sp.updated_at?.toISOString?.() || sp.updated_at,
    days: (sp.days || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      sort_order: d.sort_order,
      day_note: d.day_note || null,
      completed_at: d.completed_at?.toISOString?.() || d.completed_at || null,
      exercises: (d.exercises || []).map((e: any) => ({
        id: e.id,
        name: e.name,
        sort_order: e.sort_order,
        note: e.note || null,
        sets: (e.sets || []).map((s: any) => ({
          id: s.id,
          weight: s.weight ? parseFloat(s.weight) : null,
          reps: s.reps,
          count: s.count || 1,
          done: s.done || false,
          sort_order: s.sort_order,
        })),
      })),
    })),
  };
}

/**
 * After a program is created on the server, build ID mappings from the
 * local temp-ID program to the server-assigned IDs (matched by sort_order).
 */
function buildProgramIdMappings(
  localProgram: any,
  serverProgram: any,
  idMap: IdMap,
): void {
  // Map program ID
  if (localProgram.id < 0 && serverProgram.id > 0) {
    idMap.set(localProgram.id, serverProgram.id);
  }

  // Map day IDs by sort_order
  const localDays = localProgram.days || [];
  const serverDays = serverProgram.days || [];
  for (const localDay of localDays) {
    const serverDay = serverDays.find(
      (sd: any) => sd.sort_order === localDay.sort_order,
    );
    if (serverDay && localDay.id < 0) {
      idMap.set(localDay.id, serverDay.id);

      // Map exercise IDs within this day
      const localExercises = localDay.exercises || [];
      const serverExercises = serverDay.exercises || [];
      for (const localEx of localExercises) {
        const serverEx = serverExercises.find(
          (se: any) => se.sort_order === localEx.sort_order,
        );
        if (serverEx && localEx.id < 0) {
          idMap.set(localEx.id, serverEx.id);

          // Map set IDs within this exercise
          const localSets = localEx.sets || [];
          const serverSets = serverEx.sets || [];
          for (const localSet of localSets) {
            const serverSet = serverSets.find(
              (ss: any) => ss.sort_order === localSet.sort_order,
            );
            if (serverSet && localSet.id < 0) {
              idMap.set(localSet.id, serverSet.id);
            }
          }
        }
      }
    }
  }
}

export async function pushPendingChanges(): Promise<void> {
  // Deduplicate concurrent push calls
  if (pushInProgress) return pushInProgress;
  pushInProgress = doPush();
  try {
    await pushInProgress;
  } finally {
    pushInProgress = null;
  }
}

async function doPush(): Promise<void> {
  const items = await db.syncQueue.orderBy('id').toArray();
  if (items.length === 0) return;

  syncState.value = 'syncing';

  // ID mapping accumulated across the queue replay session
  const idMap: IdMap = new Map();

  for (const item of items) {
    try {
      await replayAction(item, idMap);
      await db.syncQueue.delete(item.id!);
    } catch (err) {
      // Increment retry count
      const retries = item.retries + 1;
      if (retries >= MAX_RETRIES) {
        // Drop permanently failed items
        console.error(`Sync item ${item.id} failed permanently, dropping`, err);
        await db.syncQueue.delete(item.id!);
      } else {
        await db.syncQueue.update(item.id!, { retries });
      }
    }
  }

  await updatePendingCount();
  syncState.value = pendingCount.value > 0 ? 'error' : 'idle';

  // If any IDs were remapped (local records replaced), signal views to refresh
  if (idMap.size > 0) {
    lastSyncAt.value = new Date().toISOString();
  }
}

async function replayAction(
  item: DbSyncQueueItem,
  idMap: IdMap,
): Promise<void> {
  const p = item.payload;

  switch (item.action) {
    // Templates
    case 'createTemplate': {
      const result = await api.createTemplate(p.userId, p.data);
      // Map temp template ID → server ID for subsequent createProgram calls
      if (result?.id && p.data?._tempId && p.data._tempId < 0) {
        idMap.set(p.data._tempId, result.id);
      }
      break;
    }
    case 'updateTemplate':
      await api.updateTemplate(p.userId, remapId(idMap, p.templateId), p.data);
      break;
    case 'deleteTemplate':
      await api.deleteTemplate(p.userId, remapId(idMap, p.templateId));
      break;

    // Programs
    case 'createProgram': {
      // Remap template_id if it was a temp ID from an earlier createTemplate
      const programData = { ...p.data };
      if (programData.template_id && programData.template_id < 0) {
        programData.template_id = remapId(idMap, programData.template_id);
      }

      const serverProgram = await api.createProgram(p.userId, programData);

      // Build ID mappings from local temp IDs to server-assigned IDs.
      // We need the local program from IndexedDB to get the temp IDs.
      if (serverProgram?.id) {
        // Find the local program that matches this creation by name + user
        const localPrograms = await db.programs
          .where('user_id')
          .equals(p.userId)
          .toArray();
        const localProgram = localPrograms.find(
          (lp) =>
            lp.id < 0 &&
            lp.name === serverProgram.name &&
            lp.days?.length === serverProgram.days?.length,
        );
        if (localProgram) {
          buildProgramIdMappings(localProgram, serverProgram, idMap);
          // Replace the temp-ID record with the real server version
          await db.programs.delete(localProgram.id);
          await db.programs.put(normalizeServerProgram(serverProgram));
        }
      }
      break;
    }
    case 'updateProgram':
      await api.updateProgram(p.userId, remapId(idMap, p.programId), p.data);
      break;
    case 'deleteProgram':
      await api.deleteProgram(p.userId, remapId(idMap, p.programId));
      break;
    case 'duplicateProgram': {
      const serverProgram = await api.duplicateProgram(
        p.userId,
        remapId(idMap, p.programId),
        p.name,
      );

      // Replace local temp-ID duplicate with server version
      if (serverProgram?.id) {
        const localPrograms = await db.programs
          .where('user_id')
          .equals(p.userId)
          .toArray();
        const localProgram = localPrograms.find(
          (lp) =>
            lp.id < 0 &&
            lp.name === serverProgram.name &&
            lp.days?.length === serverProgram.days?.length,
        );
        if (localProgram) {
          buildProgramIdMappings(localProgram, serverProgram, idMap);
          // Remove the temp-ID record and insert the real one
          await db.programs.delete(localProgram.id);
          await db.programs.put(normalizeServerProgram(serverProgram));
        }
      }
      break;
    }
    case 'finishProgram':
      await api.finishProgram(p.userId, remapId(idMap, p.programId));
      break;
    case 'importProgram':
      await api.importProgram(p.userId, p.data);
      break;

    // Program session
    case 'updateDay':
      await api.updateDay(
        p.userId,
        remapId(idMap, p.programId),
        remapId(idMap, p.dayId),
        p.data,
      );
      break;
    case 'updateExercise':
      await api.updateExercise(
        p.userId,
        remapId(idMap, p.programId),
        remapId(idMap, p.dayId),
        remapId(idMap, p.exerciseId),
        p.data,
      );
      break;
    case 'updateSet':
      await api.updateSet(
        p.userId,
        remapId(idMap, p.programId),
        remapId(idMap, p.dayId),
        remapId(idMap, p.exerciseId),
        remapId(idMap, p.setId),
        p.data,
      );
      break;

    // Measurements
    case 'createMeasurement':
      await api.createMeasurement(p.userId, p.data);
      break;
    case 'deleteMeasurement':
      await api.deleteMeasurement(p.userId, p.measurementId);
      break;

    // Food
    case 'createFoodItem':
      await api.createFoodItem(p.userId, p.name);
      break;
    case 'updateFoodItem':
      await api.updateFoodItem(p.userId, p.foodItemId, p.name);
      break;
    case 'deleteFoodItem':
      await api.deleteFoodItem(p.userId, p.foodItemId);
      break;
    case 'createBatch':
      await api.createBatch(p.userId, p.foodItemId, p.data);
      break;
    case 'deleteBatch':
      await api.deleteBatch(p.userId, p.foodItemId, p.batchId);
      break;

    default:
      console.warn(`Unknown sync action: ${item.action}`);
  }
}

// ─── Auto-sync on connectivity change ────────────────────────────────────────

let syncInterval: ReturnType<typeof setInterval> | null = null;
let currentUserId: number | null = null;

export function startAutoSync(userId?: number): void {
  if (userId) currentUserId = userId;

  // Listen for online events
  window.addEventListener('online', onOnline);

  // Pull fresh data when tab becomes visible (handles cross-device sync)
  document.addEventListener('visibilitychange', onVisibilityChange);

  // Periodic sync every 30s when online — push AND pull
  syncInterval = setInterval(async () => {
    if (navigator.onLine && currentUserId) {
      try {
        await pushPendingChanges();
        await pullAllData(currentUserId);
      } catch (e) {
        console.error('Periodic sync error:', e);
      }
    }
  }, 30_000);

  // Init pending count
  updatePendingCount();
}

export function stopAutoSync(): void {
  window.removeEventListener('online', onOnline);
  document.removeEventListener('visibilitychange', onVisibilityChange);
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

async function onOnline(): Promise<void> {
  // Push queued changes, then pull fresh data
  try {
    await pushPendingChanges();
    if (currentUserId) {
      await pullAllData(currentUserId);
    }
  } catch (e) {
    console.error('Online sync error:', e);
  }
}

async function onVisibilityChange(): Promise<void> {
  // When the tab/app becomes visible, pull fresh data from server
  if (
    document.visibilityState === 'visible' &&
    navigator.onLine &&
    currentUserId
  ) {
    try {
      await pushPendingChanges();
      await pullAllData(currentUserId);
    } catch (e) {
      console.error('Visibility sync error:', e);
    }
  }
}
