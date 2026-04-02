import { Router } from 'express'
import { z } from 'zod'
import { Category } from '@prisma/client'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import * as TransactionService from '../services/TransactionService'

export const transactionsRouter = Router()
transactionsRouter.use(requireAuth)

const createSchema = z.object({
  amount:      z.number().positive(),
  currency:    z.string().length(3).default('PLN'),
  category:    z.nativeEnum(Category).optional(),
  merchant:    z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  date:        z.string().datetime().default(() => new Date().toISOString()),
})

const listSchema = z.object({
  limit:    z.coerce.number().int().min(1).max(100).default(50),
  offset:   z.coerce.number().int().min(0).default(0),
  from:     z.string().datetime().optional(),
  to:       z.string().datetime().optional(),
  category: z.nativeEnum(Category).optional(),
})

// POST /transactions
transactionsRouter.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { userId } = req as AuthRequest
  const data = parsed.data

  const transaction = await TransactionService.createTransaction({
    userId,
    amount:      data.amount,
    currency:    data.currency,
    category:    data.category,
    merchant:    data.merchant,
    description: data.description,
    date:        new Date(data.date),
    source:      'MANUAL',
  })

  return res.status(201).json({ transaction })
})

// GET /transactions
transactionsRouter.get('/', async (req, res) => {
  const parsed = listSchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { userId } = req as AuthRequest
  const { limit, offset, from, to, category } = parsed.data

  const transactions = await TransactionService.listTransactions(userId, {
    limit,
    offset,
    from:     from ? new Date(from) : undefined,
    to:       to   ? new Date(to)   : undefined,
    category,
  })

  return res.json({ transactions })
})

// GET /transactions/:id
transactionsRouter.get('/:id', async (req, res) => {
  const { userId } = req as AuthRequest
  const transaction = await TransactionService.getTransaction(req.params.id, userId)
  if (!transaction) return res.status(404).json({ error: 'Not found' })
  return res.json({ transaction })
})

// PATCH /transactions/:id/category
transactionsRouter.patch('/:id/category', async (req, res) => {
  const parsed = z.object({ category: z.nativeEnum(Category) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() })

  const { userId } = req as AuthRequest
  const transaction = await TransactionService.updateCategory(
    req.params.id,
    userId,
    parsed.data.category,
  )
  return res.json({ transaction })
})
