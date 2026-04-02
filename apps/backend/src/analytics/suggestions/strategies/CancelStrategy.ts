// ============================================================
// CancelStrategy
//
// Generates CANCEL suggestions for zombie subscriptions.
//
// Loss framing (Kahneman & Tversky): frame as future loss,
// not past sunk cost. "You will pay X more if you don't cancel"
// is more effective than "you already paid X for nothing."
// ============================================================

import type { SuggestionStrategy, SuggestionEngineInput } from '../SuggestionEngine'
import type { SuggestionCandidate } from '../../types'

// Known cancel URLs for popular services
const CANCEL_URLS: Record<string, string> = {
  netflix:           'https://www.netflix.com/cancelplan',
  spotify:           'https://www.spotify.com/account/subscription/',
  'hbo max':         'https://www.max.com/account/cancel',
  'canal+':          'https://www.canalplus.com/mon-compte',
  'disney+':         'https://www.disneyplus.com/account',
  'adobe':           'https://account.adobe.com/plans',
  'linkedin':        'https://www.linkedin.com/premium/cancel',
  'audible':         'https://www.audible.com/account/cancel',
  'duolingo':        'https://www.duolingo.com/settings/notifications',
  'xbox game pass':  'https://account.microsoft.com/services',
}

export class CancelStrategy implements SuggestionStrategy {
  type = 'CANCEL' as const

  evaluate(input: SuggestionEngineInput): SuggestionCandidate | null {
    const zombies = input.recurringPayments.filter(r => r.isZombie)
    if (zombies.length === 0) return null

    // Pick the most expensive zombie
    const worst = zombies.sort(
      (a, b) => b.monthlyEquivalent - a.monthlyEquivalent,
    )[0]

    const annualSavings = worst.monthlyEquivalent * 12
    const merchantNorm = worst.merchant.toLowerCase()
    const cancelUrl = Object.entries(CANCEL_URLS).find(([key]) =>
      merchantNorm.includes(key),
    )?.[1]

    const daysSince = worst.daysSinceInferred

    return {
      type: 'CANCEL',
      title: `Anuluj ${worst.merchant} — nieużywane od ${daysSince} dni`,
      monthlySavings: worst.monthlyEquivalent,
      annualSavings,
      howTo: cancelUrl
        ? `Przejdź do ustawień konta i anuluj plan. Dostęp masz do końca okresu rozliczeniowego.`
        : `Zaloguj się na konto ${worst.merchant}, przejdź do Ustawień → Subskrypcja → Anuluj.`,
      actionLabel: `Anuluj ${worst.merchant}`,
      actionUrl: cancelUrl,
      equivalentPurchase: formatEquivalent(annualSavings),
      drSpenderQuip: buildQuip(worst.merchant, daysSince, annualSavings, worst.periodLabel),
      confidence: Math.min(0.95, 0.6 + daysSince / 200),
      sourceSignals: ['ZOMBIE_SUBSCRIPTION', 'SUNK_COST_SUBSCRIPTION'],
      relatedTransactionIds: worst.transactions.map(t => t.id),
    }
  }
}

function buildQuip(
  merchant: string,
  days: number,
  annual: number,
  period: string,
): string {
  if (days > 90) {
    return `${merchant} czeka na Ciebie od ${days} dni. Przez następne 12 miesięcy zapłacisz ${annual.toFixed(0)} PLN — nie za to co już minęło, za to co jeszcze możesz odzyskać.`
  }
  return `${merchant} — ${days} dni bez użycia, ${annual.toFixed(0)} PLN rocznie. Anulowanie zajmie 2 minuty. Kasjanusz liczył szybciej.`
}

function formatEquivalent(amount: number): string {
  if (amount > 1000) return `${Math.floor(amount / 500)} weekendowych wyjazdów`
  if (amount > 400)  return 'ekspres do kawy który zwróci się w miesiąc'
  if (amount > 200)  return `${Math.floor(amount / 40)} obiadów dla dwóch osób`
  return `${Math.floor(amount / 30)} biletów do kina`
}
