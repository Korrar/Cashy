import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { rateLimit } from 'express-rate-limit'
import cron from 'node-cron'

import { connectRedis } from './lib/redis'
import { prisma } from './lib/prisma'
import { authRouter }         from './routes/auth'
import { transactionsRouter } from './routes/transactions'
import { statsRouter }        from './routes/stats'
import { suggestionsRouter }  from './routes/suggestions'
import { importRouter }       from './routes/import'
import { scheduleWeeklyReportsForAllUsers } from './jobs/weeklyReport'

const app  = express()
const PORT = Number(process.env.PORT ?? 3000)

// ── Security & parsing ────────────────────────────────────────

app.use(helmet())
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}))
app.use(express.json({ limit: '1mb' }))

// Global rate limit: 100 req / 15 min per IP
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100, standardHeaders: true }))

// ── Routes ────────────────────────────────────────────────────

app.use('/auth',         authRouter)
app.use('/transactions', transactionsRouter)
app.use('/stats',        statsRouter)
app.use('/suggestions',  suggestionsRouter)
app.use('/import',       importRouter)

app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date() }))

// ── Cron jobs ─────────────────────────────────────────────────

// Weekly roast — every Monday at 08:00
cron.schedule('0 8 * * 1', async () => {
  console.log('[Cron] Scheduling weekly reports...')
  await scheduleWeeklyReportsForAllUsers()
})

// Expire old suggestions — daily at 03:00
cron.schedule('0 3 * * *', async () => {
  const result = await prisma.suggestion.updateMany({
    where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
    data:  { status: 'EXPIRED' },
  })
  console.log(`[Cron] Expired ${result.count} suggestions`)
})

// ── Startup ───────────────────────────────────────────────────

async function start() {
  await connectRedis()
  app.listen(PORT, () => {
    console.log(`[Spendr API] Running on port ${PORT}`)
  })
}

start().catch((err) => {
  console.error('[Spendr API] Startup failed:', err)
  process.exit(1)
})
