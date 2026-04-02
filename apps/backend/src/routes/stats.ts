import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { cacheGet, cacheSet } from '../lib/redis'
import { getComments, markCommentRead } from '../services/DrSpenderService'

export const statsRouter = Router()
statsRouter.use(requireAuth)

// GET /stats/monthly?year=2026&month=3
statsRouter.get('/monthly', async (req, res) => {
  const parsed = z.object({
    year:  z.coerce.number().int().min(2020).max(2030),
    month: z.coerce.number().int().min(1).max(12),
  }).safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { userId } = req as AuthRequest
  const { year, month } = parsed.data
  const cacheKey = `stats:monthly:${userId}:${year}-${month}`

  const cached = await cacheGet(cacheKey)
  if (cached) return res.json(cached)

  const from = new Date(year, month - 1, 1)
  const to   = new Date(year, month, 0, 23, 59, 59)

  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: from, lte: to } },
  })

  const totalSpent  = transactions.reduce((s, t) => s + t.amount, 0)
  const totalWasted = transactions.filter(t => t.isWasted).reduce((s, t) => s + t.amount, 0)

  // Group by category
  const byCategory = transactions.reduce((acc, t) => {
    const cat = acc[t.category] ?? { total: 0, count: 0, wasted: 0 }
    cat.total  += t.amount
    cat.count  += 1
    cat.wasted += t.isWasted ? t.amount : 0
    acc[t.category] = cat
    return acc
  }, {} as Record<string, { total: number; count: number; wasted: number }>)

  // Compare to previous month
  const prevFrom = new Date(year, month - 2, 1)
  const prevTo   = new Date(year, month - 1, 0, 23, 59, 59)
  const prevAgg  = await prisma.transaction.aggregate({
    where: { userId, date: { gte: prevFrom, lte: prevTo } },
    _sum: { amount: true },
  })
  const prevTotal = prevAgg._sum.amount ?? 0

  // Waste equivalents
  const equivalents = buildEquivalents(totalWasted)

  const data = {
    year, month,
    totalSpent,
    totalWasted,
    wastePercentage: totalSpent > 0 ? (totalWasted / totalSpent) * 100 : 0,
    vsLastMonth: { prevTotal, diff: totalSpent - prevTotal, diffPct: prevTotal > 0 ? ((totalSpent - prevTotal) / prevTotal) * 100 : 0 },
    byCategory,
    equivalents,
    transactionCount: transactions.length,
  }

  await cacheSet(cacheKey, data, 60 * 10)  // 10 min cache
  return res.json(data)
})

// GET /stats/subscriptions
statsRouter.get('/subscriptions', async (req, res) => {
  const { userId } = req as AuthRequest

  // Last 90 days of SUBSCRIPTION transactions
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const subTxns = await prisma.transaction.findMany({
    where: { userId, category: 'SUBSCRIPTION', date: { gte: ninetyDaysAgo } },
    orderBy: { date: 'desc' },
  })

  // Import RecurrenceDetector to analyse
  const { RecurrenceDetector } = await import('../analytics')
  const detector = new RecurrenceDetector()
  const recurring = detector.detectRecurring(subTxns.map(t => ({
    id: t.id, userId: t.userId, amount: t.amount, currency: t.currency,
    category: 'SUBSCRIPTION' as const, merchant: t.merchant,
    description: t.description, date: t.date,
    wasteScore: t.wasteScore, isWasted: t.isWasted,
  })))

  const zombies = recurring.filter(r => r.isZombie)

  return res.json({
    all: recurring,
    zombies,
    totalMonthly:      recurring.reduce((s, r) => s + r.monthlyEquivalent, 0),
    totalMonthlyZombie: zombies.reduce((s, r) => s + r.monthlyEquivalent, 0),
  })
})

// GET /dr-spender/comments
statsRouter.get('/comments', async (req, res) => {
  const parsed = z.object({
    limit:  z.coerce.number().int().min(1).max(50).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  }).safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { userId } = req as AuthRequest
  const comments = await getComments(userId, parsed.data.limit, parsed.data.offset)
  return res.json({ comments })
})

// PATCH /dr-spender/comments/:id/read
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
    { name: 'lot do Barcelony i z powrotem',  price: 500  },
    { name: 'nowy ekspres Nespresso',         price: 350  },
    { name: 'weekend w hotelu',               price: 400  },
  ]
  return items
    .filter(i => amount >= i.price)
    .map(i => ({ ...i, quantity: Math.floor(amount / i.price) }))
    .slice(0, 3)
}
