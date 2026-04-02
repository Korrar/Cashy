// ============================================================
// AnalyticsPipeline
//
// Orchestrates the full analytics run for a single transaction.
// This is the single entry point for all analysis — callers
// never instantiate individual analyzers directly.
//
// Pipeline stages (in order):
//   1. AnomalyDetector       — statistical outlier detection
//   2. RecurrenceDetector    — subscription & recurring payments
//   3. PatternDetector       — temporal & behavioral patterns
//   4. BehavioralAnalyzer    — present bias, hedonic adaptation, etc.
//   5. FinancialFrameworkAnalyzer — 50/30/20, burn rate, latte factor
//   6. WasteScoreEngine      — aggregate 0–100 score from all signals
//   7. SpendingForecaster    — end-of-month projection
//   8. SuggestionEngine      — actionable recommendations
//   9. Context builder       — assembles DrSpenderContext for Claude API
//
// Design decisions:
//   - Analyzers are stateless and run independently (no shared state)
//   - All signals are collected before scoring (scoring reads signals, not raw data)
//   - Pipeline is synchronous internally; async I/O is the caller's responsibility
//   - Each stage failure is isolated — one broken analyzer doesn't abort the run
// ============================================================

import { AnomalyDetector }             from './analyzers/AnomalyDetector'
import { RecurrenceDetector }          from './analyzers/RecurrenceDetector'
import { PatternDetector }             from './analyzers/PatternDetector'
import { BehavioralAnalyzer }          from './analyzers/BehavioralAnalyzer'
import { FinancialFrameworkAnalyzer }  from './analyzers/FinancialFrameworkAnalyzer'
import { WasteScoreEngine }            from './scoring/WasteScoreEngine'
import { SpendingForecaster }          from './forecasting/SpendingForecaster'
import { SuggestionEngine }            from './suggestions/SuggestionEngine'

import type {
  AnalysisContext,
  PipelineResult,
  Signal,
  DetectedPattern,
  RecurringPayment,
  DrSpenderContext,
  DrSpenderMood,
  Category,
} from './types'

const TIME_OF_DAY_MAP = (hour: number): DrSpenderContext['transaction']['timeOfDay'] => {
  if (hour >= 6  && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 22) return 'evening'
  return 'night'
}

const DAY_NAMES = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota']

export class AnalyticsPipeline {
  private readonly anomalyDetector            = new AnomalyDetector()
  private readonly recurrenceDetector         = new RecurrenceDetector()
  private readonly patternDetector            = new PatternDetector()
  private readonly behavioralAnalyzer         = new BehavioralAnalyzer()
  private readonly financialFrameworkAnalyzer = new FinancialFrameworkAnalyzer()
  private readonly wasteScoreEngine           = new WasteScoreEngine()
  private readonly forecaster                 = new SpendingForecaster()
  private readonly suggestionEngine           = new SuggestionEngine()

