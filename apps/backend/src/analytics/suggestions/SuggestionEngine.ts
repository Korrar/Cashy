// ============================================================
// SuggestionEngine
//
// Generates actionable, personalized suggestions from signals.
//
// Architecture: Strategy pattern — each SuggestionType has its
// own Strategy class. The engine tries all strategies and ranks
// candidates by (confidence * annualSavings).
//
// Nudge principles applied (Thaler & Sunstein 2008):
//   1. Concrete number + concrete alternative
//   2. Loss framing ("you're losing X" not "you could gain X")
//   3. Implementation intention (specific action steps)
//   4. Single best suggestion per context (avoid choice overload)
// ============================================================

import type {
  AnalysisContext,
  Signal,
  SuggestionCandidate,
  SuggestionType,
  RecurringPayment,
  DetectedPattern,
} from '../types'

import { SwapStrategy }       from './strategies/SwapStrategy'
import { CancelStrategy }     from './strategies/CancelStrategy'
import { RuleStrategy }       from './strategies/RuleStrategy'
import { DowngradeStrategy }  from './strategies/DowngradeStrategy'
import { DuplicateStrategy }  from './strategies/DuplicateStrategy'
import { CookStrategy }       from './strategies/CookStrategy'

export interface SuggestionEngineInput {
  ctx: AnalysisContext
  signals: Signal[]
  recurringPayments: RecurringPayment[]
  patterns: DetectedPattern[]
}

export class SuggestionEngine {
  private strategies = [
    new CancelStrategy(),
    new SwapStrategy(),
    new CookStrategy(),
    new RuleStrategy(),
    new DowngradeStrategy(),
    new DuplicateStrategy(),
  ]

  generate(input: SuggestionEngineInput): SuggestionCandidate[] {
    const candidates: SuggestionCandidate[] = []

    for (const strategy of this.strategies) {
      const result = strategy.evaluate(input)
      if (result) candidates.push(result)
    }

    // Rank by expected impact: confidence × annualSavings
    // Loss framing: user is already losing this money every year
    return candidates
      .sort((a, b) =>
        b.confidence * b.annualSavings - a.confidence * a.annualSavings,
      )
      .slice(0, 3)  // Return at most 3 to avoid choice overload
  }
}

// ── Strategy interface ────────────────────────────────────────

export interface SuggestionStrategy {
  type: SuggestionType
  evaluate(input: SuggestionEngineInput): SuggestionCandidate | null
}
