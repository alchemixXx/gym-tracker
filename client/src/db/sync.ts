import { db, type DbSyncQueueItem, type SyncAction } from './index';
import { api } from '../api';
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
      const res = await fetch(url);
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
    const data = await fetchWithRetry(`/api/users/${userId}/sync`);

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

export async function pushPendingChanges(): Promise<void> {
  const items = await db.syncQueue.orderBy('id').toArray();
  if (items.length === 0) return;

  syncState.value = 'syncing';

  for (const item of items) {
    try {
      await replayAction(item);
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
}

async function replayAction(item: DbSyncQueueItem): Promise<void> {
  const p = item.payload;

  switch (item.action) {
    // Templates
    case 'createTemplate':
      await api.createTemplate(p.userId, p.data);
      break;
    case 'updateTemplate':
      await api.updateTemplate(p.userId, p.templateId, p.data);
      break;
    case 'deleteTemplate':
      await api.deleteTemplate(p.userId, p.templateId);
      break;

    // Programs
    case 'createProgram':
      await api.createProgram(p.userId, p.data);
      break;
    case 'updateProgram':
      await api.updateProgram(p.userId, p.programId, p.data);
      break;
    case 'deleteProgram':
      await api.deleteProgram(p.userId, p.programId);
      break;
    case 'duplicateProgram':
      await api.duplicateProgram(p.userId, p.programId, p.name);
      break;
    case 'finishProgram':
      await api.finishProgram(p.userId, p.programId);
      break;
    case 'importProgram':
      await api.importProgram(p.userId, p.data);
      break;

    // Program session
    case 'updateDay':
      await api.updateDay(p.userId, p.programId, p.dayId, p.data);
      break;
    case 'updateExercise':
      await api.updateExercise(
        p.userId,
        p.programId,
        p.dayId,
        p.exerciseId,
        p.data,
      );
      break;
    case 'updateSet':
      await api.updateSet(
        p.userId,
        p.programId,
        p.dayId,
        p.exerciseId,
        p.setId,
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

export function startAutoSync(): void {
  // Listen for online events
  window.addEventListener('online', onOnline);

  // Periodic sync every 30s when online
  syncInterval = setInterval(() => {
    if (navigator.onLine) {
      pushPendingChanges().catch(console.error);
    }
  }, 30_000);

  // Init pending count
  updatePendingCount();
}

export function stopAutoSync(): void {
  window.removeEventListener('online', onOnline);
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

async function onOnline(): Promise<void> {
  // Push queued changes, then pull fresh data
  await pushPendingChanges();
}
