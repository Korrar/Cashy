// ============================================================
// CookStrategy
//
// Generates COOK suggestions — cooking at home instead of
// ordering delivery or eating at restaurants.
//
// Price ratio data based on Polish market research:
// A home-cooked meal costs ~4–6x less than restaurant/delivery.
// (Główny Urząd Statystyczny, dane o wydatkach gospodarstw domowych)
// ============================================================

import type { SuggestionStrategy, SuggestionEngineInput } from '../SuggestionEngine'
import type { SuggestionCandidate, Transaction } from '../../types'

interface MealEquivalent {
  deliveryName: string
  deliveryAvgCost: number
  homeCookCost: number
  portions: number
  recipe: string
}

const MEAL_EQUIVALENTS: MealEquivalent[] = [
  {
    deliveryName: 'pad thai / makaron azjatycki',
    deliveryAvgCost: 45,
    homeCookCost: 12,
    portions: 2,
    recipe: 'Makaron ryżowy + warzywa + sos — składniki na 2 porcje',
  },
  {
    deliveryName: 'pizza',
    deliveryAvgCost: 55,
    homeCookCost: 14,
    portions: 2,
    recipe: 'Ciasto (mąka, drożdże), sos pomidorowy, ser — 2 pizze',
  },
  {
    deliveryName: 'burger',
    deliveryAvgCost: 40,
    homeCookCost: 18,
    portions: 2,
    recipe: 'Mięso mielone, bułki, warzywa — 2 burgery',
  },
  {
    deliveryName: 'sushi',
    deliveryAvgCost: 80,
    homeCookCost: 30,
    portions: 2,
    recipe: 'Ryż do sushi, łosoś, nori — zestaw na 2 osoby',
  },
]

// Min monthly delivery spend to trigger suggestion
const MIN_MONTHLY_DELIVERY = 150
const MIN_FREQUENCY = 4  // transactions/month

export class CookStrategy implements SuggestionStrategy {
  type = 'COOK' as const

  evaluate(input: SuggestionEngineInput): SuggestionCandidate | null {
    const { ctx } = input

    if (ctx.transaction.category !== 'FOOD_RESTAURANT') return null

    const startOfMonth = new Date(ctx.transaction.date)
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const deliveryTxns = ctx.history.last30Days.filter(
      t =>
        t.category === 'FOOD_RESTAURANT'
        && t.date >= startOfMonth
        && this.isDelivery(t),
    )

    if (
      deliveryTxns.length < MIN_FREQUENCY
      && deliveryTxns.reduce((s, t) => s + t.amount, 0) < MIN_MONTHLY_DELIVERY
    ) return null

    const monthlyDelivery = deliveryTxns.reduce((s, t) => s + t.amount, 0)
    const avgOrderCost = monthlyDelivery / Math.max(deliveryTxns.length, 1)

    // Find the closest meal equivalent
    const meal = this.findClosestMeal(avgOrderCost)
    const homeMonthly = (meal.homeCookCost / meal.deliveryAvgCost) * monthlyDelivery
    const monthlySavings = monthlyDelivery - homeMonthly
    const annualSavings = monthlySavings * 12
    const priceRatio = Math.round(meal.deliveryAvgCost / meal.homeCookCost)

    if (monthlySavings < 80) return null

    return {
      type: 'COOK',
      title: `Gotowanie zamiast delivery: oszczędność ${monthlySavings.toFixed(0)} PLN/mies`,
      monthlySavings,
      annualSavings,
      howTo: `${meal.recipe}. Koszt: ~${meal.homeCookCost} PLN zamiast ~${meal.deliveryAvgCost} PLN za zamówienie. Meal prep w niedzielę = jedzenie na cały tydzień.`,
      equivalentPurchase: formatEquivalent(annualSavings),
      drSpenderQuip: buildQuip(monthlyDelivery, homeMonthly, deliveryTxns.length, priceRatio),
      confidence: Math.min(0.85, 0.5 + deliveryTxns.length * 0.07),
      sourceSignals: ['FREQUENCY_ESCALATION', 'LATTE_FACTOR'],
      relatedTransactionIds: deliveryTxns.map(t => t.id),
    }
  }

  private isDelivery(t: Transaction): boolean {
    const name = (t.merchant ?? '').toLowerCase()
    return (
      name.includes('pyszne')
      || name.includes('uber eat')
      || name.includes('bolt food')
      || name.includes('glovo')
      || name.includes('delivery')
      || name.includes('wolt')
      // Also flag restaurants with high night-time frequency
      || (t.date.getHours() >= 19 && t.amount > 35)
    )
  }

  private findClosestMeal(avgCost: number): MealEquivalent {
    return MEAL_EQUIVALENTS.reduce((best, meal) =>
      Math.abs(meal.deliveryAvgCost - avgCost) <
      Math.abs(best.deliveryAvgCost - avgCost)
        ? meal
        : best,
    )
  }
}

function buildQuip(
  monthly: number,
  homeAlternative: number,
  count: number,
  ratio: number,
): string {
  return `${count} razy w tym miesiącu zamówiłeś jedzenie zamiast je ugotować. Łącznie ${monthly.toFixed(0)} PLN. To samo jedzenie w domu kosztuje ${homeAlternative.toFixed(0)} PLN — ${ratio}x mniej. Dr. Spender nie gotuje, ale zna liczby.`
}

function formatEquivalent(annual: number): string {
  if (annual > 3000) return 'dwutygodniowe wakacje z wyżywieniem'
  if (annual > 1200) return 'nowy MacBook w 2–3 lata'
  if (annual > 600)  return `${Math.floor(annual / 120)} miesięcy siłowni`
  return `${Math.floor(annual / 50)} wieczorów w restauracji — tym razem z wyboru`
}
