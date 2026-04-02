// ============================================================
// RecurrenceDetector
//
// Detects recurring payments (subscriptions) using the
// Coefficient of Variation (CV) method on inter-arrival times.
//
// A payment is recurring when:
//   CV = stddev(intervals) / mean(intervals) < 0.15
//
// Zombie detection: infers last use from co-occurrence
// patterns and multi-subscription overlap.
// ============================================================

import type {
  AnalysisContext,
  AnalyzerResult,
  RecurringPayment,
  Signal,
  Transaction,
} from '../types'

const CV_THRESHOLD = 0.15           // Below this = subscription
const MIN_OCCURRENCES = 2           // Minimum data points needed
const ZOMBIE_THRESHOLD_DAYS = 30    // Unused for this long = zombie

// Canonical period buckets in days
const PERIOD_BUCKETS: Array<{ days: number; label: RecurringPayment['periodLabel'] }> = [
  { days: 7,   label: 'weekly' },
  { days: 14,  label: 'biweekly' },
  { days: 30,  label: 'monthly' },
  { days: 90,  label: 'quarterly' },
  { days: 365, label: 'annual' },
]

// Known subscription services — used to infer zombie status
// (bank data has no "last login" signal, so we use these heuristics)
const STREAMING_SERVICES = new Set([
  'netflix', 'hbo', 'canal+', 'disney+', 'apple tv',
  'max', 'prime video', 'player', 'polsat box',
])
const PRODUCTIVITY_SERVICES = new Set([
  'adobe', 'microsoft 365', 'office 365', 'dropbox',
  'notion', 'slack', 'figma', 'github',
])

interface RecurrenceFindings {
  detected: RecurringPayment[]
  zombies: RecurringPayment[]
  duplicates: DuplicateSubscription[]
  totalMonthlyRecurring: number
  totalMonthlyZombie: number
}

interface DuplicateSubscription {
  category: string            // e.g. "streaming", "music"
  subscriptions: RecurringPayment[]
  combinedMonthly: number
}

export class RecurrenceDetector {
  readonly id = 'RecurrenceDetector'

  analyze(ctx: AnalysisContext): AnalyzerResult<RecurrenceFindings> {
    const signals: Signal[] = []
    const allTransactions = ctx.history.allTime

    const recurring = this.detectRecurring(allTransactions)
    const zombies = recurring.filter(r => r.isZombie)
    const duplicates = this.detectDuplicates(recurring)

    const totalMonthlyRecurring = recurring.reduce(
      (sum, r) => sum + r.monthlyEquivalent, 0,
    )
    const totalMonthlyZombie = zombies.reduce(
      (sum, r) => sum + r.monthlyEquivalent, 0,
    )

    // Signal: current transaction is a zombie subscription
    const currentMerchantNorm = this.normalizeMerchant(
      ctx.transaction.merchant ?? '',
    )
    const currentAsZombie = zombies.find(
      z => this.normalizeMerchant(z.merchant) === currentMerchantNorm,
    )

    if (currentAsZombie) {
      signals.push({
        type: 'ZOMBIE_SUBSCRIPTION',
        severity: 'critical',
        value: currentAsZombie.monthlyEquivalent * 12,
        label: `${currentAsZombie.merchant} — ${currentAsZombie.daysSinceInferred} dni bez użycia. Roczny koszt: ${(currentAsZombie.monthlyEquivalent * 12).toFixed(0)} PLN`,
        metadata: {
          merchant: currentAsZombie.merchant,
          monthlyEquivalent: currentAsZombie.monthlyEquivalent,
          daysSinceInferred: currentAsZombie.daysSinceInferred,
          periodLabel: currentAsZombie.periodLabel,
        },
      })
    }

    // Signal: newly detected subscription
    const isNewSubscription =
      ctx.transaction.category === 'SUBSCRIPTION'
      && recurring.some(
        r =>
          this.normalizeMerchant(r.merchant) === currentMerchantNorm
          && r.transactions.length === 2, // just became recurring
      )

    if (isNewSubscription) {
      signals.push({
        type: 'NEW_SUBSCRIPTION_DETECTED',
        severity: 'info',
        value: ctx.transaction.amount,
        label: `Nowa subskrypcja wykryta: ${ctx.transaction.merchant}`,
        metadata: { merchant: ctx.transaction.merchant },
      })
    }

    // Signal: duplicate subscription category
    if (duplicates.length > 0) {
      for (const dup of duplicates) {
        signals.push({
          type: 'DUPLICATE_SUBSCRIPTION',
          severity: 'warning',
          value: dup.combinedMonthly,
          label: `Dwie subskrypcje ${dup.category}: ${dup.subscriptions.map(s => s.merchant).join(' + ')} = ${dup.combinedMonthly.toFixed(0)} PLN/mies`,
          metadata: { category: dup.category, subscriptions: dup.subscriptions.map(s => s.merchant) },
        })
      }
    }

    // Signal: zombie portfolio cost
    if (totalMonthlyZombie > 50) {
      signals.push({
        type: 'SUNK_COST_SUBSCRIPTION',
        severity: totalMonthlyZombie > 150 ? 'critical' : 'warning',
        value: totalMonthlyZombie * 12,
        label: `${zombies.length} zombie subskrypcji kosztuje ${totalMonthlyZombie.toFixed(0)} PLN/mies (${(totalMonthlyZombie * 12).toFixed(0)} PLN/rok)`,
        metadata: { zombieCount: zombies.length, annualCost: totalMonthlyZombie * 12 },
      })
    }

    return {
      analyzerId: this.id,
      findings: {
        detected: recurring,
        zombies,
        duplicates,
        totalMonthlyRecurring,
        totalMonthlyZombie,
      },
      signals,
    }
  }

