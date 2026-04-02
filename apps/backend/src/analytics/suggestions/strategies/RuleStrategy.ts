// ============================================================
// RuleStrategy
//
// Generates behavioral RULE suggestions for impulse patterns.
//
// Based on implementation intention research (Gollwitzer 1999):
// "If-then" planning dramatically increases follow-through vs
// vague intentions. "I will do X when Y happens" is 2-3x more
// effective than "I will try to spend less."
//
// Halpern et al. (UK Nudge Unit): Specific, concrete
// implementation intentions are the most effective nudge
// for discretionary spending reduction.
// ============================================================

import type { SuggestionStrategy, SuggestionEngineInput } from '../SuggestionEngine'
import type { SuggestionCandidate } from '../../types'

interface RuleDefinition {
  patternType: string
  signalTypes: string[]
  title: string
  rule: string            // The if-then implementation intention
  estimatedReductionPct: number   // Realistic reduction from this rule
  quip: string
}

const RULE_DEFINITIONS: RuleDefinition[] = [
  {
    patternType: 'LATE_NIGHT_DELIVERY',
    signalTypes: ['PRESENT_BIAS'],
    title: 'Zasada 24 godzin',
    rule: 'Jeśli chcesz coś kupić po 22:00 — dodaj do koszyka, zamknij aplikację, wróć rano. 80% nocnych impulsów nie przeżywa wschodu słońca.',
    estimatedReductionPct: 60,
    quip: 'O 23:47 wszystko wydaje się konieczne. O 8:00 rano portfel myśli inaczej. Zasada 24h to nie dieta — to matematyka.',
  },
  {
    patternType: 'MORNING_COFFEE',
    signalTypes: ['HEDONIC_ADAPTATION', 'LATTE_FACTOR'],
    title: 'Zasada 3 razy w tygodniu',
    rule: 'Ogranicz kawę na mieście do 3 razy w tygodniu. Wtorek, czwartek, sobota. Zaplanuj z wyprzedzeniem — nie impulsuj.',
    estimatedReductionPct: 40,
    quip: 'Nie proszę o abstynencję. Proszę o plan. Różnica między 5 a 3 kawami tygodniowo to 96 PLN miesięcznie. Kasjanusz liczy.',
  },
  {
    patternType: 'WEEKEND_SHOPPING',
    signalTypes: ['FREQUENCY_ESCALATION'],
    title: 'Lista zakupów przed wyjściem',
    rule: 'Zanim wyjdziesz w weekend — napisz listę tego czego potrzebujesz. Kupujesz tylko to co na liście.',
    estimatedReductionPct: 35,
    quip: 'Lista zakupów to nie ograniczenie wolności. To dokumentacja tego co faktycznie potrzebujesz, spisana zanim sklep zaczął Cię przekonywać.',
  },
  {
    patternType: 'POST_PAYDAY_SPLURGE',
    signalTypes: ['MENTAL_ACCOUNTING_BONUS', 'POST_PAYDAY_SPIKE'],
    title: 'Zasada 48 godzin po wypłacie',
    rule: 'Przez 48 godzin po wpłynięciu pensji — żadnych dużych zakupów. Poczekaj aż euforia minie.',
    estimatedReductionPct: 50,
    quip: 'Pensja wpłynęła i nagle wszystko wydaje się w zasięgu. To nie siła — to biologia. 48 godzin cierpliwości to najlepsza inwestycja miesiąca.',
  },
]

export class RuleStrategy implements SuggestionStrategy {
  type = 'RULE' as const

  evaluate(input: SuggestionEngineInput): SuggestionCandidate | null {
    const { signals, patterns, ctx } = input

    for (const def of RULE_DEFINITIONS) {
      const hasSignal = def.signalTypes.some(st =>
        signals.some(s => s.type === st),
      )
      const hasPattern = patterns.some(p => p.type === def.patternType)

      if (!hasSignal && !hasPattern) continue

      // Estimate savings from the relevant pattern
      const relevantPattern = patterns.find(p => p.type === def.patternType)
      const monthlyAtRisk = relevantPattern?.monthlyCost
        ?? signals
          .filter(s => def.signalTypes.includes(s.type))
          .reduce((sum, s) => sum + (s.metadata['cumulativeNightSpendThisMonth'] as number ?? 0), 0)

      if (monthlyAtRisk < 80) continue   // Too small to warrant a rule suggestion

      const monthlySavings = monthlyAtRisk * (def.estimatedReductionPct / 100)
      const annualSavings  = monthlySavings * 12

      const relatedIds = [
        ...(relevantPattern?.affectedTransactionIds ?? []),
        ctx.transaction.id,
      ]

      return {
        type: 'RULE',
        title: def.title,
        monthlySavings,
        annualSavings,
        howTo: def.rule,
        equivalentPurchase: formatEquivalent(annualSavings),
        drSpenderQuip: def.quip,
        confidence: hasPattern ? 0.75 : 0.55,
        sourceSignals: def.signalTypes as ReturnType<typeof def.signalTypes.map>,
        relatedTransactionIds: relatedIds,
      }
    }

    return null
  }
}

function formatEquivalent(annual: number): string {
  if (annual > 2000) return 'tygodniowy wyjazd za granicę'
  if (annual > 800)  return `${Math.floor(annual / 200)} weekendów poza miastem`
  return `${Math.floor(annual / 45)} wieczorów w restauracji`
}
