/**
 * Shared DTOs — single source of truth for types exchanged between
 * the backend API and the mobile client.
 *
 * Backend maps Prisma models → these types before sending.
 * Mobile stores use these types directly.
 */

// ─── Enums (mirror Prisma enums) ─────────────────────────────

export type Category =
  | 'FOOD_RESTAURANT'
  | 'FOOD_GROCERY'
  | 'COFFEE'
  | 'ALCOHOL'
  | 'TRANSPORT'
  | 'SUBSCRIPTION'
  | 'ENTERTAINMENT'
  | 'CLOTHING'
  | 'ELECTRONICS'
  | 'HEALTH'
  | 'SPORT'
  | 'TRAVEL'
  | 'OTHER'

export type DrSpenderMood =
  | 'CALM'
  | 'INTERESTED'
  | 'AMUSED'
  | 'DEVASTATED'
  | 'IRONICALLY_PLEASED'

export type SuggestionType   = 'SWAP' | 'COOK' | 'CANCEL' | 'RULE' | 'DOWNGRADE' | 'DUPLICATE'
export type SuggestionStatus = 'ACTIVE' | 'ACCEPTED' | 'DISMISSED' | 'EXPIRED'
export type TransactionSource = 'BANK_API' | 'CSV_IMPORT' | 'MANUAL'

// ─── Auth ─────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  name: string
}

export interface AuthResponse {
  user: AuthUser
  token: string
}

// ─── Transactions ─────────────────────────────────────────────

export interface TransactionDTO {
  id: string
  date: string            // ISO 8601
  amount: number
  currency: string
  description: string | null
  merchant: string | null
  category: Category
  source: TransactionSource
  wasteScore: number      // 0–100, 0 if not yet analysed
  isWasted: boolean
  isManual: boolean       // source === 'MANUAL'
}

// ─── Stats ────────────────────────────────────────────────────

export interface CategoryStat {
  category: Category
  total: number
  count: number
  wasteScore: number
}

export interface Equivalent {
  name: string
  price: number
  quantity: number
}

export interface MonthlyStatsDTO {
  month: string           // "yyyy-MM"
  totalSpent: number
  totalWasted: number
  wasteScore: number      // 0–100
  transactionCount: number
  byCategory: CategoryStat[]
  burnRate: number        // PLN/day
  forecast: number | null // projected month-end spend (current month only)
  latteFactor: number | null  // (coffee+restaurant) × 12
  fireImpact: number | null   // totalWasted × 12 × 25
  wastePercentage: number
  equivalents: Equivalent[]
}

export interface SubscriptionDTO {
  merchant: string | null
  category: Category
  amount: number          // monthly equivalent
  interval: string
  isZombie: boolean
  lastUsed: string | null // ISO 8601 or null
}

// ─── Dr. Spender Comments ─────────────────────────────────────

export interface CommentDTO {
  id: string
  text: string            // mapped from DB `content`
  mood: DrSpenderMood
  wasteScore: number      // from linked transaction
  transactionId: string | null
  createdAt: string       // ISO 8601
  isRead: boolean         // mapped from DB `wasRead`
}

// ─── Suggestions ──────────────────────────────────────────────

export interface SuggestionDTO {
  id: string
  type: SuggestionType
  title: string
  description: string     // mapped from DB `howTo`
  drSpenderQuip: string
  annualSavings: number
  monthlySavings: number
  confidence: number      // 0.0–1.0
  status: SuggestionStatus
  actionLabel: string | null
  actionUrl: string | null
  equivalentPurchase: string | null
  createdAt: string       // ISO 8601
}

export interface SuggestionsResponse {
  suggestions: SuggestionDTO[]
  totalPotentialSavings: number
}
