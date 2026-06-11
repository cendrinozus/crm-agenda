import { create } from 'zustand'
import { authApi } from '../services/api'

interface User {
  id: number
  email: string
  name: string
  picture?: string
}

interface AuthStore {
  user: User | null
  loading: boolean
  setTokens: (access: string, refresh: string) => void
  fetchMe: () => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,

  setTokens(access, refresh) {
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
  },

  async fetchMe() {
    const token = localStorage.getItem('access_token')
    if (!token) { set({ loading: false }); return }
    try {
      const { data } = await authApi.me()
      set({ user: data, loading: false })
    } catch {
      set({ user: null, loading: false })
    }
  },

  logout() {
    localStorage.clear()
    set({ user: null })
    window.location.href = import.meta.env.BASE_URL + 'login'
  },
}))