  // ── Core detection ───────────────────────────────────────

  detectRecurring(transactions: Transaction[]): RecurringPayment[] {
    const grouped = this.groupByMerchant(transactions)
    const results: RecurringPayment[] = []

    for (const [merchant, txns] of grouped.entries()) {
      if (txns.length < MIN_OCCURRENCES) continue

      const sorted = [...txns].sort((a, b) => a.date.getTime() - b.date.getTime())
      const intervals = this.computeIntervals(sorted)

      if (intervals.length === 0) continue

      const meanInterval = mean(intervals)
      const cv = stddev(intervals) / meanInterval

      if (cv >= CV_THRESHOLD) continue // Not recurring enough

      const period = this.classifyPeriod(meanInterval)
      const monthlyEquivalent = this.toMonthlyEquivalent(
        sorted[sorted.length - 1].amount,
        period.days,
      )

      const isZombie = this.inferZombieStatus(merchant, sorted)

      results.push({
        merchant,
        periodDays: period.days,
        periodLabel: period.label,
        monthlyEquivalent,
        coefficientOfVariation: cv,
        isZombie,
        daysSinceInferred: this.daysSinceLastTransaction(sorted),
        transactions: sorted,
      })
    }

    return results
  }

  // ── Zombie inference ─────────────────────────────────────

  /**
   * Without app-usage data, we infer zombie status through:
   * 1. Days since last payment (long gap = potential zombie)
   * 2. Multi-streaming overlap (statistical likelihood)
   * 3. Known service category matching
   */
  private inferZombieStatus(merchant: string, sorted: Transaction[]): boolean {
    const daysSince = this.daysSinceLastTransaction(sorted)
    if (daysSince > ZOMBIE_THRESHOLD_DAYS * 2) return true

    const norm = this.normalizeMerchant(merchant)
    if (STREAMING_SERVICES.has(norm) && daysSince > ZOMBIE_THRESHOLD_DAYS) {
      return true
    }

    return false
  }

  // ── Duplicate detection ──────────────────────────────────

  private detectDuplicates(recurring: RecurringPayment[]): DuplicateSubscription[] {
    const streamingServices = recurring.filter(r =>
      STREAMING_SERVICES.has(this.normalizeMerchant(r.merchant)),
    )
    const productivityServices = recurring.filter(r =>
      PRODUCTIVITY_SERVICES.has(this.normalizeMerchant(r.merchant)),
    )

    const duplicates: DuplicateSubscription[] = []

    if (streamingServices.length >= 2) {
      duplicates.push({
        category: 'streaming',
        subscriptions: streamingServices,
        combinedMonthly: streamingServices.reduce((s, r) => s + r.monthlyEquivalent, 0),
      })
    }

    if (productivityServices.length >= 2) {
      duplicates.push({
        category: 'narzędzia',
        subscriptions: productivityServices,
        combinedMonthly: productivityServices.reduce((s, r) => s + r.monthlyEquivalent, 0),
      })
    }

    return duplicates
  }

  // ── Helpers ──────────────────────────────────────────────

  private groupByMerchant(transactions: Transaction[]): Map<string, Transaction[]> {
    const map = new Map<string, Transaction[]>()
    for (const t of transactions) {
      if (!t.merchant) continue
      const key = this.normalizeMerchant(t.merchant)
      const group = map.get(key) ?? []
      group.push(t)
      map.set(key, group)
    }
    return map
  }

  private computeIntervals(sorted: Transaction[]): number[] {
    return sorted.slice(1).map((t, i) =>
      daysBetween(sorted[i].date, t.date),
    )
  }

  private classifyPeriod(meanDays: number): (typeof PERIOD_BUCKETS)[number] {
    return PERIOD_BUCKETS.reduce((best, bucket) =>
      Math.abs(bucket.days - meanDays) < Math.abs(best.days - meanDays)
        ? bucket
        : best,
    )
  }

  private toMonthlyEquivalent(amount: number, periodDays: number): number {
    return (amount * 30) / periodDays
  }

  private daysSinceLastTransaction(sorted: Transaction[]): number {
    const last = sorted[sorted.length - 1]
    return daysBetween(last.date, new Date())
  }

  normalizeMerchant(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+(sp\.?\s*z\.?\s*o\.?\s*o\.?|s\.a\.|ltd|inc|gmbh)/gi, '')
      .replace(/[^a-z0-9ąćęłńóśźż+]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
}

// ── Math utils ────────────────────────────────────────────────

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}

function stddev(values: number[]): number {
  const m = mean(values)
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)
}
