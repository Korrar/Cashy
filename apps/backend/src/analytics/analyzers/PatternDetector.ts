// ============================================================
// PatternDetector
//
// Detects temporal and behavioral spending patterns using
// a sliding-window frequency analysis approach.
//
// Why not ML clustering (k-means/DBSCAN)?
//   With < 90 days of data (MVP window), statistical methods
//   outperform ML. We use day-of-week frequency analysis
//   (inspired by STL decomposition) and rolling windows.
//   ML clustering is scheduled for Tier 3 (6+ months data).
//
// Patterns detected:
//   MORNING_COFFEE       — same category every workday morning
//   FRIDAY_TAKEOUT        — delivery/restaurant every Friday
//   WEEKEND_SHOPPING      — clothing/electronics spike on weekends
//   LATE_NIGHT_DELIVERY   — delivery orders after 22:00
//   POST_PAYDAY_SPLURGE   — spend surge on days 1–5 of month
//   FREQUENCY_ESCALATION  — category frequency accelerating (hedonic adaptation)
// ============================================================

import type {
  AnalysisContext,
  AnalyzerResult,
  DetectedPattern,
  PatternType,
  Signal,
  Transaction,
  Category,
} from '../types'

// Minimum confidence to emit a pattern
const MIN_CONFIDENCE = 0.60

// Minimum weeks of data needed for temporal patterns
const MIN_WEEKS = 3

interface PatternFindings {
  detected: DetectedPattern[]
}

export class PatternDetector {
  readonly id = 'PatternDetector'

  analyze(ctx: AnalysisContext): AnalyzerResult<PatternFindings> {
    const signals: Signal[] = []
    const txns = ctx.history.last90Days
    const detected: DetectedPattern[] = []

    const weeks = daysBetween(
      txns.length > 0
        ? txns.reduce((min, t) => (t.date < min ? t.date : min), txns[0].date)
        : ctx.transaction.date,
      ctx.transaction.date,
    ) / 7

    if (weeks < MIN_WEEKS) {
      return { analyzerId: this.id, findings: { detected: [] }, signals: [] }
    }

    this.detectMorningCoffee(txns, weeks, detected)
    this.detectFridayTakeout(txns, weeks, detected)
    this.detectWeekendShopping(txns, weeks, detected)
    this.detectLateNightDelivery(txns, weeks, detected)
    this.detectPostPaydaySplurge(txns, detected)
    this.detectFrequencyEscalation(txns, ctx.transaction.category, detected)

    for (const pattern of detected) {
      signals.push({
        type: 'RECURRING_DAY_PATTERN',
        severity: pattern.confidence >= 0.85 ? 'warning' : 'info',
        value: pattern.monthlyCost,
        label: pattern.description,
        metadata: { patternType: pattern.type, confidence: pattern.confidence },
      })
    }

    return { analyzerId: this.id, findings: { detected }, signals }
  }

  // ── Pattern detectors ────────────────────────────────────

  /**
   * MORNING_COFFEE: COFFEE category, hour 6–10, weekdays, ≥ 4 of last 5 weeks
   */
  private detectMorningCoffee(
    txns: Transaction[],
    weeks: number,
    out: DetectedPattern[],
  ): void {
    const matches = txns.filter(
      t =>
        t.category === 'COFFEE'
        && t.date.getHours() >= 6
        && t.date.getHours() < 10
        && t.date.getDay() >= 1   // Mon
        && t.date.getDay() <= 5,  // Fri
    )

    if (matches.length < 4) return

    const weeksWithMatch = this.countWeeksWithMatch(matches, weeks)
    const confidence = weeksWithMatch / Math.min(weeks, 5)
    if (confidence < MIN_CONFIDENCE) return

    out.push({
      type: 'MORNING_COFFEE',
      description: `Kawa każdego ranka w tygodniu (~${avgAmount(matches).toFixed(0)} PLN/dzień)`,
      affectedTransactionIds: matches.map(t => t.id),
      monthlyCost: (matches.reduce((s, t) => s + t.amount, 0) / weeks) * 4.33,
      confidence,
      firstDetected: matches[0].date,
      metadata: { avgAmount: avgAmount(matches), weeklyFrequency: matches.length / weeks },
    })
  }

