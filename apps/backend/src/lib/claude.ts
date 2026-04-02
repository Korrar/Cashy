import Anthropic from '@anthropic-ai/sdk'
import type { DrSpenderContext } from '../analytics'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ── Models ───────────────────────────────────────────────────

const MODEL_COMMENT  = 'claude-sonnet-4-6'  // Per-transaction comments
const MODEL_WEEKLY   = 'claude-opus-4-6'    // Weekly roast — needs more drama

// ── System prompt (cacheable) ────────────────────────────────

const SYSTEM_PROMPT = `Jesteś Dr. Spenderem — duchem dziewiętnastowiecznego polskiego kupca który zbankrutował w 1887 roku przez własną rozrzutność. Obserwujesz finansowe błędy użytkownika i komentujesz je.

ZASADY BEZWZGLĘDNE:
1. Wszystkie liczby które podajesz muszą być dokładnie zgodne z danymi które otrzymujesz
2. Nigdy nie kłamiesz, nie przesadzasz z liczbami
3. Mówisz po polsku, potocznie, ale z godnością
4. Komentarze są konkretne — odnoszą się do danych, nie do ogólników
5. Czarny humor ale nigdy złośliwość osobista — atakujesz wydatki, nie człowieka
6. Maksimum 2-3 zdania na komentarz po transakcji
7. Okazjonalne archaizmy dla charakteru: "oto i", "cóż za", "z ciężkim sercem"
8. Nie używasz emoji
9. Mówisz o sobie w trzeciej osobie jako "Dr. Spender"
10. Czasem zakończ pytaniem retorycznym`

// ── Comment generation ───────────────────────────────────────

export async function generateTransactionComment(
  ctx: DrSpenderContext,
): Promise<string> {
  const userMessage = buildTransactionPrompt(ctx)

  const response = await client.messages.create({
    model: MODEL_COMMENT,
    max_tokens: 250,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
  })

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude')
  return block.text.trim()
}

export async function generateWeeklyRoast(data: WeeklyRoastData): Promise<string> {
  const response = await client.messages.create({
    model: MODEL_WEEKLY,
    max_tokens: 600,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildWeeklyPrompt(data) }],
  })

  const block = response.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude')
  return block.text.trim()
}

// ── Prompt builders ──────────────────────────────────────────

function buildTransactionPrompt(ctx: DrSpenderContext): string {
  const { transaction, history, topSignals, activePatterns, wasteScore, mood, suggestion } = ctx

  const lines: string[] = [
    `TRANSAKCJA:`,
    `- Kwota: ${transaction.amount} ${transaction.currency}`,
    `- Kategoria: ${transaction.category}`,
    transaction.merchant ? `- Sprzedawca: ${transaction.merchant}` : '',
    `- Pora: ${transaction.timeOfDay} (${transaction.dayOfWeek})`,
    transaction.isNight ? `- UWAGA: zakup w nocy` : '',
    ``,
    `HISTORIA KATEGORII:`,
    `- W tym miesiącu: ${history.categoryThisMonth.toFixed(0)} PLN`,
    `- W poprzednim miesiącu: ${history.categoryLastMonth.toFixed(0)} PLN`,
    `- Liczba transakcji w tym miesiącu: ${history.transactionCountThisMonth}`,
    history.daysSinceLastInCategory !== null
      ? `- Ostatnia transakcja w tej kategorii: ${history.daysSinceLastInCategory} dni temu`
      : '',
    ``,
    `WASTE SCORE: ${wasteScore}/100`,
    `NASTRÓJ DR. SPENDERA: ${mood}`,
    ``,
    topSignals.length > 0
      ? `WYKRYTE SYGNAŁY:\n${topSignals.map(s => `- ${s.label}`).join('\n')}`
      : '',
    activePatterns.length > 0
      ? `\nWZORCE:\n${activePatterns.map(p => `- ${p}`).join('\n')}`
      : '',
    suggestion
      ? `\nSUGESTIA DLA UŻYTKOWNIKA: ${suggestion.title} (${suggestion.monthlySavings.toFixed(0)} PLN/mies)`
      : '',
    ``,
    `Napisz komentarz (2-3 zdania). Bądź konkretny, używaj dokładnych liczb z danych powyżej.`,
    mood === 'ironically_pleased'
      ? `Ton: ironicznie zadowolony — pochwała z niedowierzaniem.`
      : mood === 'devastated'
      ? `Ton: zrozpaczony — sytuacja jest katastrofalna.`
      : mood === 'amused'
      ? `Ton: rozbawiony — to jest absurdalne ale fascynujące.`
      : `Ton: ${mood}.`,
  ]

  return lines.filter(Boolean).join('\n')
}

function buildWeeklyPrompt(data: WeeklyRoastData): string {
  return `TYGODNIOWE PODSUMOWANIE (${data.weekLabel}):

Łączne wydatki: ${data.totalSpent.toFixed(0)} PLN
Zmarnowane: ${data.totalWasted.toFixed(0)} PLN (${((data.totalWasted / data.totalSpent) * 100).toFixed(0)}%)
Zmiana vs poprzedni tydzień: ${data.changeVsLastWeek > 0 ? '+' : ''}${data.changeVsLastWeek.toFixed(0)} PLN

TOP 3 ZMARNOWANE:
${data.topWaste.map(t => `- ${t.merchant ?? t.category}: ${t.amount} PLN`).join('\n')}

${data.positiveNote ? `POZYTYW: ${data.positiveNote}` : ''}

Napisz dramatyczne, sarkastyczne podsumowanie tygodnia (4-6 zdań).
Wymień 2-3 konkretne transakcje z nazwy i kwoty.
Zakończ prognozą lub przestrogą na następny tydzień.
${data.positiveNote ? 'Wspomnij o pozytywnym aspekcie z niedowierzaniem.' : ''}`
}

// ── Types ─────────────────────────────────────────────────────

export interface WeeklyRoastData {
  weekLabel: string
  totalSpent: number
  totalWasted: number
  changeVsLastWeek: number
  topWaste: Array<{ merchant: string | null; category: string; amount: number }>
  positiveNote?: string
}
