const BASE_URL = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
}

// Users
export const api = {
  // Users
  getUsers: () => request<any[]>('/users'),
  createUser: (name: string) => request<any>('/users', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }),

  // Templates
  getTemplates: (userId: number) => request<any[]>(`/users/${userId}/templates`),
  getTemplate: (userId: number, id: number) => request<any>(`/users/${userId}/templates/${id}`),
  createTemplate: (userId: number, data: any) => request<any>(`/users/${userId}/templates`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateTemplate: (userId: number, id: number, data: any) => request<any>(`/users/${userId}/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteTemplate: (userId: number, id: number) => request<any>(`/users/${userId}/templates/${id}`, {
    method: 'DELETE',
  }),

  // Programs
  getPrograms: (userId: number) => request<any[]>(`/users/${userId}/programs`),
  getProgram: (userId: number, id: number) => request<any>(`/users/${userId}/programs/${id}`),
  createProgram: (userId: number, data: any) => request<any>(`/users/${userId}/programs`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateProgram: (userId: number, id: number, data: any) => request<any>(`/users/${userId}/programs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteProgram: (userId: number, id: number) => request<any>(`/users/${userId}/programs/${id}`, {
    method: 'DELETE',
  }),

  // Program session actions
  updateDay: (userId: number, programId: number, dayId: number, data: any) =>
    request<any>(`/users/${userId}/programs/${programId}/days/${dayId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateExercise: (userId: number, programId: number, dayId: number, exId: number, data: any) =>
    request<any>(`/users/${userId}/programs/${programId}/days/${dayId}/exercises/${exId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateSet: (userId: number, programId: number, dayId: number, exId: number, setId: number, data: any) =>
    request<any>(`/users/${userId}/programs/${programId}/days/${dayId}/exercises/${exId}/sets/${setId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Measurements
  getMeasurements: (userId: number) => request<any[]>(`/users/${userId}/measurements`),
  createMeasurement: (userId: number, data: any) => request<any>(`/users/${userId}/measurements`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  deleteMeasurement: (userId: number, id: number) => request<any>(`/users/${userId}/measurements/${id}`, {
    method: 'DELETE',
  }),
};