  run(ctx: AnalysisContext): PipelineResult {
    const allSignals: Signal[]         = []
    const allPatterns: DetectedPattern[] = []
    let recurringPayments: RecurringPayment[] = []

    // ── Stage 1–5: Analyzers ────────────────────────────

    const anomalyResult = this.safeRun(
      'AnomalyDetector',
      () => this.anomalyDetector.analyze(ctx),
    )
    if (anomalyResult) allSignals.push(...anomalyResult.signals)

    const recurrenceResult = this.safeRun(
      'RecurrenceDetector',
      () => this.recurrenceDetector.analyze(ctx),
    )
    if (recurrenceResult) {
      allSignals.push(...recurrenceResult.signals)
      recurringPayments = recurrenceResult.findings.detected
    }

    const patternResult = this.safeRun(
      'PatternDetector',
      () => this.patternDetector.analyze(ctx),
    )
    if (patternResult) {
      allSignals.push(...patternResult.signals)
      allPatterns.push(...patternResult.findings.detected)
    }

    const behavioralResult = this.safeRun(
      'BehavioralAnalyzer',
      () => this.behavioralAnalyzer.analyze(ctx),
    )
    if (behavioralResult) allSignals.push(...behavioralResult.signals)

    const frameworkResult = this.safeRun(
      'FinancialFrameworkAnalyzer',
      () => this.financialFrameworkAnalyzer.analyze(ctx),
    )
    if (frameworkResult) allSignals.push(...frameworkResult.signals)

    // ── Stage 6: Waste Score ─────────────────────────────

    const startOfMonth = new Date(ctx.transaction.date)
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const categoryMonthlyTxns = ctx.history.last30Days.filter(
      t => t.category === ctx.transaction.category && t.date >= startOfMonth,
    )
    const categoryMonthlyTotal = categoryMonthlyTxns.reduce(
      (s, t) => s + t.amount, 0,
    )
    const categoryAmounts = ctx.history.last90Days
      .filter(t => t.category === ctx.transaction.category)
      .map(t => t.amount)
    const categoryMedian = median(categoryAmounts)

    const wasteScore = this.wasteScoreEngine.compute(
      ctx.transaction.category,
      ctx.transaction.amount,
      allSignals,
      categoryMonthlyTotal,
      categoryMedian,
    )

    // ── Stage 7: Forecast ─────────────────────────────────

    const forecast = this.safeRun(
      'SpendingForecaster',
      () => this.forecaster.forecast(ctx.history.allTime, ctx.transaction.date),
    )

    const burnRate = frameworkResult?.findings.burnRate ?? {
      dailyBurnRate: 0,
      projectedMonthEnd: 0,
      daysUntilBudgetExhausted: null,
      isCritical: false,
      budgetUsedPct: null,
    }

    // ── Stage 8: Suggestions ──────────────────────────────

    const suggestions = this.suggestionEngine.generate({
      ctx,
      signals: allSignals,
      recurringPayments,
      patterns: allPatterns,
    })

    // ── Stage 9: Financial Health Score ──────────────────

    const financialHealth = this.computeHealthScore(
      ctx,
      wasteScore.score,
      recurringPayments,
      frameworkResult?.findings.burnRate ?? null,
    )

    // ── Stage 10: Dr. Spender context ────────────────────

    const monthlyWasteTrend = this.computeMonthlyWasteTrend(ctx)
    const mood = this.wasteScoreEngine.determineMood(
      wasteScore.score,
      monthlyWasteTrend,
    )

    const drSpenderContext = this.buildDrSpenderContext(
      ctx,
      allSignals,
      allPatterns,
      wasteScore.score,
      mood,
      suggestions[0] ?? null,
    )

    return {
      transactionId: ctx.transaction.id,
      userId: ctx.userId,
      ranAt: new Date(),
      wasteScore,
      signals: allSignals,
      patterns: allPatterns,
      recurringPayments,
      burnRate: {
        dailyBurnRate:              burnRate.dailyBurnRate,
        projectedMonthEnd:          burnRate.projectedMonthEnd,
        daysUntilBudgetExhausted:   burnRate.daysUntilBudgetExhausted,
        confidence: forecast
          ? forecast.confidence
          : 'low',
        intervalLow:  forecast?.intervalLow  ?? burnRate.projectedMonthEnd * 0.85,
        intervalHigh: forecast?.intervalHigh ?? burnRate.projectedMonthEnd * 1.15,
      },
      suggestions,
      financialHealth,
      drSpenderContext,
    }
  }

  // ── Dr. Spender context builder ──────────────────────────

  private buildDrSpenderContext(
    ctx: AnalysisContext,
    signals: Signal[],
    patterns: DetectedPattern[],
    wasteScore: number,
    mood: DrSpenderMood,
    topSuggestion: PipelineResult['suggestions'][0] | null,
  ): DrSpenderContext {
    const { transaction, history } = ctx
    const hour = transaction.date.getHours()

    const startOfMonth = new Date(transaction.date)
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const prevMonthStart = new Date(startOfMonth)
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1)

    const categoryThisMonth = history.last30Days
      .filter(t => t.category === transaction.category && t.date >= startOfMonth)
      .reduce((s, t) => s + t.amount, 0)

    const categoryLastMonth = history.last90Days
      .filter(
        t =>
          t.category === transaction.category
          && t.date >= prevMonthStart
          && t.date < startOfMonth,
      )
      .reduce((s, t) => s + t.amount, 0)

    const transactionCountThisMonth = history.last30Days.filter(
      t => t.category === transaction.category && t.date >= startOfMonth,
    ).length

