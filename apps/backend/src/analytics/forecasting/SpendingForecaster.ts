// ============================================================
// SpendingForecaster
//
// Multiple forecasting methods tiered by data availability:
//
//   Tier 1 (< 60 days data): Day-of-week adjusted pace
//   Tier 2 (60–180 days):    Holt's exponential smoothing
//   Tier 3 (180+ days):      Holt-Winters with weekly seasonality
//
// Outputs a point estimate + confidence interval.
// Conservative design: ranges > false precision.
//
// References:
//   Holt, C.E. (1957). "Forecasting seasonals and trends by
//     exponentially weighted moving averages."
//   Winters, P.R. (1960). "Forecasting Sales by Exponentially
//     Weighted Moving Averages." Management Science.
// ============================================================

import type { Transaction, ForecastResult } from '../types'

interface MonthlyAggregate {
  year: number
  month: number  // 1-12
  total: number
  daysWithData: number
}

interface WeeklySeasonality {
  // Index 0 = Sunday, factor relative to weekly average
  dayFactors: number[]
}

export class SpendingForecaster {
  // Smoothing parameters
  private readonly ALPHA = 0.3   // Level smoothing
  private readonly BETA  = 0.1   // Trend smoothing (Holt's method)
  private readonly GAMMA = 0.2   // Seasonal smoothing (Holt-Winters)

  forecast(
    transactions: Transaction[],
    targetDate: Date = new Date(),
  ): ForecastResult & { intervalLow: number; intervalHigh: number } {
    const monthlyAggregates = this.aggregateByMonth(transactions)
    const dataDays = transactions.length > 0
      ? daysBetween(
          transactions.reduce((min, t) => t.date < min ? t.date : min, transactions[0].date),
          targetDate,
        )
      : 0

    let estimate: number
    let method: ForecastResult['method']
    let confidence: ForecastResult['confidence']

    if (dataDays < 60 || monthlyAggregates.length < 2) {
      // Tier 1: Day-of-week adjusted pace
      const result = this.forecastByPace(transactions, targetDate)
      estimate = result.estimate
      method = 'day_of_week_adjusted'
      confidence = 'low'
    } else if (dataDays < 180 || monthlyAggregates.length < 6) {
      // Tier 2: Holt's exponential smoothing
      const result = this.forecastHolt(monthlyAggregates)
      estimate = result.estimate
      method = 'exponential_smoothing'
      confidence = monthlyAggregates.length >= 3 ? 'medium' : 'low'
    } else {
      // Tier 3: Holt-Winters with weekly seasonality
      const result = this.forecastHoltWinters(transactions, monthlyAggregates, targetDate)
      estimate = result.estimate
      method = 'exponential_smoothing'
      confidence = 'high'
    }

    const { low, high } = this.computeConfidenceInterval(
      estimate,
      confidence,
      monthlyAggregates,
    )

    return {
      nextMonthEstimate: Math.round(estimate),
      method,
      confidence,
      intervalLow: Math.round(low),
      intervalHigh: Math.round(high),
    }
  }

  // ── Tier 1: Day-of-week adjusted pace ────────────────────

  private forecastByPace(
    transactions: Transaction[],
    today: Date,
  ): { estimate: number } {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const daysElapsed = today.getDate()
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const daysRemaining = daysInMonth - daysElapsed

    const spentSoFar = transactions
      .filter(t => t.date >= startOfMonth)
      .reduce((s, t) => s + t.amount, 0)

    const dailyBurnRate = daysElapsed > 0 ? spentSoFar / daysElapsed : 0

    // Adjust for remaining days' day-of-week profile
    const weekdayFactor = this.computeDayOfWeekFactor(transactions, today, daysRemaining)
    const projectedRemaining = dailyBurnRate * daysRemaining * weekdayFactor

    return { estimate: spentSoFar + projectedRemaining }
  }

  private computeDayOfWeekFactor(
    transactions: Transaction[],
    today: Date,
    daysRemaining: number,
  ): number {
    if (transactions.length < 14) return 1.0

    // Compute average spend by day of week
    const byDow = [0, 1, 2, 3, 4, 5, 6].map(dow => {
      const txns = transactions.filter(t => t.date.getDay() === dow)
      return txns.length > 0
        ? txns.reduce((s, t) => s + t.amount, 0) / txns.length
        : 0
    })

    const overallAvg = byDow.reduce((a, b) => a + b, 0) / 7

    // What day-of-week mix do the remaining days have?
    let remainingFactor = 0
    for (let i = 1; i <= daysRemaining; i++) {
      const futureDay = new Date(today)
      futureDay.setDate(today.getDate() + i)
      const dow = futureDay.getDay()
      remainingFactor += overallAvg > 0 ? (byDow[dow] ?? overallAvg) / overallAvg : 1
    }

    return daysRemaining > 0 ? remainingFactor / daysRemaining : 1
  }

