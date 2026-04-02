import { Mood, CommentType } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { rateLimit } from '../lib/redis'
import { generateTransactionComment, generateWeeklyRoast, type WeeklyRoastData } from '../lib/claude'
import { AnalyticsPipeline, type AnalysisContext, type DrSpenderContext } from '../analytics'
import { getHistory } from './TransactionService'

const pipeline = new AnalyticsPipeline()

// One comment per user per 5 minutes max (Claude API rate limit protection)
const RATE_LIMIT_WINDOW = 300
const RATE_LIMIT_MAX    = 1

// ── Main entry: analyze transaction + generate comment ────────

export async function processTransaction(transactionId: string): Promise<void> {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { user: { include: { settings: true } } },
  })
  if (!transaction) return

  // Rate limit per user
  const rateLimitKey = `dr_spender:comment:${transaction.userId}`
  const allowed = await rateLimit(rateLimitKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)
  if (!allowed) return  // Silently skip — user will get the next one

  // Build analytics context
  const [h30, h90, hAll] = await Promise.all([
    getHistory(transaction.userId, 30),
    getHistory(transaction.userId, 90),
    getHistory(transaction.userId, 365 * 3),
  ])

  const settings = transaction.user.settings
  const now = transaction.date

  const ctx: AnalysisContext = {
    userId: transaction.userId,
    transaction: {
      id:          transaction.id,
      userId:      transaction.userId,
      amount:      transaction.amount,
      currency:    transaction.currency,
      category:    transaction.category as AnalysisContext['transaction']['category'],
      merchant:    transaction.merchant,
      description: transaction.description,
      date:        transaction.date,
      wasteScore:  transaction.wasteScore,
      isWasted:    transaction.isWasted,
    },
    history: {
      last30Days: mapTransactions(h30),
      last90Days: mapTransactions(h90),
      allTime:    mapTransactions(hAll),
    },
    calendar: {
      dayOfWeek:             now.getDay(),
      hour:                  now.getHours(),
      dayOfMonth:            now.getDate(),
      isWeekend:             now.getDay() === 0 || now.getDay() === 6,
      isNight:               now.getHours() >= 22 || now.getHours() < 5,
      daysElapsedInMonth:    now.getDate(),
      daysRemainingInMonth:  daysInMonth(now) - now.getDate(),
      monthlyBudget:         settings?.monthlyBudget ?? null,
    },
    userSettings: {
      monthlyNetIncome:  settings?.monthlyNetIncome ?? null,
      categoryBudgets:   (settings?.categoryBudgets as Record<string, number>) ?? {},
      drSpenderAggressiveness: mapAggressiveness(settings?.aggressiveness ?? 'NORMAL'),
    },
  }

  // Run analytics pipeline
  const result = pipeline.run(ctx)

  // Update transaction waste score
  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      wasteScore: result.wasteScore.score,
      isWasted:   result.wasteScore.score > 50,
    },
  })

  // Only generate comment if waste score warrants it
  if (result.wasteScore.score < 25 && result.signals.length === 0) return

  // Generate comment via Claude API
  const commentText = await generateTransactionComment(result.drSpenderContext)

  // Persist comment
  await prisma.drSpenderComment.create({
    data: {
      userId:        transaction.userId,
      transactionId: transaction.id,
      content:       commentText,
      type:          'TRANSACTION',
      mood:          mapMood(result.drSpenderContext.mood),
    },
  })

  // Persist top suggestion if any
  if (result.suggestions.length > 0) {
    await saveSuggestions(transaction.userId, result.suggestions, transactionId)
  }

  // Send push notification
  if (settings?.pushToken && shouldNotify(settings.notificationFrequency, result.wasteScore.score, now, settings)) {
    await sendPushNotification(settings.pushToken, commentText)
  }
}

// ── Weekly roast ─────────────────────────────────────────────

export async function generateWeeklySummary(userId: string): Promise<void> {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: weekAgo } },
    orderBy: { date: 'desc' },
  })

  if (transactions.length === 0) return

  const totalSpent  = transactions.reduce((s, t) => s + t.amount, 0)
  const totalWasted = transactions.filter(t => t.isWasted).reduce((s, t) => s + t.amount, 0)

  // Compare to previous week
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  const prevWeek = await prisma.transaction.aggregate({
    where: { userId, date: { gte: twoWeeksAgo, lt: weekAgo } },
    _sum: { amount: true },
  })
  const changeVsLastWeek = totalSpent - (prevWeek._sum.amount ?? 0)

  const topWaste = transactions
    .filter(t => t.isWasted)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)
    .map(t => ({ merchant: t.merchant, category: t.category, amount: t.amount }))

  const now = new Date()
  const weekLabel = `${weekAgo.toLocaleDateString('pl-PL')} – ${now.toLocaleDateString('pl-PL')}`

  const roastData: WeeklyRoastData = {
    weekLabel,
    totalSpent,
    totalWasted,
    changeVsLastWeek,
    topWaste,
    positiveNote: changeVsLastWeek < -50
      ? `Wydałeś ${Math.abs(changeVsLastWeek).toFixed(0)} PLN mniej niż w poprzednim tygodniu`
      : undefined,
  }

  const content = await generateWeeklyRoast(roastData)

  await prisma.drSpenderComment.create({
    data: {
      userId,
      content,
      type: 'WEEKLY_SUMMARY',
      mood: totalWasted / totalSpent > 0.3 ? 'DEVASTATED' : 'AMUSED',
    },
  })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { settings: true },
  })
  if (user?.settings?.pushToken) {
    await sendPushNotification(
      user.settings.pushToken,
      content,
      'Dr. Spender — Raport tygodniowy',
    )
  }
}