  /**
   * FRIDAY_TAKEOUT: FOOD_RESTAURANT on Fridays, ≥ 3 of last 4 Fridays
   */
  private detectFridayTakeout(
    txns: Transaction[],
    weeks: number,
    out: DetectedPattern[],
  ): void {
    const fridays = txns.filter(
      t =>
        t.date.getDay() === 5  // Friday
        && (t.category === 'FOOD_RESTAURANT' || this.isDeliveryMerchant(t.merchant)),
    )

    if (fridays.length < 3) return

    const recentFridays = Math.min(weeks, 5)
    const confidence = fridays.length / recentFridays
    if (confidence < MIN_CONFIDENCE) return

    out.push({
      type: 'FRIDAY_TAKEOUT',
      description: `Jedzenie na wynos/restauracja w każdy piątek (~${avgAmount(fridays).toFixed(0)} PLN)`,
      affectedTransactionIds: fridays.map(t => t.id),
      monthlyCost: avgAmount(fridays) * 4.33,
      confidence: Math.min(confidence, 0.95),
      firstDetected: fridays[0].date,
      metadata: { avgAmount: avgAmount(fridays) },
    })
  }

  /**
   * WEEKEND_SHOPPING: CLOTHING or ELECTRONICS on Sat/Sun, ≥ 3 weekends
   */
  private detectWeekendShopping(
    txns: Transaction[],
    weeks: number,
    out: DetectedPattern[],
  ): void {
    const weekendShops = txns.filter(
      t =>
        (t.date.getDay() === 0 || t.date.getDay() === 6)
        && (['CLOTHING', 'ELECTRONICS', 'ENTERTAINMENT'] as Category[]).includes(
          t.category,
        ),
    )

    if (weekendShops.length < 3) return

    const weekendsWithMatch = this.countWeeksWithMatch(weekendShops, weeks)
    const confidence = weekendsWithMatch / Math.min(weeks, 6)
    if (confidence < MIN_CONFIDENCE) return

    const monthlyCost =
      (weekendShops.reduce((s, t) => s + t.amount, 0) / weeks) * 4.33

    out.push({
      type: 'WEEKEND_SHOPPING',
      description: `Zakupy impulsowe w weekendy — ${weekendShops.length} transakcji`,
      affectedTransactionIds: weekendShops.map(t => t.id),
      monthlyCost,
      confidence,
      firstDetected: weekendShops[0].date,
      metadata: { weekendsAffected: weekendsWithMatch, totalAmount: weekendShops.reduce((s, t) => s + t.amount, 0) },
    })
  }

  /**
   * LATE_NIGHT_DELIVERY: any order after 22:00, ≥ 3 times in last 30 days
   */
  private detectLateNightDelivery(
    txns: Transaction[],
    weeks: number,
    out: DetectedPattern[],
  ): void {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)

    const nightOrders = txns.filter(
      t =>
        (t.date.getHours() >= 22 || t.date.getHours() < 4)
        && t.date >= cutoff
        && (t.category === 'FOOD_RESTAURANT' || t.category === 'ENTERTAINMENT'
          || t.category === 'ELECTRONICS' || t.category === 'CLOTHING'),
    )

    if (nightOrders.length < 3) return

    const monthlyCost = nightOrders.reduce((s, t) => s + t.amount, 0)
    const confidence = Math.min(0.90, 0.5 + nightOrders.length * 0.1)

