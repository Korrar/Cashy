// ============================================================
// SwapStrategy
//
// Generates SWAP suggestions — cheaper alternatives to
// high-frequency discretionary spending.
//
// Key insight (Slutsky equation / cross-price elasticity):
// The user has already demonstrated they want the underlying
// product — the question is only the price they pay for it.
// Present the price ratio explicitly: "19x more expensive."
//
// Substitution data is based on average Polish market prices.
// ============================================================

import type { SuggestionStrategy, SuggestionEngineInput } from '../SuggestionEngine'
import type { SuggestionCandidate, Category } from '../../types'

interface SwapDefinition {
  trigger: {
    category: Category
    minMonthlySpend: number
    minFrequency: number     // transactions per month
  }
  alternative: {
    name: string
    monthlyCostEstimate: number
    setupCostPLN?: number    // one-time investment
    paybackMonths?: number   // how quickly it pays off
  }
  priceRatio: number         // how many times more expensive is current vs alternative
  howTo: string
}

const SWAP_DEFINITIONS: SwapDefinition[] = [
  {
    trigger:     { category: 'COFFEE', minMonthlySpend: 100, minFrequency: 4 },
    alternative: {
      name: 'ekspres kapsułkowy w domu/biurze',
      monthlyCostEstimate: 45,     // capsules
      setupCostPLN: 350,
      paybackMonths: 6,
    },
    priceRatio: 19,
    howTo: 'Ekspres kapsułkowy (Nespresso/Dolce Gusto) kosztuje 300–400 PLN. Kapsułka: ~1.50–2.50 PLN. Inwestycja zwraca się w ciągu 6 tygodni przy Twoim tempie.',
  },
  {
    trigger:     { category: 'FOOD_RESTAURANT', minMonthlySpend: 200, minFrequency: 5 },
    alternative: {
      name: 'meal prep raz w tygodniu',
      monthlyCostEstimate: 300,
      setupCostPLN: 0,
    },
    priceRatio: 4,
    howTo: 'Dwie godziny gotowania w niedzielę = jedzenie na 5 dni. Koszt składników na tydzień to zazwyczaj tyle co jeden obiad na mieście.',
  },
  {
    trigger:     { category: 'TRANSPORT', minMonthlySpend: 250, minFrequency: 8 },
    alternative: {
      name: 'komunikacja miejska / rower',
      monthlyCostEstimate: 80,
      setupCostPLN: 0,
    },
    priceRatio: 5,
    howTo: 'Miesięczny bilet: ok. 80–120 PLN. Trasy < 5 km: rower miejski to 10 PLN/miesiąc abonament.',
  },
  {
    trigger:     { category: 'CLOTHING', minMonthlySpend: 300, minFrequency: 3 },
    alternative: {
      name: 'capsule wardrobe — 33 rzeczy, 0 impulsów',
      monthlyCostEstimate: 60,
    },
    priceRatio: 5,
    howTo: 'Zdefiniuj 33 ubrania na sezon (projekt 333). Kupujesz tylko gdy coś się zużyje. Moda nie kontroluje portfela.',
  },
]

export class SwapStrategy implements SuggestionStrategy {
  type = 'SWAP' as const

  evaluate(input: SuggestionEngineInput): SuggestionCandidate | null {
    const { ctx } = input
    const category = ctx.transaction.category

    const def = SWAP_DEFINITIONS.find(d => d.trigger.category === category)
    if (!def) return null

    // Compute actual monthly spend for this category
    const startOfMonth = new Date(ctx.transaction.date)
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const monthlyTxns = ctx.history.last30Days.filter(
      t => t.category === category && t.date >= startOfMonth,
    )
    const monthlySpend = monthlyTxns.reduce((s, t) => s + t.amount, 0)
    const frequency = monthlyTxns.length

    if (
      monthlySpend < def.trigger.minMonthlySpend
      || frequency < def.trigger.minFrequency
    ) return null

    const monthlySavings = monthlySpend - def.alternative.monthlyCostEstimate
    if (monthlySavings < 50) return null  // Not worth suggesting

    const annualSavings = monthlySavings * 12

    return {
      type: 'SWAP',
      title: `${categoryLabel(category)} za ${def.alternative.monthlyCostEstimate} PLN/mies zamiast ${monthlySpend.toFixed(0)} PLN`,
      monthlySavings,
      annualSavings,
      howTo: def.howTo,
      equivalentPurchase: formatEquivalent(annualSavings),
      drSpenderQuip: buildQuip(category, monthlySpend, def.alternative, def.priceRatio),
      confidence: Math.min(0.9, 0.5 + (frequency / 10)),
      sourceSignals: ['FREQUENCY_ESCALATION', 'LATTE_FACTOR'],
      relatedTransactionIds: monthlyTxns.map(t => t.id),
    }
  }
}

function categoryLabel(category: Category): string {
  const labels: Partial<Record<Category, string>> = {
    COFFEE:           'Kawa',
    FOOD_RESTAURANT:  'Jedzenie poza domem',
    TRANSPORT:        'Transport',
    CLOTHING:         'Ubrania',
  }
  return labels[category] ?? category
}

function buildQuip(
  category: Category,
  monthlySpend: number,
  alt: SwapDefinition['alternative'],
  ratio: number,
): string {
  if (category === 'COFFEE') {
    return `${monthlySpend.toFixed(0)} PLN miesięcznie na kawę. Alternatywa kosztuje ${alt.monthlyCostEstimate} PLN. To ${ratio}-krotna różnica. Kasjanusz policzył to za Ciebie, bo liczby same w sobie nie przemówiły.`
  }
  return `Płacisz ${ratio}x więcej niż musisz za ${categoryLabel(category).toLowerCase()}. Oszczędność: ${(monthlySpend - alt.monthlyCostEstimate).toFixed(0)} PLN/mies.`
}

function formatEquivalent(annual: number): string {
  if (annual > 3000) return `lot do Japonii'`
  if (annual > 1500) return `2 tygodnie urlopu w Europie`
  if (annual > 600)  return `nowy iPhone po roku`
  return `${Math.floor(annual / 30)} książek`
}
