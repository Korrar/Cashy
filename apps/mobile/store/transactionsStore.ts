import { create } from 'zustand'
import { api } from '../services/api'
import type { Category } from '../constants/categories'

export interface Transaction {
  id: string
  date: string
  amount: number
  description: string
  merchant: string | null
  category: Category
  wasteScore: number
  isManual: boolean
}

interface TransactionsState {
  items: Transaction[]
  isLoading: boolean
  hasMore: boolean
  page: number

  fetch: (reset?: boolean) => Promise<void>
  add: (tx: Omit<Transaction, 'id' | 'wasteScore'>) => Promise<void>
  updateCategory: (id: string, category: Category) => Promise<void>
}

const PAGE_SIZE = 30

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  items: [],
  isLoading: false,
  hasMore: true,
  page: 1,

  async fetch(reset = false) {
    if (get().isLoading) return
    const page = reset ? 1 : get().page
    set({ isLoading: true })
    try {
      const { data } = await api.get<Transaction[]>('/transactions', {
        params: { page, limit: PAGE_SIZE },
      })
      set((s) => ({
        items: reset ? data : [...s.items, ...data],
        page: page + 1,
        hasMore: data.length === PAGE_SIZE,
        isLoading: false,
      }))
    } catch {
      set({ isLoading: false })
    }
  },

  async add(tx) {
    const { data } = await api.post<Transaction>('/transactions', tx)
    set((s) => ({ items: [data, ...s.items] }))
  },

  async updateCategory(id, category) {
    await api.patch(`/transactions/${id}/category`, { category })
    set((s) => ({
      items: s.items.map((t) => (t.id === id ? { ...t, category } : t)),
    }))
  },
}))
