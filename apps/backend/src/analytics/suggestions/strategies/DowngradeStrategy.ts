// ============================================================
// DowngradeStrategy
//
// Generates DOWNGRADE suggestions — same category, cheaper option.
// Targets transport (Bolt/Uber vs public transit) and high-end
// recurring purchases where a cheaper tier exists.
// ============================================================

import type { SuggestionStrategy, SuggestionEngineInput } from '../SuggestionEngine'
import type { SuggestionCandidate, Category } from '../../types'

interface DowngradeDefinition {
  category: Category
  merchantKeywords: string[]
  currentLabel: string
  cheaperLabel: string
  cheaperMonthlyCost: number
  monthlyThreshold: number      // min spend to trigger
  maxTripDistance?: number       // km (for transport)
  howTo: string
  quipTemplate: string
}

const DOWNGRADE_DEFINITIONS: DowngradeDefinition[] = [
  {
    category: 'TRANSPORT',
    merchantKeywords: ['bolt', 'uber', 'free now', 'taxi'],
    currentLabel: 'Bolt/Uber',
    cheaperLabel: 'komunikacja miejska',
    cheaperMonthlyCost: 110,      // monthly pass Warsaw
    monthlyThreshold: 200,
    howTo: 'Miesięczny bilet ZTM Warszawa: 110 PLN (lub 55 PLN ulgowy). Bolt na trasy > 10 km — komunikacja na resztę.',
    quipTemplate: 'TRANSPORT',
  },
  {
    category: 'FOOD_GROCERY',
    merchantKeywords: ['whole foods', 'piotr i paweł', 'alma', 'delikatesy'],
    currentLabel: 'drogie delikatesy',
    cheaperLabel: 'Biedronka / Lidl',
    cheaperMonthlyCost: 0,        // computed dynamically as 60% of current
    monthlyThreshold: 400,
    howTo: 'Te same produkty w Biedronce lub Lidlu kosztują średnio 30–40% mniej. Lista zakupów + dyskont = ten sam efekt.',
    quipTemplate: 'GROCERY',
  },
  {
    category: 'COFFEE',
    merchantKeywords: ['starbucks', 'costa', 'coffee heaven', 'green caffe'],
    currentLabel: 'sieciowa kawiarnia',
    cheaperLabel: 'lokalna kawiarnia',
    cheaperMonthlyCost: 0,        // computed as 65% of current
    monthlyThreshold: 120,
    howTo: 'Lokalne kawiarnie są średnio 30% tańsze od Starbucksa i jakość często lepsza. Bonus: nie finansujesz korporacji.',
    quipTemplate: 'COFFEE',
  },
]

export class DowngradeStrategy implements SuggestionStrategy {
  type = 'DOWNGRADE' as const

  evaluate(input: SuggestionEngineInput): SuggestionCandidate | null {
    const { ctx } = input
    const { category, merchant } = ctx.transaction
    const merchantLower = (merchant ?? '').toLowerCase()

    const def = DOWNGRADE_DEFINITIONS.find(
      d =>
        d.category === category
        && d.merchantKeywords.some(kw => merchantLower.includes(kw)),
    )
    if (!def) return null

    const startOfMonth = new Date(ctx.transaction.date)
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const categoryTxns = ctx.history.last30Days.filter(
      t =>
        t.category === category
        && t.date >= startOfMonth
        && def.merchantKeywords.some(kw =>
          (t.merchant ?? '').toLowerCase().includes(kw),
        ),
    )

    const monthlySpend = categoryTxns.reduce((s, t) => s + t.amount, 0)
    if (monthlySpend < def.monthlyThreshold) return null

    // Dynamic cheaper cost
    const cheaperMonthly =
      def.cheaperMonthlyCost > 0
        ? def.cheaperMonthlyCost
        : monthlySpend * 0.65

    const monthlySavings = monthlySpend - cheaperMonthly
    if (monthlySavings < 60) return null

    const annualSavings = monthlySavings * 12

    return {
      type: 'DOWNGRADE',
      title: `${def.cheaperLabel} zamiast ${def.currentLabel}: ${monthlySavings.toFixed(0)} PLN/mies`,
      monthlySavings,
      annualSavings,
      howTo: def.howTo,
      equivalentPurchase: formatEquivalent(annualSavings),
      drSpenderQuip: buildQuip(def, monthlySpend, cheaperMonthly),
      confidence: 0.65,
      sourceSignals: ['AMOUNT_ANOMALY', 'FREQUENCY_ESCALATION'],
      relatedTransactionIds: categoryTxns.map(t => t.id),
    }
  }
}

function buildQuip(
  def: DowngradeDefinition,
  current: number,
  cheaper: number,
): string {
  if (def.quipTemplate === 'TRANSPORT') {
    return `${current.toFixed(0)} PLN miesięcznie na ${def.currentLabel}. Bilet miesięczny: ${cheaper.toFixed(0)} PLN. Różnica: ${(current - cheaper).toFixed(0)} PLN. Dr. Spender nie ocenia jak jeździsz — tylko ile za to płacisz.`
  }
  if (def.quipTemplate === 'COFFEE') {
    return `${def.currentLabel} pobiera od Ciebie premię za logo. Kawa jest kawą. Lokalna kawiarnia to ~${(current * 0.3).toFixed(0)} PLN miesięcznie mniej za ten sam kofeina.`
  }
  return `${current.toFixed(0)} PLN miesięcznie na ${def.currentLabel}. Alternatywa: ${cheaper.toFixed(0)} PLN. To ${(current / cheaper).toFixed(1)}x więcej niż trzeba.`
}

function formatEquivalent(annual: number): string {
  if (annual > 2400) return 'weekendowy wyjazd każdy miesiąc przez rok'
  if (annual > 1000) return `${Math.floor(annual / 500)} krótkich wakacji`
  return `${Math.floor(annual / 30)} dobrych kolacji`
}
