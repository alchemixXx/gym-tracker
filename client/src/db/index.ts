import Dexie, { type Table } from 'dexie';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DbUser {
  id: number;
  name: string;
  created_at: string;
}

export interface DbTemplateSet {
  weight: number | null;
  reps: number;
  count: number;
  sort_order: number;
}

export interface DbTemplateExercise {
  name: string;
  sort_order: number;
  sets: DbTemplateSet[];
}

export interface DbTemplateDay {
  name: string;
  sort_order: number;
  exercises: DbTemplateExercise[];
}

export interface DbTemplate {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
  updated_at: string;
  days: DbTemplateDay[];
}

export interface DbProgramSet {
  id: number;
  weight: number | null;
  reps: number;
  count: number;
  done: boolean;
  sort_order: number;
}

export interface DbProgramExercise {
  id: number;
  name: string;
  sort_order: number;
  note: string | null;
  sets: DbProgramSet[];
}

export interface DbProgramDay {
  id: number;
  name: string;
  sort_order: number;
  day_note: string | null;
  completed_at: string | null;
  exercises: DbProgramExercise[];
}

export interface DbProgram {
  id: number;
  user_id: number;
  template_id: number | null;
  name: string;
  status: string;
  start_date: string | null;
  created_at: string;
  updated_at: string;
  days: DbProgramDay[];
}

export interface DbMeasurementEntry {
  id: number;
  type: string;
  value: number;
}

export interface DbMeasurementPhotoMeta {
  id: number;
  original_name: string;
  mime_type: string;
  created_at: string;
}

export interface DbMeasurement {
  id: number;
  user_id: number;
  date: string;
  weight: number | null;
  notes: string | null;
  created_at: string;
  entries: DbMeasurementEntry[];
  /** Only metadata — actual photo blobs stay server-side */
  photos: DbMeasurementPhotoMeta[];
}

export interface DbFoodItem {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
}

export interface DbCookingBatch {
  id: number;
  food_item_id: number;
  raw_weight: number;
  cooked_weight: number;
  cooked_at: string;
  notes: string | null;
}

export type SyncAction =
  | 'createTemplate'
  | 'updateTemplate'
  | 'deleteTemplate'
  | 'createProgram'
  | 'updateProgram'
  | 'deleteProgram'
  | 'duplicateProgram'
  | 'finishProgram'
  | 'updateDay'
  | 'updateExercise'
  | 'updateSet'
  | 'createMeasurement'
  | 'deleteMeasurement'
  | 'createFoodItem'
  | 'updateFoodItem'
  | 'deleteFoodItem'
  | 'createBatch'
  | 'deleteBatch';

export interface DbSyncQueueItem {
  id?: number;
  action: SyncAction;
  payload: any;
  created_at: string;
  retries: number;
}

export interface DbSyncMeta {
  key: string;
  value: string;
}

// ─── Database ────────────────────────────────────────────────────────────────

class GymTrackerDB extends Dexie {
  users!: Table<DbUser, number>;
  templates!: Table<DbTemplate, number>;
  programs!: Table<DbProgram, number>;
  measurements!: Table<DbMeasurement, number>;
  foodItems!: Table<DbFoodItem, number>;
  cookingBatches!: Table<DbCookingBatch, number>;
  syncQueue!: Table<DbSyncQueueItem, number>;
  syncMeta!: Table<DbSyncMeta, string>;

  constructor() {
    super('gym-tracker');

    this.version(1).stores({
      users: 'id, name',
      templates: 'id, user_id',
      programs: 'id, user_id, status',
      measurements: 'id, user_id, date',
      foodItems: 'id, user_id',
      cookingBatches: 'id, food_item_id',
      syncQueue: '++id, action, created_at',
      syncMeta: 'key',
    });
  }
}

export const db = new GymTrackerDB();
