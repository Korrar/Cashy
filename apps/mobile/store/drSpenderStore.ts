import { create } from 'zustand'
import { api } from '../services/api'

export interface DrSpenderComment {
  id: string
  text: string
  mood: string
  wasteScore: number
  transactionId: string | null
  createdAt: string
  isRead: boolean
}

export interface Suggestion {
  id: string
  type: string
  title: string
  description: string
  annualSavings: number
  confidence: number
  status: 'ACTIVE' | 'ACCEPTED' | 'DISMISSED' | 'EXPIRED'
  actionLabel: string | null
  actionUrl: string | null
  createdAt: string
}

interface DrSpenderState {
  comments: DrSpenderComment[]
  suggestions: Suggestion[]
  unreadCount: number
  isLoading: boolean

  fetchComments: () => Promise<void>
  fetchSuggestions: () => Promise<void>
  markRead: (id: string) => Promise<void>
  acceptSuggestion: (id: string) => Promise<void>
  dismissSuggestion: (id: string) => Promise<void>
}

export const useDrSpenderStore = create<DrSpenderState>((set, get) => ({
  comments: [],
  suggestions: [],
  unreadCount: 0,
  isLoading: false,

  async fetchComments() {
    set({ isLoading: true })
    try {
      const { data } = await api.get<DrSpenderComment[]>('/stats/comments')
      set({
        comments: data,
        unreadCount: data.filter((c) => !c.isRead).length,
        isLoading: false,
      })
    } catch {
      set({ isLoading: false })
    }
  },

  async fetchSuggestions() {
    try {
      const { data } = await api.get<Suggestion[]>('/suggestions')
      set({ suggestions: data })
    } catch {
      // ignore
    }
  },

  async markRead(id) {
    await api.patch(`/stats/comments/${id}/read`)
    set((s) => ({
      comments: s.comments.map((c) => (c.id === id ? { ...c, isRead: true } : c)),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }))
  },

  async acceptSuggestion(id) {
    await api.patch(`/suggestions/${id}/accept`)
    set((s) => ({
      suggestions: s.suggestions.map((sg) =>
        sg.id === id ? { ...sg, status: 'ACCEPTED' as const } : sg,
      ),
    }))
  },

  async dismissSuggestion(id) {
    await api.patch(`/suggestions/${id}/dismiss`)
    set((s) => ({
      suggestions: s.suggestions.filter((sg) => sg.id !== id),
    }))
  },
}))
