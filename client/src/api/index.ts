import { ref } from 'vue';

const BASE_URL = '/api';

/** Reactive flag: true while the server is cold-starting */
export const serverWaking = ref(false);

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNetworkOrServerError(err: unknown, res?: Response): boolean {
  if (!res) return true; // fetch threw — network error
  return res.status === 502 || res.status === 503 || res.status === 504;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res: Response | undefined;
    try {
      res = await fetch(`${BASE_URL}${url}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });

      if (!isNetworkOrServerError(null, res)) {
        // Server is alive — clear waking state
        serverWaking.value = false;

        if (!res.ok) {
          const error = await res
            .json()
            .catch(() => ({ error: 'Request failed' }));
          throw new Error(error.error || 'Request failed');
        }
        return res.json();
      }
    } catch (err) {
      // Network error (server not reachable)
      if (res && !isNetworkOrServerError(err, res)) {
        throw err;
      }
      lastError = err;
    }

    // Server unavailable — mark as waking and retry
    serverWaking.value = true;
    if (attempt < MAX_RETRIES) {
      await sleep(RETRY_DELAY_MS);
    }
  }

  serverWaking.value = false;
  throw lastError || new Error('Server unavailable');
}

// Users
export const api = {
  // Users
  getUsers: () => request<any[]>('/users'),
  createUser: (name: string) =>
    request<any>('/users', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  // Templates
  getTemplates: (userId: number) =>
    request<any[]>(`/users/${userId}/templates`),
  getTemplate: (userId: number, id: number) =>
    request<any>(`/users/${userId}/templates/${id}`),
  createTemplate: (userId: number, data: any) =>
    request<any>(`/users/${userId}/templates`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTemplate: (userId: number, id: number, data: any) =>
    request<any>(`/users/${userId}/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteTemplate: (userId: number, id: number) =>
    request<any>(`/users/${userId}/templates/${id}`, {
      method: 'DELETE',
    }),

  // Programs
  getPrograms: (userId: number) => request<any[]>(`/users/${userId}/programs`),
  getProgram: (userId: number, id: number) =>
    request<any>(`/users/${userId}/programs/${id}`),
  createProgram: (userId: number, data: any) =>
    request<any>(`/users/${userId}/programs`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProgram: (userId: number, id: number, data: any) =>
    request<any>(`/users/${userId}/programs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  duplicateProgram: (userId: number, id: number, name?: string) =>
    request<any>(`/users/${userId}/programs/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  finishProgram: (userId: number, id: number) =>
    request<any>(`/users/${userId}/programs/${id}/finish`, {
      method: 'POST',
    }),
  exportProgram: (userId: number, id: number) =>
    request<any>(`/users/${userId}/programs/${id}/export`),
  importProgram: (userId: number, data: any) =>
    request<any>(`/users/${userId}/programs/import`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteProgram: (userId: number, id: number) =>
    request<any>(`/users/${userId}/programs/${id}`, {
      method: 'DELETE',
    }),

  // Program session actions
  updateDay: (userId: number, programId: number, dayId: number, data: any) =>
    request<any>(`/users/${userId}/programs/${programId}/days/${dayId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateExercise: (
    userId: number,
    programId: number,
    dayId: number,
    exId: number,
    data: any,
  ) =>
    request<any>(
      `/users/${userId}/programs/${programId}/days/${dayId}/exercises/${exId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
    ),
  updateSet: (
    userId: number,
    programId: number,
    dayId: number,
    exId: number,
    setId: number,
    data: any,
  ) =>
    request<any>(
      `/users/${userId}/programs/${programId}/days/${dayId}/exercises/${exId}/sets/${setId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
    ),

  // Exercise history (notes from past trainings)
  getExerciseHistory: (
    userId: number,
    programId: number,
    dayName: string,
    exerciseName: string,
  ) =>
    request<any[]>(
      `/users/${userId}/programs/${programId}/exercise-history?dayName=${encodeURIComponent(dayName)}&exerciseName=${encodeURIComponent(exerciseName)}`,
    ),

  // Day history (day_notes from past trainings)
  getDayHistory: (userId: number, programId: number, dayName: string) =>
    request<any[]>(
      `/users/${userId}/programs/${programId}/day-history?dayName=${encodeURIComponent(dayName)}`,
    ),

  // Measurements
  getMeasurements: (userId: number) =>
    request<any[]>(`/users/${userId}/measurements`),
  createMeasurement: (userId: number, data: any) =>
    request<any>(`/users/${userId}/measurements`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteMeasurement: (userId: number, id: number) =>
    request<any>(`/users/${userId}/measurements/${id}`, {
      method: 'DELETE',
    }),

  // Measurement photos
  uploadMeasurementPhotos: (
    userId: number,
    measurementId: number,
    files: File[],
  ) => {
    const formData = new FormData();
    for (const file of files) {
      formData.append('photos', file);
    }
    return fetch(
      `${BASE_URL}/users/${userId}/measurements/${measurementId}/photos`,
      {
        method: 'POST',
        body: formData,
      },
    ).then((res) => {
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    });
  },
  deleteMeasurementPhoto: (
    userId: number,
    measurementId: number,
    photoId: number,
  ) =>
    request<any>(
      `/users/${userId}/measurements/${measurementId}/photos/${photoId}`,
      {
        method: 'DELETE',
      },
    ),

  // Food items
  getFoodItems: (userId: number) =>
    request<any[]>(`/users/${userId}/food-items`),
  createFoodItem: (userId: number, name: string) =>
    request<any>(`/users/${userId}/food-items`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  updateFoodItem: (userId: number, id: number, name: string) =>
    request<any>(`/users/${userId}/food-items/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    }),
  deleteFoodItem: (userId: number, id: number) =>
    request<any>(`/users/${userId}/food-items/${id}`, {
      method: 'DELETE',
    }),

  // Cooking batches
  getBatches: (userId: number, foodItemId: number) =>
    request<any[]>(`/users/${userId}/food-items/${foodItemId}/batches`),
  createBatch: (
    userId: number,
    foodItemId: number,
    data: { raw_weight: number; cooked_weight: number; notes?: string },
  ) =>
    request<any>(`/users/${userId}/food-items/${foodItemId}/batches`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteBatch: (userId: number, foodItemId: number, batchId: number) =>
    request<any>(
      `/users/${userId}/food-items/${foodItemId}/batches/${batchId}`,
      {
        method: 'DELETE',
      },
    ),
  getFoodRatio: (userId: number, foodItemId: number) =>
    request<any>(`/users/${userId}/food-items/${foodItemId}/ratio`),
};
