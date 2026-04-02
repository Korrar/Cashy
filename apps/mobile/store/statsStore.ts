import { create } from 'zustand'
import { api } from '../services/api'
import type { Category } from '../constants/categories'

export interface CategoryStat {
  category: Category
  total: number
  count: number
  wasteScore: number
}

export interface MonthlyStats {
  month: string
  totalSpent: number
  totalWasted: number
  wasteScore: number
  transactionCount: number
  byCategory: CategoryStat[]
  forecast: number | null
  latteFactor: number | null
  fireImpact: number | null
  burnRate: number
}

export interface Subscription {
  merchant: string
  category: Category
  amount: number
  interval: string
  isZombie: boolean
  lastUsed: string | null
}

interface StatsState {
  monthly: MonthlyStats | null
  subscriptions: Subscription[]
  isLoading: boolean

  fetchMonthly: (month?: string) => Promise<void>
  fetchSubscriptions: () => Promise<void>
}

export const useStatsStore = create<StatsState>((set) => ({
  monthly: null,
  subscriptions: [],
  isLoading: false,

  async fetchMonthly(month) {
    set({ isLoading: true })
    try {
      const params = month ? { month } : {}
      const { data } = await api.get<MonthlyStats>('/stats/monthly', { params })
      set({ monthly: data, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  async fetchSubscriptions() {
    try {
      const { data } = await api.get<Subscription[]>('/stats/subscriptions')
      set({ subscriptions: data })
    } catch {
      // ignore
    }
  },
}))