// ── Comment queries ───────────────────────────────────────────

export async function getComments(userId: string, limit = 20, offset = 0) {
  return prisma.drSpenderComment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
    include: { transaction: { select: { amount: true, category: true, merchant: true } } },
  })
}

export async function markCommentRead(id: string, userId: string) {
  return prisma.drSpenderComment.updateMany({
    where: { id, userId },
    data: { wasRead: true },
  })
}

// ── Push notification ─────────────────────────────────────────

async function sendPushNotification(
  token: string,
  body: string,
  title = 'Dr. Spender ma coś do powiedzenia',
): Promise<void> {
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to:    token,
        sound: 'default',
        title,
        body:  body.slice(0, 120) + (body.length > 120 ? '...' : ''),
      }),
    })
  } catch (err) {
    console.error('[DrSpenderService] Push notification failed:', err)
    // Non-fatal — don't throw
  }
}

// ── Suggestion persistence ────────────────────────────────────

async function saveSuggestions(
  userId: string,
  suggestions: AnalysisContext['userSettings'][],
  transactionId: string,
): Promise<void> {
  // Avoid duplicate active suggestions of same type
  const existingTypes = await prisma.suggestion.findMany({
    where: { userId, status: 'ACTIVE' },
    select: { type: true },
  })
  const existingTypeSet = new Set(existingTypes.map(s => s.type))

  for (const s of suggestions as unknown as Array<{
    type: string; title: string; monthlySavings: number; annualSavings: number
    howTo: string; drSpenderQuip: string; actionLabel?: string; actionUrl?: string
    equivalentPurchase?: string; confidence: number; relatedTransactionIds: string[]
  }>) {
    if (existingTypeSet.has(s.type as never)) continue

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    await prisma.suggestion.create({
      data: {
        userId,
        type:                  s.type as never,
        title:                 s.title,
        monthlySavings:        s.monthlySavings,
        annualSavings:         s.annualSavings,
        howTo:                 s.howTo,
        drSpenderQuip:         s.drSpenderQuip,
        actionLabel:           s.actionLabel,
        actionUrl:             s.actionUrl,
        equivalentPurchase:    s.equivalentPurchase,
        confidence:            s.confidence,
        relatedTransactionIds: s.relatedTransactionIds,
        expiresAt,
        transactions: { connect: [{ id: transactionId }] },
      },
    })
  }
}

// ── Helpers ───────────────────────────────────────────────────

function mapTransactions(txns: Awaited<ReturnType<typeof import('./TransactionService').getHistory>>) {
  return txns.map(t => ({
    id:          t.id,
    userId:      t.userId,
    amount:      t.amount,
    currency:    t.currency,
    category:    t.category as AnalysisContext['transaction']['category'],
    merchant:    t.merchant,
    description: t.description,
    date:        t.date,
    wasteScore:  t.wasteScore,
    isWasted:    t.isWasted,
  }))
}

function mapMood(mood: DrSpenderContext['mood']): Mood {
  const map: Record<DrSpenderContext['mood'], Mood> = {
    calm:               'CALM',
    interested:         'INTERESTED',
    amused:             'AMUSED',
    devastated:         'DEVASTATED',
    ironically_pleased: 'IRONICALLY_PLEASED',
  }
  return map[mood]
}

function mapAggressiveness(a: string): AnalysisContext['userSettings']['drSpenderAggressiveness'] {
  const map: Record<string, AnalysisContext['userSettings']['drSpenderAggressiveness']> = {
    GENTLE:   'gentle',
    NORMAL:   'normal',
    RUTHLESS: 'ruthless',
    NO_MERCY: 'no_mercy',
  }
  return map[a] ?? 'normal'
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function shouldNotify(
  frequency: string,
  wasteScore: number,
  date: Date,
  settings: { quietHoursStart?: number | null; quietHoursEnd?: number | null },
): boolean {
  // Quiet hours check
  const hour = date.getHours()
  if (settings.quietHoursStart != null && settings.quietHoursEnd != null) {
    if (hour >= settings.quietHoursStart || hour < settings.quietHoursEnd) return false
  }

  if (frequency === 'NONE') return false
  if (frequency === 'EVERY_TRANSACTION') return true
  if (frequency === 'IMPORTANT_ONLY') return wasteScore >= 50
  if (frequency === 'DAILY_SUMMARY') return false  // handled by cron
  return true
}
