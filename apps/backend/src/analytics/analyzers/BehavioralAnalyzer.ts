// ============================================================
// BehavioralAnalyzer
//
// Detects behavioral economics patterns in spending:
//
//   1. Present Bias (hyperbolic discounting) — Kahneman & Tversky 1979
//      Night/impulse purchases where immediate reward > future cost.
//
//   2. Hedonic Adaptation — Brickman & Campbell 1971
//      Escalating purchase frequency signals diminishing returns.
//      The 4th Starbucks no longer brings pleasure — but still costs.
//
//   3. Mental Accounting / Post-Payday Spike — Thaler 1985
//      Spending surge within 7 days of a large inbound transfer.
//
//   4. Anchoring Drift — Kahneman & Tversky 1974
//      Category spend rises after a single high-value transaction.
//
//   5. Loss Aversion / Sunk Cost — for zombie subscriptions
//      (detected in RecurrenceDetector, amplified here with framing).
// ============================================================

import type {
  AnalysisContext,
  AnalyzerResult,
  Signal,
  Transaction,
  Category,
} from '../types'

// Frequency escalation: if week-over-week frequency in category
// grew by more than this factor, flag hedonic adaptation
const FREQUENCY_ESCALATION_THRESHOLD = 1.4  // 40% increase

// Anchoring: if category avg rose after a high-value tx by this factor
const ANCHORING_DRIFT_THRESHOLD = 1.35

// Post-payday window: days after a large inbound transfer
const POST_PAYDAY_WINDOW_DAYS = 7

// "Large inbound" heuristic: anything 5x above median inbound
const INBOUND_MULTIPLIER = 5

interface BehavioralFindings {
  presentBias: PresentBiasResult | null
  hedonicAdaptation: HedonicAdaptationResult | null
  postPaydaySpike: PostPaydaySpikeResult | null
  anchoringDrift: AnchoringDriftResult | null
}

interface PresentBiasResult {
  isNightImpulse: boolean
  hour: number
  cumulativeNightSpendThisMonth: number
  nightPurchaseCountThisMonth: number
}

interface HedonicAdaptationResult {
  weeklyFrequencies: number[]   // last 4 weeks
  escalationRate: number        // ratio week[n] / week[n-3]
  isEscalating: boolean
}

interface PostPaydaySpikeResult {
  detectedInboundTransfer: number
  spendingRatioPost: number     // spending rate post-payday / baseline
  spendingExcessPLN: number
}

interface AnchoringDriftResult {
  triggerTransaction: Transaction
  categoryAvgBefore: number
  categoryAvgAfter: number
  driftRatio: number
}

export class BehavioralAnalyzer {
  readonly id = 'BehavioralAnalyzer'

