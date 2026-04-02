import { create } from 'zustand'
import { api, storage } from '../services/api'

export interface AuthUser {
  id: string
  email: string
  name: string
  expoPushToken?: string
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  isLoading: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  hydrate: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoading: false,
  error: null,

  hydrate() {
    const token = storage.getString('auth_token')
    const raw   = storage.getString('auth_user')
    if (token && raw) {
      set({ token, user: JSON.parse(raw) })
    }
  },

  async login(email, password) {
    set({ isLoading: true, error: null })
    try {
      const { data } = await api.post('/auth/login', { email, password })
      storage.set('auth_token', data.token)
      storage.set('auth_user', JSON.stringify(data.user))
      set({ token: data.token, user: data.user, isLoading: false })
    } catch (e: any) {
      set({ isLoading: false, error: e.response?.data?.error ?? 'Błąd logowania' })
      throw e
    }
  },

  async register(email, password, name) {
    set({ isLoading: true, error: null })
    try {
      const { data } = await api.post('/auth/register', { email, password, name })
      storage.set('auth_token', data.token)
      storage.set('auth_user', JSON.stringify(data.user))
      set({ token: data.token, user: data.user, isLoading: false })
    } catch (e: any) {
      set({ isLoading: false, error: e.response?.data?.error ?? 'Błąd rejestracji' })
      throw e
    }
  },

  logout() {
    storage.delete('auth_token')
    storage.delete('auth_user')
    set({ token: null, user: null })
  },
}))
