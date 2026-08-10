import { ref } from 'vue';
import { Capacitor } from '@capacitor/core';

// In native app, use the full server URL; in web, use relative path (proxied by Vite)
const BASE_URL = Capacitor.isNativePlatform()
  ? (import.meta.env.VITE_API_URL || 'https://gym-tracker-nm7e.onrender.com') +
    '/api'
  : '/api';

/** Expose base URL for modules that build their own fetch calls */
export function getBaseUrl(): string {
  return BASE_URL;
}

/** Reactive flag: true while the server is cold-starting */
export const serverWaking = ref(false);

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3000;

// --- Token management ---

const TOKEN_STORAGE_KEY = 'gym-tracker-tokens';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

let tokens: TokenPair | null = null;

// Restore tokens from localStorage
const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
if (stored) {
  try {
    tokens = JSON.parse(stored);
  } catch {}
}

export function setTokens(pair: TokenPair) {
  tokens = pair;
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(pair));
  sessionExpiredFired = false; // Reset on new login/refresh
}

export function getTokens(): TokenPair | null {
  return tokens;
}

export function clearTokens() {
  tokens = null;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function isAuthenticated(): boolean {
  return tokens !== null;
}

// --- Session expiry callback ---
// Called when a 401 occurs and token refresh fails (unrecoverable auth failure).
// Registered externally (e.g. by the router plugin) to trigger logout + redirect.
let onSessionExpiredCallback: (() => void) | null = null;
let sessionExpiredFired = false;

export function onSessionExpired(cb: () => void) {
  onSessionExpiredCallback = cb;
}

export function notifySessionExpired() {
  if (sessionExpiredFired) return; // Only fire once per session
  sessionExpiredFired = true;
  if (onSessionExpiredCallback) {
    onSessionExpiredCallback();
  }
}

/** Reset the session-expired flag (call after successful login) */
export function resetSessionExpired() {
  sessionExpiredFired = false;
}

// Flag to prevent multiple simultaneous refresh calls
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!tokens?.refreshToken) return false;

  // Deduplicate concurrent refresh calls
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens!.refreshToken }),
      });

      if (!res.ok) {
        // Refresh token is invalid/expired — force logout
        clearTokens();
        return false;
      }

      const data = await res.json();
      setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// --- Request helper ---

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
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options?.headers as Record<string, string>),
      };

      // Attach auth token if available
      if (tokens?.accessToken) {
        headers['Authorization'] = `Bearer ${tokens.accessToken}`;
      }

      res = await fetch(`${BASE_URL}${url}`, {
        ...options,
        headers,
      });

      if (!isNetworkOrServerError(null, res)) {
        // Server is alive — clear waking state
        serverWaking.value = false;

        // Handle 401 — try to refresh token and retry once
        if (res.status === 401 && tokens?.refreshToken) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            // Retry the original request with new token
            const retryHeaders: Record<string, string> = {
              'Content-Type': 'application/json',
              ...(options?.headers as Record<string, string>),
              Authorization: `Bearer ${tokens!.accessToken}`,
            };
            const retryRes = await fetch(`${BASE_URL}${url}`, {
              ...options,
              headers: retryHeaders,
            });
            if (!retryRes.ok) {
              const error = await retryRes
                .json()
                .catch(() => ({ error: 'Request failed' }));
              throw new Error(error.error || 'Request failed');
            }
            return retryRes.json();
          }
          // Refresh failed — session is dead, notify and throw
          notifySessionExpired();
          throw new Error('Session expired');
        }

        // 401 with no refresh token — session is invalid
        if (res.status === 401) {
          notifySessionExpired();
          throw new Error('Session expired');
        }

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

/**
 * Like request() but for FormData (no Content-Type header — browser sets multipart boundary).
 */
async function uploadRequest<T>(url: string, options: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (tokens?.accessToken) {
    headers['Authorization'] = `Bearer ${tokens.accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && tokens?.refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retryHeaders: Record<string, string> = {
        Authorization: `Bearer ${tokens!.accessToken}`,
      };
      const retryRes = await fetch(`${BASE_URL}${url}`, {
        ...options,
        headers: retryHeaders,
      });
      if (!retryRes.ok) throw new Error('Upload failed');
      return retryRes.json();
    }
    notifySessionExpired();
    throw new Error('Session expired');
  }

  if (res.status === 401) {
    notifySessionExpired();
    throw new Error('Session expired');
  }

  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

// --- Auth API ---

export const authApi = {
  requestMagicLink: (email: string) =>
    request<{ message: string }>('/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  verifyMagicLink: (token: string) =>
    request<{
      accessToken?: string;
      refreshToken?: string;
      user?: any;
      needsClaim?: boolean;
      claimToken?: string;
      unclaimedUsers?: any[];
    }>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  claimAccount: (claimToken: string, userId: number | null) =>
    request<{ accessToken: string; refreshToken: string; user: any }>(
      '/auth/claim',
      {
        method: 'POST',
        body: JSON.stringify({ claimToken, userId }),
      },
    ),

  refreshToken: () =>
    request<{ accessToken: string; refreshToken: string; user: any }>(
      '/auth/refresh',
      {
        method: 'POST',
        body: JSON.stringify({ refreshToken: tokens?.refreshToken }),
      },
    ),

  logout: () =>
    request<{ message: string }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: tokens?.refreshToken }),
    }),

  getMe: () => request<any>('/users/me'),
};

// --- Data API ---

export const api = {
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
    return uploadRequest<any>(
      `/users/${userId}/measurements/${measurementId}/photos`,
      {
        method: 'POST',
        body: formData,
      },
    );
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

  // Sync
  syncAll: (userId: number) => request<any>(`/users/${userId}/sync`),
};