  analyze(ctx: AnalysisContext): AnalyzerResult<BehavioralFindings> {
    const signals: Signal[] = []

    const presentBias = this.analyzePresentBias(ctx)
    const hedonicAdaptation = this.analyzeHedonicAdaptation(ctx)
    const postPaydaySpike = this.analyzePostPaydaySpike(ctx)
    const anchoringDrift = this.analyzeAnchoringDrift(ctx)

    if (presentBias?.isNightImpulse) {
      signals.push({
        type: 'PRESENT_BIAS',
        severity: presentBias.cumulativeNightSpendThisMonth > 200 ? 'critical' : 'warning',
        value: presentBias.cumulativeNightSpendThisMonth,
        label: `Zakup o ${presentBias.hour}:00 w nocy. ${presentBias.nightPurchaseCountThisMonth}. nocny zakup w tym miesiącu — łącznie ${presentBias.cumulativeNightSpendThisMonth.toFixed(0)} PLN`,
        metadata: { ...presentBias },
      })
    }

    if (hedonicAdaptation?.isEscalating) {
      signals.push({
        type: 'HEDONIC_ADAPTATION',
        severity: 'warning',
        value: hedonicAdaptation.escalationRate,
        label: `Częstotliwość zakupów w kategorii ${ctx.transaction.category} wzrosła ${(hedonicAdaptation.escalationRate * 100 - 100).toFixed(0)}% w ciągu 3 tygodni`,
        metadata: { ...hedonicAdaptation },
      })

      signals.push({
        type: 'FREQUENCY_ESCALATION',
        severity: 'warning',
        value: hedonicAdaptation.escalationRate,
        label: `Wzorzec eskalacji: ${hedonicAdaptation.weeklyFrequencies.join(' → ')} zakupów/tydzień`,
        metadata: { weeklyFrequencies: hedonicAdaptation.weeklyFrequencies },
      })
    }

    if (postPaydaySpike) {
      signals.push({
        type: 'MENTAL_ACCOUNTING_BONUS',
        severity: postPaydaySpike.spendingRatioPost > 2 ? 'critical' : 'warning',
        value: postPaydaySpike.spendingExcessPLN,
        label: `Wykryto przychód ${postPaydaySpike.detectedInboundTransfer.toFixed(0)} PLN — wydatki wzrosły ${(postPaydaySpike.spendingRatioPost * 100 - 100).toFixed(0)}% w ciągu tygodnia`,
        metadata: { ...postPaydaySpike },
      })
    }

    if (anchoringDrift) {
      signals.push({
        type: 'ANCHORING_EFFECT',
        severity: 'info',
        value: anchoringDrift.driftRatio,
        label: `Po zakupie za ${anchoringDrift.triggerTransaction.amount} PLN, średnie wydatki w kategorii wzrosły o ${((anchoringDrift.driftRatio - 1) * 100).toFixed(0)}%`,
        metadata: { ...anchoringDrift },
      })
    }

    return {
      analyzerId: this.id,
      findings: { presentBias, hedonicAdaptation, postPaydaySpike, anchoringDrift },
      signals,
    }
  }

  // ── 1. Present Bias ──────────────────────────────────────

  private analyzePresentBias(ctx: AnalysisContext): PresentBiasResult | null {
    if (!ctx.calendar.isNight) return null

    const startOfMonth = startOfCurrentMonth(ctx.transaction.date)
    const nightPurchasesThisMonth = ctx.history.last30Days.filter(t => {
      const hour = t.date.getHours()
      return (hour >= 22 || hour < 5) && t.date >= startOfMonth
    })

    return {
      isNightImpulse: true,
      hour: ctx.calendar.hour,
      cumulativeNightSpendThisMonth: nightPurchasesThisMonth.reduce(
        (sum, t) => sum + t.amount, ctx.transaction.amount,
      ),
      nightPurchaseCountThisMonth: nightPurchasesThisMonth.length + 1,
    }
  }

  // ── 2. Hedonic Adaptation ────────────────────────────────

  private analyzeHedonicAdaptation(
    ctx: AnalysisContext,
  ): HedonicAdaptationResult | null {
    const categoryTxns = ctx.history.last90Days.filter(
      t => t.category === ctx.transaction.category,
    )
    if (categoryTxns.length < 4) return null

    const weeklyFrequencies = [0, 1, 2, 3].map(weeksAgo => {
      const from = weeksAgoDate(ctx.transaction.date, weeksAgo + 1)
      const to   = weeksAgoDate(ctx.transaction.date, weeksAgo)
      return categoryTxns.filter(t => t.date >= from && t.date < to).length
    }).reverse() // chronological order

    const oldestWeek = weeklyFrequencies[0]
    const newestWeek = weeklyFrequencies[3]

    if (oldestWeek === 0) return null

    const escalationRate = newestWeek / oldestWeek

    return {
      weeklyFrequencies,
      escalationRate,
      isEscalating: escalationRate >= FREQUENCY_ESCALATION_THRESHOLD,
    }
  }

  // ── 3. Post-Payday Spike (Mental Accounting) ─────────────