    const prevSameCategory = history.last90Days
      .filter(
        t =>
          t.category === transaction.category
          && t.id !== transaction.id
          && t.date < transaction.date,
      )
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0]

    const daysSinceLastInCategory = prevSameCategory
      ? Math.floor(
          (transaction.date.getTime() - prevSameCategory.date.getTime())
          / (1000 * 60 * 60 * 24),
        )
      : null

    // Top 3 signals by severity then value
    const severityOrder = { critical: 3, warning: 2, info: 1 }
    const topSignals = [...signals]
      .sort(
        (a, b) =>
          severityOrder[b.severity] - severityOrder[a.severity]
          || b.value - a.value,
      )
      .slice(0, 3)

    return {
      transaction: {
        amount:      transaction.amount,
        currency:    transaction.currency,
        category:    transaction.category,
        merchant:    transaction.merchant,
        timeOfDay:   TIME_OF_DAY_MAP(hour),
        dayOfWeek:   DAY_NAMES[transaction.date.getDay()],
        isNight:     hour >= 22 || hour < 5,
        isWeekend:   transaction.date.getDay() === 0 || transaction.date.getDay() === 6,
      },
      history: {
        categoryThisMonth,
        categoryLastMonth,
        transactionCountThisMonth,
        daysSinceLastInCategory,
      },
      topSignals,
      activePatterns: patterns.map(p => p.description),
      wasteScore,
      mood,
      suggestion: topSuggestion,
    }
  }

  // ── Financial Health Score ────────────────────────────────

  private computeHealthScore(
    ctx: AnalysisContext,
    wasteScore: number,
    recurring: RecurringPayment[],
    burnRate: { isCritical: boolean; budgetUsedPct: number | null } | null,
  ) {
    const wasteRatio = 100 - wasteScore

    const zombieCount = recurring.filter(r => r.isZombie).length
    const subscriptionHealth = Math.max(0, 100 - zombieCount * 20)

    const forecastSafety = burnRate?.isCritical ? 20 : 80

    const budgetAdherence =
      burnRate?.budgetUsedPct !== null && burnRate?.budgetUsedPct !== undefined
        ? Math.max(0, 100 - Math.max(0, burnRate.budgetUsedPct - 100))
        : 70 // neutral when no budget set

    const components = { wasteRatio, subscriptionHealth, forecastSafety, budgetAdherence, savingsRate: null as null | number }

    const overall = Math.round(
      (wasteRatio * 0.35
        + subscriptionHealth * 0.25
        + forecastSafety * 0.20
        + budgetAdherence * 0.20),
    )

    // Trend: compare this month vs last month waste
    const startOfMonth = new Date(ctx.transaction.date)
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)
    const prevMonthStart = new Date(startOfMonth)
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1)

    const thisMonthWasted = ctx.history.last30Days
      .filter(t => t.date >= startOfMonth && t.isWasted)
      .reduce((s, t) => s + t.amount, 0)
    const lastMonthWasted = ctx.history.last90Days
      .filter(t => t.date >= prevMonthStart && t.date < startOfMonth && t.isWasted)
      .reduce((s, t) => s + t.amount, 0)

    const trend: 'improving' | 'stable' | 'deteriorating' =
      lastMonthWasted === 0
        ? 'stable'
        : thisMonthWasted < lastMonthWasted * 0.9
        ? 'improving'
        : thisMonthWasted > lastMonthWasted * 1.1
        ? 'deteriorating'
        : 'stable'

    return { overall, components, trend }
  }

  private computeMonthlyWasteTrend(
    ctx: AnalysisContext,
  ): 'improving' | 'stable' | 'deteriorating' {
    const now = ctx.transaction.date
    const m1Start = new Date(now.getFullYear(), now.getMonth(), 1)
    const m2Start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const m3Start = new Date(now.getFullYear(), now.getMonth() - 2, 1)

    const thisMonthSpend = ctx.history.last30Days
      .filter(t => t.date >= m1Start)
      .reduce((s, t) => s + t.amount, 0)
    const lastMonthSpend = ctx.history.last90Days
      .filter(t => t.date >= m2Start && t.date < m1Start)
      .reduce((s, t) => s + t.amount, 0)

    if (lastMonthSpend === 0) return 'stable'
    const ratio = thisMonthSpend / lastMonthSpend
    if (ratio < 0.9)  return 'improving'
    if (ratio > 1.1)  return 'deteriorating'
    return 'stable'
  }

  // ── Error isolation ──────────────────────────────────────

  private safeRun<T>(name: string, fn: () => T): T | null {
    try {
      return fn()
    } catch (err) {
      console.error(`[AnalyticsPipeline] ${name} failed:`, err)
      return null
    }
  }
}

// ── Math utils ────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}
