// ============================================================
// AnomalyDetector
//
// Detects statistically unusual transactions using:
//   1. Modified Z-Score (Iglewicz & Hoaglin) — robust to outliers,
//      uses median instead of mean. Recommended for small samples.
//   2. IQR fence — secondary confirmation.
//   3. First-time merchant / category flags.
//
// Reference: Iglewicz, B. & Hoaglin, D. (1993).
// "How to Detect and Handle Outliers". ASQC Quality Press.
// ============================================================

import type {
  AnalysisContext,
  AnalyzerResult,
  Signal,
  Category,
  Transaction,
} from '../types'

// Threshold from Iglewicz & Hoaglin: |Z*| > 3.5 = outlier.
// We use a softer scale for spending context (not fraud detection).
const MODIFIED_Z_THRESHOLDS = {
  notable: 1.5,     // log only
  unusual: 2.5,     // Kasjanusz comment trigger
  exceptional: 4.0, // priority notification
} as const

interface AnomalyFindings {
  modifiedZScore: number | null
  iqrFence: number | null
  isAmountAnomaly: boolean
  isFirstTimeMerchant: boolean
  isFirstTimeCategoryThisMonth: boolean
  categoryStats: CategoryStats | null
}

interface CategoryStats {
  median: number
  mad: number        // Median Absolute Deviation
  q1: number
  q3: number
  iqr: number
  sampleSize: number
}

export class AnomalyDetector {
  readonly id = 'AnomalyDetector'

  analyze(ctx: AnalysisContext): AnalyzerResult<AnomalyFindings> {
    const signals: Signal[] = []
    const { transaction, history } = ctx

    const categoryHistory = history.last90Days.filter(
      t => t.category === transaction.category && t.id !== transaction.id,
    )

    const categoryStats = categoryHistory.length >= 3
      ? this.computeCategoryStats(categoryHistory.map(t => t.amount))
      : null

    const modifiedZScore = categoryStats
      ? this.modifiedZScore(transaction.amount, categoryStats)
      : null

    const iqrFence = categoryStats?.q3 + 1.5 * (categoryStats?.iqr ?? 0) ?? null

    const isAmountAnomaly = modifiedZScore !== null
      && Math.abs(modifiedZScore) >= MODIFIED_Z_THRESHOLDS.unusual

    if (isAmountAnomaly && modifiedZScore !== null) {
      const severity = Math.abs(modifiedZScore) >= MODIFIED_Z_THRESHOLDS.exceptional
        ? 'critical'
        : 'warning'

      signals.push({
        type: 'AMOUNT_ANOMALY',
        severity,
        value: modifiedZScore,
        label: `Kwota ${transaction.amount} PLN to ${modifiedZScore.toFixed(1)}σ powyżej Twojej normy w kategorii ${transaction.category}`,
        metadata: {
          amount: transaction.amount,
          modifiedZScore,
          categoryMedian: categoryStats?.median,
          sampleSize: categoryStats?.sampleSize,
        },
      })
    }

    const isFirstTimeMerchant = transaction.merchant !== null
      && !history.allTime.some(
        t => t.merchant === transaction.merchant && t.id !== transaction.id,
      )

    if (isFirstTimeMerchant) {
      signals.push({
        type: 'FIRST_TIME_MERCHANT',
        severity: 'info',
        value: transaction.amount,
        label: `Pierwszy raz u ${transaction.merchant}`,
        metadata: { merchant: transaction.merchant },
      })
    }

    const startOfMonth = new Date(transaction.date)
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const isFirstTimeCategoryThisMonth = !history.last30Days.some(
      t =>
        t.category === transaction.category
        && t.date >= startOfMonth
        && t.id !== transaction.id,
    )

    if (isFirstTimeCategoryThisMonth) {
      signals.push({
        type: 'FIRST_TIME_CATEGORY_THIS_MONTH',
        severity: 'info',
        value: transaction.amount,
        label: `Pierwsza transakcja w kategorii ${transaction.category} w tym miesiącu`,
        metadata: { category: transaction.category },
      })
    }

    return {
      analyzerId: this.id,
      findings: {
        modifiedZScore,
        iqrFence,
        isAmountAnomaly,
        isFirstTimeMerchant,
        isFirstTimeCategoryThisMonth,
        categoryStats,
      },
      signals,
    }
  }

  // ── Statistical methods ──────────────────────────────────

  private computeCategoryStats(amounts: number[]): CategoryStats {
    const sorted = [...amounts].sort((a, b) => a - b)
    const median = this.median(sorted)
    const deviations = amounts.map(x => Math.abs(x - median))
    const mad = this.median([...deviations].sort((a, b) => a - b))

    const q1 = this.percentile(sorted, 25)
    const q3 = this.percentile(sorted, 75)

    return { median, mad, q1, q3, iqr: q3 - q1, sampleSize: amounts.length }
  }

  /**
   * Modified Z-Score (Iglewicz & Hoaglin 1993)
   * Z* = 0.6745 * (Xi - median) / MAD
   * More robust than standard z-score for financial data with outliers.
   */
  private modifiedZScore(value: number, stats: CategoryStats): number {
    if (stats.mad === 0) {
      // Fallback: all values identical, use simple ratio
      return stats.median > 0 ? (value - stats.median) / stats.median : 0
    }
    return (0.6745 * (value - stats.median)) / stats.mad
  }

  private median(sorted: number[]): number {
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2
  }

  private percentile(sorted: number[], p: number): number {
    const index = (p / 100) * (sorted.length - 1)
    const lower = Math.floor(index)
    const fraction = index - lower
    return sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower] ?? 0)
  }
}
