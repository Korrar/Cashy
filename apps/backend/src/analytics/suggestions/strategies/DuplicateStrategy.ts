// ============================================================
// DuplicateStrategy
//
// Detects and flags overlapping subscriptions in the same
// category. Uses RecurrenceDetector output.
//
// Key insight: users rarely use two services in the same
// category simultaneously. Statistical reality — at least one
// is underutilised. Anchoring: show annual combined cost,
// not monthly (29.99 + 49.99 = trivial; 959.76/year = not trivial).
// ============================================================

import type { SuggestionStrategy, SuggestionEngineInput } from '../SuggestionEngine'
import type { SuggestionCandidate, RecurringPayment } from '../../types'

// Category overlap rules
const OVERLAP_CATEGORIES = [
  {
    label: 'streaming wideo',
    keywords: ['netflix', 'hbo', 'max', 'canal+', 'disney+', 'player', 'polsat', 'apple tv', 'amazon prime'],
  },
  {
    label: 'muzyka',
    keywords: ['spotify', 'apple music', 'tidal', 'youtube music', 'deezer'],
  },
  {
    label: 'cloud storage',
    keywords: ['icloud', 'google one', 'dropbox', 'onedrive'],
  },
  {
    label: 'pakiet biurowy',
    keywords: ['microsoft 365', 'office 365', 'google workspace', 'notion'],
  },
  {
    label: 'nauka języków',
    keywords: ['duolingo', 'babbel', 'rosetta stone', 'pimsleur'],
  },
]

export class DuplicateStrategy implements SuggestionStrategy {
  type = 'DUPLICATE' as const

  evaluate(input: SuggestionEngineInput): SuggestionCandidate | null {
    const { recurringPayments } = input

    for (const overlap of OVERLAP_CATEGORIES) {
      const matches = recurringPayments.filter(r =>
        overlap.keywords.some(kw =>
          r.merchant.toLowerCase().includes(kw),
        ),
      )

      if (matches.length < 2) continue

      // Sort: keep cheapest, suggest cancelling rest
      const sorted = [...matches].sort(
        (a, b) => a.monthlyEquivalent - b.monthlyEquivalent,
      )
      const keep = sorted[0]
      const cancel = sorted.slice(1)

      const monthlySavings = cancel.reduce(
        (s, r) => s + r.monthlyEquivalent,
        0,
      )
      const annualSavings = monthlySavings * 12

      return {
        type: 'DUPLICATE',
        title: `Dwie subskrypcje ${overlap.label}: ${matches.map(m => m.merchant).join(' + ')}`,
        monthlySavings,
        annualSavings,
        howTo: buildHowTo(keep, cancel),
        equivalentPurchase: formatEquivalent(annualSavings),
        drSpenderQuip: buildQuip(overlap.label, matches, monthlySavings),
        confidence: 0.80,
        sourceSignals: ['DUPLICATE_SUBSCRIPTION'],
        relatedTransactionIds: matches.flatMap(r => r.transactions.map(t => t.id)),
      }
    }

    return null
  }
}

function buildHowTo(
  keep: RecurringPayment,
  cancel: RecurringPayment[],
): string {
  const cancelNames = cancel.map(r => r.merchant).join(' i ')
  return `Zostaw ${keep.merchant} (${keep.monthlyEquivalent.toFixed(0)} PLN/mies). Anuluj ${cancelNames}. Treść z obu serwisów i tak się w 70% pokrywa.`
}

function buildQuip(
  category: string,
  subs: RecurringPayment[],
  savings: number,
): string {
  const combined = subs.reduce((s, r) => s + r.monthlyEquivalent, 0)
  const names = subs.map(r => r.merchant).join(' i ')
  return `${names}. Dwie subskrypcje ${category}. ${combined.toFixed(0)} PLN miesięcznie, ${(combined * 12).toFixed(0)} PLN rocznie. Dobę ma 24 godziny. Dr. Spender sprawdził — to nadal za mało żeby używać obu.`
}

function formatEquivalent(annual: number): string {
  if (annual > 800) return 'nowy smartfon po roku'
  if (annual > 400) return `${Math.floor(annual / 120)} miesięcy siłowni`
  return `${Math.floor(annual / 40)} obiadów dla dwóch`
}
