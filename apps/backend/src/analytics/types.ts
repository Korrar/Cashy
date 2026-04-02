// ============================================================
// Spendr Analytics Engine — Shared Types
// All internal types for the analytics pipeline.
// External-facing types live in packages/shared/types/.
// ============================================================

// ─── Raw input ───────────────────────────────────────────────

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

export interface Transaction {
  id: string
  userId: string
  amount: number
  currency: string
  category: Category
  merchant: string | null
  description: string | null
  date: Date
  // Derived fields (set by pipeline on first insert)
  wasteScore: number | null
  isWasted: boolean
}

// ─── Analysis context ────────────────────────────────────────

/** Full context passed into every analyzer. Built once per analysis run. */
export interface AnalysisContext {
  userId: string
  transaction: Transaction                   // The triggering transaction
  history: {
    last30Days: Transaction[]
    last90Days: Transaction[]
    allTime: Transaction[]
  }
  calendar: CalendarContext
  userSettings: UserSettings
}

export interface CalendarContext {
  dayOfWeek: number          // 0 = Sunday
  hour: number               // 0–23
  dayOfMonth: number
  isWeekend: boolean
  isNight: boolean           // 22:00–05:00
  daysElapsedInMonth: number
  daysRemainingInMonth: number
  monthlyBudget: number | null
}

export interface UserSettings {
  monthlyNetIncome: number | null
  categoryBudgets: Partial<Record<Category, number>>
  drSpenderAggressiveness: 'gentle' | 'normal' | 'ruthless' | 'no_mercy'
}

// ─── Analyzer outputs ────────────────────────────────────────

/** Every analyzer returns this shape. */
export interface AnalyzerResult<T = unknown> {
  analyzerId: string
  findings: T
  signals: Signal[]           // Normalized signals consumed by scoring & suggestions
}

/** A single detected signal — the unit of communication between analyzers
 *  and the scoring/suggestion layer.                                        */
export interface Signal {
  type: SignalType
  severity: 'info' | 'warning' | 'critical'
  value: number               // Numeric magnitude (context-dependent)
  label: string               // Human-readable, used in Dr. Spender prompts
  metadata: Record<string, unknown>
}

export type SignalType =
  // Anomaly signals
  | 'AMOUNT_ANOMALY'           // z-score spike vs category baseline
  | 'FIRST_TIME_MERCHANT'
  | 'FIRST_TIME_CATEGORY_THIS_MONTH'
  // Pattern signals
  | 'FREQUENCY_ESCALATION'     // category frequency accelerating (hedonic adaptation)
  | 'POST_PAYDAY_SPIKE'        // mental accounting — spending surge after salary
  | 'NIGHT_PURCHASE'
  | 'WEEKEND_PATTERN'
  | 'RECURRING_DAY_PATTERN'    // e.g. every Friday, delivery
  // Behavioral signals
  | 'PRESENT_BIAS'             // night impulse + high amount
  | 'SUNK_COST_SUBSCRIPTION'   // loss aversion keeping zombie alive
  | 'MENTAL_ACCOUNTING_BONUS'  // spending spike after inbound transfer
  | 'HEDONIC_ADAPTATION'       // diminishing returns, escalating frequency
  | 'ANCHORING_EFFECT'         // category spend rose after high-value transaction
  // Financial framework signals
  | 'BUDGET_EXCEEDED'          // envelope empty
  | 'WANTS_OVER_50PCT'         // 50/30/20: wants bucket overflowing
  | 'BURN_RATE_CRITICAL'       // will exceed budget before month ends
  | 'LATTE_FACTOR'             // small recurring → compound opportunity
  | 'FIRE_IMPACT'              // annualized + compounded waste
  // Recurrence signals
  | 'ZOMBIE_SUBSCRIPTION'
  | 'DUPLICATE_SUBSCRIPTION'
  | 'NEW_SUBSCRIPTION_DETECTED'

// ─── Scoring outputs ────────────────────────────────────────

export interface WasteScoreResult {
  score: number               // 0–100
  breakdown: WasteScoreBreakdown
}