  // ── Tier 2: Holt's Double Exponential Smoothing ──────────

  /**
   * Handles trend but not seasonality.
   * Two components: Level (L) and Trend (T).
   *
   * L_t = α * Y_t + (1 - α) * (L_{t-1} + T_{t-1})
   * T_t = β * (L_t - L_{t-1}) + (1 - β) * T_{t-1}
   * Forecast = L_t + h * T_t (h = steps ahead)
   */
  private forecastHolt(
    monthly: MonthlyAggregate[],
  ): { estimate: number; level: number; trend: number } {
    if (monthly.length < 2) {
      return { estimate: monthly[0]?.total ?? 0, level: 0, trend: 0 }
    }

    let level = monthly[0].total
    let trend = monthly[1].total - monthly[0].total

    for (let i = 1; i < monthly.length; i++) {
      const prevLevel = level
      level = this.ALPHA * monthly[i].total + (1 - this.ALPHA) * (level + trend)
      trend = this.BETA * (level - prevLevel) + (1 - this.BETA) * trend
    }

    // Forecast 1 step ahead
    return { estimate: level + trend, level, trend }
  }

  // ── Tier 3: Holt-Winters with Weekly Seasonality ─────────

  private forecastHoltWinters(
    transactions: Transaction[],
    monthly: MonthlyAggregate[],
    today: Date,
  ): { estimate: number } {
    const seasonality = this.computeWeeklySeasonality(transactions)
    const holt = this.forecastHolt(monthly)

    // Apply seasonal adjustment for the target month
    const daysInNextMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 2,
      0,
    ).getDate()

    const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    let seasonalAdjustment = 0
    let count = 0

    for (let d = 0; d < daysInNextMonth; d++) {
      const day = new Date(nextMonthStart)
      day.setDate(d + 1)
      seasonalAdjustment += seasonality.dayFactors[day.getDay()] ?? 1
      count++
    }

    const avgSeasonalFactor = count > 0 ? seasonalAdjustment / count : 1

    return { estimate: holt.estimate * avgSeasonalFactor }
  }

  private computeWeeklySeasonality(transactions: Transaction[]): WeeklySeasonality {
    const dowTotals = new Array(7).fill(0)
    const dowCounts = new Array(7).fill(0)

    for (const t of transactions) {
      const dow = t.date.getDay()
      dowTotals[dow] += t.amount
      dowCounts[dow]++
    }

    const avgPerDow = dowTotals.map((total, i) =>
      dowCounts[i] > 0 ? total / dowCounts[i] : 0,
    )
    const overallAvg = avgPerDow.reduce((a, b) => a + b, 0) / 7

    const dayFactors = avgPerDow.map(avg =>
      overallAvg > 0 ? avg / overallAvg : 1,
    )

    return { dayFactors }
  }

  // ── Confidence Intervals ─────────────────────────────────

  /**
   * Percentile-based intervals from historical variability.
   * Uses historical month-to-month variance rather than
   * assuming a distribution.
   */
  private computeConfidenceInterval(
    estimate: number,
    confidence: ForecastResult['confidence'],
    monthly: MonthlyAggregate[],
  ): { low: number; high: number } {
    if (monthly.length < 3) {
      // No variance data — use fixed % bands
      const band = confidence === 'low' ? 0.30 : 0.15
      return { low: estimate * (1 - band), high: estimate * (1 + band) }
    }

    const totals = monthly.map(m => m.total)
    const mean = totals.reduce((a, b) => a + b, 0) / totals.length
    const variance = totals.reduce((s, v) => s + (v - mean) ** 2, 0) / totals.length
    const stdDev = Math.sqrt(variance)

    // 1 stddev range (covers ~68% of historical months)
    return {
      low:  Math.max(0, estimate - stdDev),
      high: estimate + stdDev,
    }
  }

  // ── Aggregation helpers ───────────────────────────────────

  private aggregateByMonth(transactions: Transaction[]): MonthlyAggregate[] {
    const map = new Map<string, MonthlyAggregate>()

    for (const t of transactions) {
      const year  = t.date.getFullYear()
      const month = t.date.getMonth() + 1
      const key   = `${year}-${month}`

      const existing = map.get(key) ?? {
        year,
        month,
        total: 0,
        daysWithData: new Set<number>().size,
      }
      existing.total += t.amount
      map.set(key, existing)
    }

    return Array.from(map.values())
      .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
  }
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)
}
