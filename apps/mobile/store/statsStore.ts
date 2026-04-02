import { create } from 'zustand'
import { format, subMonths } from 'date-fns'
import { api } from '../services/api'
import type { Category } from '../constants/categories'

export interface CategoryStat {
  category: Category
  total: number
  count: number
  wasteScore: number
}

export interface MonthlyStats {
  month: string           // "yyyy-MM"
  totalSpent: number
  totalWasted: number
  wasteScore: number
  transactionCount: number
  byCategory: CategoryStat[]
  burnRate: number
  forecast: number | null
  latteFactor: number | null
  fireImpact: number | null
  wastePercentage: number
  equivalents: Array<{ name: string; price: number; quantity: number }>
}

export interface Subscription {
  merchant: string | null
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

  fetchMonthly: (monthOffset?: number) => Promise<void>
  fetchSubscriptions: () => Promise<void>
}

export const useStatsStore = create<StatsState>((set) => ({
  monthly: null,
  subscriptions: [],
  isLoading: false,

  async fetchMonthly(monthOffset = 0) {
    set({ isLoading: true })
    try {
      const month = format(subMonths(new Date(), monthOffset), 'yyyy-MM')
      const { data } = await api.get<MonthlyStats>('/stats/monthly', { params: { month } })
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