export interface WasteScoreBreakdown {
  categoryBase: number        // 0–40
  frequencyPenalty: number    // 0–20
  amountAnomalyPenalty: number // 0–15
  nightPenalty: number        // 0–10
  zombieSubscriptionPenalty: number // 0–30
  impulsePenalty: number      // 0–5
}

export interface FinancialHealthScore {
  overall: number             // 0–100 (higher = healthier)
  components: {
    budgetAdherence: number   // vs declared budgets
    wasteRatio: number        // wasted / total
    savingsRate: number | null // only if income declared
    subscriptionHealth: number // zombie ratio
    forecastSafety: number    // will budget survive month?
  }
  trend: 'improving' | 'stable' | 'deteriorating'
}

// ─── Forecasting outputs ─────────────────────────────────────

export interface BurnRateResult {
  dailyBurnRate: number
  projectedMonthEnd: number
  daysUntilBudgetExhausted: number | null  // null if no budget set
  confidence: 'high' | 'medium' | 'low'
  intervalLow: number
  intervalHigh: number
}

export interface ForecastResult {
  nextMonthEstimate: number
  method: 'exponential_smoothing' | 'pace' | 'day_of_week_adjusted'
  confidence: 'high' | 'medium' | 'low'
}

// ─── Pattern detection outputs ──────────────────────────────

export interface DetectedPattern {
  type: PatternType
  description: string
  affectedTransactionIds: string[]
  monthlyCost: number
  confidence: number             // 0–1
  firstDetected: Date
  metadata: Record<string, unknown>
}

export type PatternType =
  | 'FRIDAY_TAKEOUT'
  | 'MORNING_COFFEE'
  | 'WEEKEND_SHOPPING'
  | 'LATE_NIGHT_DELIVERY'
  | 'RECURRING_SUBSCRIPTION'
  | 'POST_PAYDAY_SPLURGE'
  | 'FREQUENCY_ESCALATION'
  | 'ANCHORING_DRIFT'

export interface RecurringPayment {
  merchant: string
  periodDays: number             // 7 | 14 | 30 | 90 | 365
  periodLabel: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual'
  monthlyEquivalent: number
  coefficientOfVariation: number // < 0.15 = subscription
  isZombie: boolean
  daysSinceInferred: number      // proxy for last use
  transactions: Transaction[]
}

// ─── Suggestion outputs ──────────────────────────────────────

export type SuggestionType = 'SWAP' | 'COOK' | 'CANCEL' | 'RULE' | 'DOWNGRADE' | 'DUPLICATE'

export interface SuggestionCandidate {
  type: SuggestionType
  title: string
  monthlySavings: number
  annualSavings: number
  howTo: string
  actionLabel?: string
  actionUrl?: string
  equivalentPurchase?: string    // "Za to mógłbyś kupić..."
  drSpenderQuip: string          // prompt fragment for Claude
  confidence: number             // 0–1
  sourceSignals: SignalType[]    // which signals triggered this
  relatedTransactionIds: string[]
}

// ─── Pipeline output ─────────────────────────────────────────

/** Final result of a full pipeline run for one transaction. */
export interface PipelineResult {
  transactionId: string
  userId: string
  ranAt: Date
  wasteScore: WasteScoreResult
  signals: Signal[]
  patterns: DetectedPattern[]
  recurringPayments: RecurringPayment[]
  burnRate: BurnRateResult
  suggestions: SuggestionCandidate[]
  financialHealth: FinancialHealthScore
  drSpenderContext: DrSpenderContext
}

/** Structured context sent to Claude API for comment generation. */
export interface DrSpenderContext {
  transaction: {
    amount: number
    currency: string
    category: Category
    merchant: string | null
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
    dayOfWeek: string
    isNight: boolean
    isWeekend: boolean
  }
  history: {
    categoryThisMonth: number
    categoryLastMonth: number
    transactionCountThisMonth: number
    daysSinceLastInCategory: number | null
  }
  topSignals: Signal[]           // Max 3 most severe signals
  activePatterns: string[]       // Pattern descriptions
  wasteScore: number
  mood: DrSpenderMood
  suggestion: SuggestionCandidate | null
}

export type DrSpenderMood =
  | 'calm'
  | 'interested'
  | 'amused'
  | 'devastated'
  | 'ironically_pleased'
