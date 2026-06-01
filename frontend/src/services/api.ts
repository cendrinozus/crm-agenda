import axios from 'axios'

// En production, BASE_URL = /agenda/ (injecté par vite base config)
// En dev, BASE_URL = /
const api = axios.create({
  baseURL: import.meta.env.BASE_URL + 'api',
  withCredentials: true,
})

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post(import.meta.env.BASE_URL + 'api/auth/refresh', {}, {
            headers: { Authorization: `Bearer ${refresh}` },
          })
          localStorage.setItem('access_token', data.access_token)
          original.headers.Authorization = `Bearer ${data.access_token}`
          return api(original)
        } catch {
          localStorage.clear()
          window.location.href = import.meta.env.BASE_URL + 'login'
        }
      }
    }
    return Promise.reject(error)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  me:     () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
}

// ── Calendar ──────────────────────────────────────────────────────────────────
export const calendarApi = {
  sync:         () => api.post('/calendar/sync'),
  status:       () => api.get('/calendar/status'),
  preview:      () => api.get('/calendar/preview'),
  reviewQueue:  () => api.get('/calendar/review'),
  resolveReview:(id: number, data: any) => api.post(`/calendar/review/${id}`, data),
  bulkResolve:  (ids: number[], action: string) =>
    api.post('/calendar/review/bulk', { meeting_ids: ids, action }),
  listExclusions:   () => api.get('/calendar/exclusions'),
  createExclusion:  (data: any) => api.post('/calendar/exclusions', data),
  deleteExclusion:  (id: number) => api.delete(`/calendar/exclusions/${id}`),
  toggleExclusion:  (id: number) => api.patch(`/calendar/exclusions/${id}`),
}

// ── Clients ───────────────────────────────────────────────────────────────────
export const clientsApi = {
  list:             (q?: string) => api.get('/clients', { params: { q } }),
  get:              (id: number) => api.get(`/clients/${id}`),
  update:           (id: number, data: any) => api.put(`/clients/${id}`, data),
  setWorkflowStage: (id: number, stage: string | null) =>
    api.patch(`/clients/${id}/workflow`, { stage }),
  merge:            (id: number, sourceId: number) =>
    api.post(`/clients/${id}/merge`, { source_id: sourceId }),
  delete:           (id: number) => api.delete(`/clients/${id}`),
}

// ── Meetings ──────────────────────────────────────────────────────────────────
export const meetingsApi = {
  list:          (clientId?: number) => api.get('/meetings', { params: { client_id: clientId } }),
  get:           (id: number)        => api.get(`/meetings/${id}`),
  assignClient:  (id: number, clientId: number | null) =>
    api.put(`/meetings/${id}/client`, { client_id: clientId }),
}

// ── Notes ─────────────────────────────────────────────────────────────────────
export const notesApi = {
  create: (meetingId: number, data: any) => api.post(`/notes/meeting/${meetingId}`, data),
  update: (id: number, data: any)        => api.put(`/notes/${id}`, data),
  delete: (id: number)                   => api.delete(`/notes/${id}`),
}

// ── Voice ─────────────────────────────────────────────────────────────────────
export const voiceApi = {
  transcribe: (file: File, meetingId?: number) => {
    const form = new FormData()
    form.append('audio', file)
    if (meetingId) form.append('meeting_id', String(meetingId))
    return api.post('/voice/transcribe', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiApi = {
  summarize:   (meetingId: number) => api.post(`/ai/summarize/${meetingId}`),
  nextAgenda:  (meetingId: number) => api.post(`/ai/next-agenda/${meetingId}`),
  detectTasks: (meetingId: number) => api.post(`/ai/detect-tasks/${meetingId}`),
}

export default api
