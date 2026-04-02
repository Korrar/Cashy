import { Router } from 'express'
import { z } from 'zod'
import { SuggestionStatus } from '@prisma/client'
import { requireAuth, type AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'

export const suggestionsRouter = Router()
suggestionsRouter.use(requireAuth)

// GET /suggestions
suggestionsRouter.get('/', async (req, res) => {
  const { userId } = req as AuthRequest

  const suggestions = await prisma.suggestion.findMany({
    where: { userId, status: 'ACTIVE' },
    orderBy: [{ confidence: 'desc' }, { annualSavings: 'desc' }],
    take: 10,
  })

  const totalPotentialSavings = suggestions.reduce((s, sg) => s + sg.monthlySavings, 0)

  return res.json({ suggestions, totalPotentialSavings })
})

// PATCH /suggestions/:id/accept
suggestionsRouter.patch('/:id/accept', async (req, res) => {
  const { userId } = req as AuthRequest

  const suggestion = await prisma.suggestion.findFirst({
    where: { id: req.params.id, userId },
  })
  if (!suggestion) return res.status(404).json({ error: 'Not found' })

  await prisma.suggestion.update({
    where: { id: req.params.id },
    data: { status: 'ACCEPTED', acceptedAt: new Date() },
  })

  return res.json({ ok: true })
})

// PATCH /suggestions/:id/dismiss
suggestionsRouter.patch('/:id/dismiss', async (req, res) => {
  const { userId } = req as AuthRequest

  await prisma.suggestion.updateMany({
    where: { id: req.params.id, userId },
    data: { status: 'DISMISSED' },
  })

  return res.json({ ok: true })
})