    out.push({
      type: 'LATE_NIGHT_DELIVERY',
      description: `Zakupy nocne (po 22:00) — ${nightOrders.length} razy w miesiącu, łącznie ${monthlyCost.toFixed(0)} PLN`,
      affectedTransactionIds: nightOrders.map(t => t.id),
      monthlyCost,
      confidence,
      firstDetected: nightOrders[0].date,
      metadata: { count: nightOrders.length, avgHour: avg(nightOrders.map(t => t.date.getHours())) },
    })
  }

  /**
   * POST_PAYDAY_SPLURGE: elevated spend on days 1–6 of month vs rest of month
   */
  private detectPostPaydaySplurge(
    txns: Transaction[],
    out: DetectedPattern[],
  ): void {
    const earlyMonth = txns.filter(t => t.date.getDate() <= 6)
    const restOfMonth = txns.filter(t => t.date.getDate() > 6)

    if (earlyMonth.length < 3 || restOfMonth.length < 3) return

    const earlyDailyAvg = avg(earlyMonth.map(t => t.amount)) * earlyMonth.length / 6
    const restDailyAvg  = avg(restOfMonth.map(t => t.amount)) * restOfMonth.length / 22

    const ratio = restDailyAvg > 0 ? earlyDailyAvg / restDailyAvg : 1
    if (ratio < 1.5) return

    const monthlyCost = earlyMonth.reduce((s, t) => s + t.amount, 0)
    const confidence  = Math.min(0.80, 0.5 + (ratio - 1.5) * 0.3)

    out.push({
      type: 'POST_PAYDAY_SPLURGE',
      description: `Wydatki na początku miesiąca ${(ratio * 100 - 100).toFixed(0)}% wyższe niż reszta miesiąca`,
      affectedTransactionIds: earlyMonth.map(t => t.id),
      monthlyCost,
      confidence,
      firstDetected: earlyMonth[0].date,
      metadata: { ratio, earlyDailyAvg, restDailyAvg },
    })
  }

  /**
   * FREQUENCY_ESCALATION: category visit rate grew ≥40% over last 3 weeks
   */
  private detectFrequencyEscalation(
    txns: Transaction[],
    category: Category,
    out: DetectedPattern[],
  ): void {
    const categoryTxns = txns.filter(t => t.category === category)
    if (categoryTxns.length < 4) return

    const now = new Date()
    const weeks = [3, 2, 1, 0].map(w => {
      const from = new Date(now)
      from.setDate(from.getDate() - (w + 1) * 7)
      const to = new Date(now)
      to.setDate(to.getDate() - w * 7)
      return categoryTxns.filter(t => t.date >= from && t.date < to).length
    })

    if (weeks[0] === 0) return
    const escalationRate = weeks[3] / weeks[0]

    if (escalationRate < 1.4) return

    const monthlyCost =
      (categoryTxns.reduce((s, t) => s + t.amount, 0) / 3)
    const confidence = Math.min(0.85, 0.5 + (escalationRate - 1.4) * 0.5)

    out.push({
      type: 'FREQUENCY_ESCALATION',
      description: `Rosnące zakupy w kategorii ${category}: ${weeks.join(' → ')} transakcji/tydzień`,
      affectedTransactionIds: categoryTxns.slice(-8).map(t => t.id),
      monthlyCost,
      confidence,
      firstDetected: categoryTxns[0].date,
      metadata: { weeklyFrequencies: weeks, escalationRate },
    })
  }

  // ── Helpers ──────────────────────────────────────────────

  private countWeeksWithMatch(txns: Transaction[], totalWeeks: number): number {
    const weekNumbers = new Set(txns.map(t => getWeekNumber(t.date)))
    return Math.min(weekNumbers.size, Math.floor(totalWeeks))
  }

  private isDeliveryMerchant(merchant: string | null): boolean {
    const m = (merchant ?? '').toLowerCase()
    return ['pyszne', 'uber eat', 'glovo', 'wolt', 'bolt food', 'delivery'].some(
      kw => m.includes(kw),
    )
  }
}

// ── Helpers ───────────────────────────────────────────────────

function avgAmount(txns: Transaction[]): number {
  return txns.length === 0
    ? 0
    : txns.reduce((s, t) => s + t.amount, 0) / txns.length
}

function avg(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((a, b) => a + b, 0) / values.length
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)
}

function getWeekNumber(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return (
    1
    + Math.round(
      ((d.getTime() - week1.getTime()) / 86400000
        - 3
        + ((week1.getDay() + 6) % 7))
        / 7,
    )
  )
}
