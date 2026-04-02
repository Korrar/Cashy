// ============================================================
// WasteScoreEngine
//
// Computes a 0–100 waste score for each transaction.
// Signal-driven: consumes the output of all analyzers
// rather than re-computing data independently.
//
// Design principle: scoring is a pure function of signals.
// Each signal type has a defined contribution range.
// Contributions are additive and capped at 100.
// ============================================================

import type {
  Signal,
  WasteScoreResult,
  WasteScoreBreakdown,
  Category,
} from '../types'

// Base score by category — how inherently "discretionary" is this?
// Scale: 0 (never waste) → 40 (almost always waste)
const CATEGORY_BASE_SCORE: Record<Category, number> = {
  COFFEE:           35,
  ALCOHOL:          30,
  ENTERTAINMENT:    25,
  FOOD_RESTAURANT:  20,
  SUBSCRIPTION:     20,
  ELECTRONICS:      20,
  CLOTHING:         15,
  TRAVEL:           10,
  OTHER:            10,
  TRANSPORT:         5,
  SPORT:             5,
  FOOD_GROCERY:      5,
  HEALTH:            0,   // Never waste
}

// Signal contribution rules: each signal type → points added
// Capped per-signal to avoid single-signal domination
const SIGNAL_CONTRIBUTIONS: Partial<Record<Signal['type'], { max: number; perUnit: number }>> = {
  AMOUNT_ANOMALY:          { max: 15, perUnit: 5 },   // per z-score unit above 2.5
  FREQUENCY_ESCALATION:    { max: 20, perUnit: 10 },  // per escalation event
  ZOMBIE_SUBSCRIPTION:     { max: 30, perUnit: 30 },  // flat if zombie
  PRESENT_BIAS:            { max: 10, perUnit: 5 },   // per night purchase this month
  HEDONIC_ADAPTATION:      { max: 10, perUnit: 10 },  // flat if escalating
  POST_PAYDAY_SPIKE:       { max: 8,  perUnit: 4 },
  ANCHORING_EFFECT:        { max: 5,  perUnit: 5 },
  DUPLICATE_SUBSCRIPTION:  { max: 15, perUnit: 15 },
  BURN_RATE_CRITICAL:      { max: 10, perUnit: 5 },
}

// Severity multipliers
const SEVERITY_MULTIPLIER: Record<Signal['severity'], number> = {
  info:     0.5,
  warning:  1.0,
  critical: 1.5,
}

export class WasteScoreEngine {
  compute(
    category: Category,
    amount: number,
    signals: Signal[],
    categoryMonthlyTotal: number,
    categoryMedian: number,
  ): WasteScoreResult {
    const breakdown: WasteScoreBreakdown = {
      categoryBase: 0,
      frequencyPenalty: 0,
      amountAnomalyPenalty: 0,
      nightPenalty: 0,
      zombieSubscriptionPenalty: 0,
      impulsePenalty: 0,
    }

    // 1. Category base (0–40)
    breakdown.categoryBase = CATEGORY_BASE_SCORE[category]

    // 2. Frequency penalty (0–20)
    // Derived from how many times this category appears this month
    // relative to a reasonable baseline (3x/month = neutral)
    const FREQUENCY_BASELINE = 3
    const frequencySignal = signals.find(s => s.type === 'FREQUENCY_ESCALATION')
    if (frequencySignal) {
      breakdown.frequencyPenalty = Math.min(
        20,
        (frequencySignal.value - 1) * 10,
      )
    }

    // 3. Amount anomaly penalty (0–15)
    const anomalySignal = signals.find(s => s.type === 'AMOUNT_ANOMALY')
    if (anomalySignal) {
      const zScore = Math.abs(anomalySignal.value)
      breakdown.amountAnomalyPenalty = Math.min(
        15,
        Math.max(0, (zScore - 2.5) * 5),
      )
    }

    // 4. Night penalty (0–10)
    const nightSignal = signals.find(s => s.type === 'PRESENT_BIAS')
    if (nightSignal) {
      breakdown.nightPenalty = Math.min(10, 5 + nightSignal.value * 0.01)
    }

    // 5. Zombie subscription penalty (0–30)
    const zombieSignal = signals.find(s => s.type === 'ZOMBIE_SUBSCRIPTION')
    if (zombieSignal) {
      breakdown.zombieSubscriptionPenalty = 30
    }

    // 6. Impulse / behavioral signals (0–5)
    const impulsiveSignals = signals.filter(s =>
      ['HEDONIC_ADAPTATION', 'POST_PAYDAY_SPIKE', 'ANCHORING_EFFECT'].includes(s.type),
    )
    if (impulsiveSignals.length > 0) {
      breakdown.impulsePenalty = Math.min(5, impulsiveSignals.length * 2)
    }

    const rawScore =
      breakdown.categoryBase
      + breakdown.frequencyPenalty
      + breakdown.amountAnomalyPenalty
      + breakdown.nightPenalty
      + breakdown.zombieSubscriptionPenalty
      + breakdown.impulsePenalty

    return {
      score: Math.min(100, Math.max(0, Math.round(rawScore))),
      breakdown,
    }
  }

  /** Determine Dr. Spender's mood from waste score + trajectory */
  determineMood(
    score: number,
    monthlyWasteTrend: 'improving' | 'stable' | 'deteriorating',
  ): 'calm' | 'interested' | 'amused' | 'devastated' | 'ironically_pleased' {
    if (score < 20 && monthlyWasteTrend === 'improving') return 'ironically_pleased'
    if (score < 25) return 'calm'
    if (score < 45) return 'interested'
    if (score < 70) return 'amused'
    return 'devastated'
  }
}