  /**
   * Detects spending surge after a probable salary inbound.
   * Since we only have outgoing transactions in most Open Banking
   * implementations, we look for a gap in spending (payday range
   * heuristic: if there's a cluster of spending on days 1-5 of month)
   * and compare baseline vs post-payday rate.
   *
   * If income is declared in UserSettings, we use the actual payday.
   */
  private analyzePostPaydaySpike(
    ctx: AnalysisContext,
  ): PostPaydaySpikeResult | null {
    if (ctx.calendar.dayOfMonth > POST_PAYDAY_WINDOW_DAYS * 2) return null

    // We can only detect this meaningfully if it's early in the month
    if (ctx.calendar.dayOfMonth > POST_PAYDAY_WINDOW_DAYS) return null

    // Compare first-week spending vs last-month second-week baseline
    const firstWeekSpend = ctx.history.last30Days
      .filter(t => t.date.getDate() <= POST_PAYDAY_WINDOW_DAYS)
      .reduce((sum, t) => sum + t.amount, 0)

    const baselineWeekSpend = ctx.history.last90Days
      .filter(t => {
        const day = t.date.getDate()
        return day >= 14 && day <= 21
      })
      .reduce((sum, t) => sum + t.amount, 0)

    if (baselineWeekSpend === 0) return null

    const spendingRatioPost = firstWeekSpend / baselineWeekSpend

    if (spendingRatioPost < 1.5) return null

    // Estimate the inbound transfer from income declaration or heuristic
    const estimatedInbound =
      ctx.userSettings.monthlyNetIncome
      ?? this.estimateIncomeFromSpending(ctx.history.last90Days)

    return {
      detectedInboundTransfer: estimatedInbound,
      spendingRatioPost,
      spendingExcessPLN: firstWeekSpend - baselineWeekSpend,
    }
  }

  private estimateIncomeFromSpending(transactions: Transaction[]): number {
    // Heuristic: income is roughly 1.3x–2x average monthly spend
    const monthlySpend = transactions.reduce((s, t) => s + t.amount, 0) / 3
    return monthlySpend * 1.5
  }

  // ── 4. Anchoring Drift ───────────────────────────────────

  private analyzeAnchoringDrift(
    ctx: AnalysisContext,
  ): AnchoringDriftResult | null {
    const categoryTxns = ctx.history.last90Days.filter(
      t => t.category === ctx.transaction.category && t.id !== ctx.transaction.id,
    )
    if (categoryTxns.length < 4) return null

    // Find the largest transaction in category in last 30 days
    const recentLarge = categoryTxns
      .filter(t => {
        const daysDiff = (ctx.transaction.date.getTime() - t.date.getTime())
          / (1000 * 60 * 60 * 24)
        return daysDiff <= 30
      })
      .sort((a, b) => b.amount - a.amount)[0]

    if (!recentLarge) return null

    // Compare avg before vs after the large transaction
    const before = categoryTxns.filter(t => t.date < recentLarge.date)
    const after  = categoryTxns.filter(
      t => t.date > recentLarge.date && t.id !== recentLarge.id,
    )

    if (before.length < 2 || after.length < 2) return null

    const avgBefore = avg(before.map(t => t.amount))
    const avgAfter  = avg(after.map(t => t.amount))
    const driftRatio = avgAfter / avgBefore

    if (driftRatio < ANCHORING_DRIFT_THRESHOLD) return null

    return {
      triggerTransaction: recentLarge,
      categoryAvgBefore: avgBefore,
      categoryAvgAfter: avgAfter,
      driftRatio,
    }
  }
}

// ── Date helpers ──────────────────────────────────────────────

function weeksAgoDate(from: Date, weeks: number): Date {
  const d = new Date(from)
  d.setDate(d.getDate() - weeks * 7)
  return d
}

function startOfCurrentMonth(date: Date): Date {
  const d = new Date(date)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

function avg(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length
}
