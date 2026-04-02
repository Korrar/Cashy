import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { cacheGet, cacheSet } from '../lib/redis'
import { getComments, markCommentRead } from '../services/DrSpenderService'

export const statsRouter = Router()
statsRouter.use(requireAuth)

// GET /stats/monthly?month=yyyy-MM  (defaults to current month)
statsRouter.get('/monthly', async (req, res) => {
  const parsed = z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  }).safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { userId } = req as AuthRequest

  const now = new Date()
  const [yearStr, monthStr] = (parsed.data.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`).split('-')
  const year  = Number(yearStr)
  const month = Number(monthStr)

  const cacheKey = `stats:monthly:${userId}:${year}-${month}`
  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const from = new Date(year, month - 1, 1)
  const to   = new Date(year, month, 0, 23, 59, 59)

  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: from, lte: to } },
    orderBy: { date: 'asc' },
  })

  const totalSpent  = transactions.reduce((s, t) => s + t.amount, 0)
  const totalWasted = transactions.filter(t => t.isWasted).reduce((s, t) => s + t.amount, 0)

  // Waste score — average of analyzed transactions (null wasteScore = not yet analyzed)
  const analyzed = transactions.filter(t => t.wasteScore != null)
  const wasteScore = analyzed.length > 0
    ? Math.round(analyzed.reduce((s, t) => s + (t.wasteScore ?? 0), 0) / analyzed.length)
    : 0

  // Burn rate — daily spend based on days elapsed in month
  const today = new Date()
  const daysElapsed = year === today.getFullYear() && month === today.getMonth() + 1
    ? Math.max(1, today.getDate())
    : new Date(year, month, 0).getDate()   // full month if historical
  const burnRate = totalSpent / daysElapsed

  // Forecast — project burn rate to end of month (only for current month)
  const daysInMonth = new Date(year, month, 0).getDate()
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1
  const forecast = isCurrentMonth ? Math.round(burnRate * daysInMonth) : null

  // Latte factor — small recurring daily purchases annualized
  // Uses coffee + food_restaurant combined as "latte factor" proxy
  const smallRecurring = transactions
    .filter(t => ['COFFEE', 'FOOD_RESTAURANT'].includes(t.category))
    .reduce((s, t) => s + t.amount, 0)
  const latteFactor = smallRecurring > 0 ? Math.round(smallRecurring * 12) : null

  // FIRE impact — annual waste × 25 (4% rule: how much you'd need to fund this waste forever)
  const annualWaste  = totalWasted * 12
  const fireImpact   = totalWasted > 0 ? Math.round(annualWaste * 25) : null

  // byCategory as array for mobile
  const byCategoryMap = transactions.reduce((acc, t) => {
    const entry = acc[t.category] ?? { category: t.category, total: 0, count: 0, wasteScoreSum: 0, wasteScoreCount: 0 }
    entry.total += t.amount
    entry.count += 1
    if (t.wasteScore != null) {
      entry.wasteScoreSum   += t.wasteScore
      entry.wasteScoreCount += 1
    }
    acc[t.category] = entry
    return acc
  }, {} as Record<string, { category: string; total: number; count: number; wasteScoreSum: number; wasteScoreCount: number }>)

  const byCategory = Object.values(byCategoryMap)
    .map(({ wasteScoreSum, wasteScoreCount, ...rest }) => ({
      ...rest,
      wasteScore: wasteScoreCount > 0 ? Math.round(wasteScoreSum / wasteScoreCount) : 0,
    }))
    .sort((a, b) => b.total - a.total)

  // Waste equivalents (what you could have bought instead)
  const equivalents = buildEquivalents(totalWasted)

  const data = {
    month: `${year}-${String(month).padStart(2, '0')}`,
    totalSpent,
    totalWasted,
    wasteScore,
    transactionCount: transactions.length,
    byCategory,
    burnRate:    Math.round(burnRate * 100) / 100,
    forecast,
    latteFactor,
    fireImpact,
    equivalents,
    wastePercentage: totalSpent > 0 ? (totalWasted / totalSpent) * 100 : 0,
  }

  await cacheSet(cacheKey, data, 60 * 10)
  return res.json(data)
})

// GET /stats/subscriptions
statsRouter.get('/subscriptions', async (req, res) => {
  const { userId } = req as AuthRequest

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const subTxns = await prisma.transaction.findMany({
    where: { userId, category: 'SUBSCRIPTION', date: { gte: ninetyDaysAgo } },
    orderBy: { date: 'desc' },
  })

  const { RecurrenceDetector } = await import('../analytics')
  const detector = new RecurrenceDetector()
  const recurring = detector.detectRecurring(subTxns.map(t => ({
    id: t.id, userId: t.userId, amount: t.amount, currency: t.currency,
    category: 'SUBSCRIPTION' as const, merchant: t.merchant,
    description: t.description, date: t.date,
    wasteScore: t.wasteScore, isWasted: t.isWasted,
  })))

  // Return array of subscription DTOs directly — mobile expects Subscription[]
  const result = recurring.map(r => ({
    merchant:      r.merchant,
    category:      'SUBSCRIPTION',
    amount:        r.monthlyEquivalent,
    interval:      r.interval,
    isZombie:      r.isZombie,
    lastUsed:      r.lastUsed?.toISOString() ?? null,
  }))

  return res.json(result)
})

// GET /stats/comments
statsRouter.get('/comments', async (req, res) => {
  const parsed = z.object({
    limit:  z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  }).safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { userId } = req as AuthRequest
  const raw = await getComments(userId, parsed.data.limit, parsed.data.offset)

  // Map Prisma fields → mobile DTO
  const comments = raw.map(c => ({
    id:            c.id,
    text:          c.content,                          // content → text
    mood:          c.mood,
    wasteScore:    c.transaction?.wasteScore ?? 0,     // pull from linked transaction
    transactionId: c.transactionId,
    createdAt:     c.createdAt.toISOString(),
    isRead:        c.wasRead,                          // wasRead → isRead
  }))

  return res.json(comments)   // return array directly, not wrapped
})

// PATCH /stats/comments/:id/read
statsRouter.patch('/comments/:id/read', async (req, res) => {
  const { userId } = req as AuthRequest
  await markCommentRead(req.params.id, userId)
  return res.json({ ok: true })
})

// ── Helpers ───────────────────────────────────────────────────

function buildEquivalents(amount: number) {
  const items = [
    { name: 'kawa z ekspresu w domu',        price: 1.5  },
    { name: 'bilet do kina',                  price: 30   },
    { name: 'obiad dla dwóch',                price: 100  },
    { name: 'miesięczny karnet na siłownię',  price: 120  },
    { name: 'nowy ekspres Nespresso',         price: 350  },
    { name: 'weekend w hotelu',               price: 400  },
    { name: 'lot do Barcelony i z powrotem',  price: 500  },
  ]
  return items
    .filter(i => amount >= i.price)
    .map(i => ({ ...i, quantity: Math.floor(amount / i.price) }))
    .slice(0, 3)
}
