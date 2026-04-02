import { Category, TransactionSource } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { analyzeTransactionQueue } from '../jobs/analyzeTransaction'

// ── Categorization ────────────────────────────────────────────

// keyword → category mapping (order matters — first match wins)
const CATEGORY_RULES: Array<{ keywords: string[]; category: Category }> = [
  { keywords: ['starbucks', 'costa coffee', 'coffee heaven', 'green caffe', 'coffeeheaven', 'kawiarnia', 'cafe'], category: 'COFFEE' },
  { keywords: ['mcdonalds', 'mcdonald', 'kfc', 'burger king', 'subway', 'pizza hut', 'dominos', 'pyszne', 'uber eat', 'ubereats', 'bolt food', 'glovo', 'wolt', 'deliveroo'], category: 'FOOD_RESTAURANT' },
  { keywords: ['biedronka', 'lidl', 'aldi', 'kaufland', 'carrefour', 'tesco', 'żabka', 'zabka', 'piotr i paweł', 'spar', 'netto', 'auchan', 'lewiatan', 'eurospar'], category: 'FOOD_GROCERY' },
  { keywords: ['netflix', 'spotify', 'hbo', 'canal+', 'disney+', 'apple music', 'tidal', 'youtube premium', 'amazon prime', 'paramount', 'crunchyroll', 'adobe', 'microsoft 365', 'office 365', 'dropbox', 'icloud', 'google one', 'linkedin premium', 'audible', 'duolingo', 'xbox game pass', 'playstation plus', 'nintendo'], category: 'SUBSCRIPTION' },
  { keywords: ['bolt', 'uber', 'free now', 'taxi', 'pkp', 'intercity', 'jakdojade', 'mzk', 'ztm', 'mpk', 'koleje'], category: 'TRANSPORT' },
  { keywords: ['zalando', 'h&m', 'zara', 'reserved', 'house', 'cropp', 'sinsay', 'mohito', 'nike', 'adidas', 'reebok', 'vans'], category: 'CLOTHING' },
  { keywords: ['allegro', 'amazon', 'media expert', 'rtv euro agd', 'mediamarkt', 'saturn', 'x-kom', 'morele', 'apple store', 'samsung', 'empik'], category: 'ELECTRONICS' },
  { keywords: ['apteka', 'pharmacy', 'dr max', 'ziko', 'lekarz', 'centrum medyczne', 'medicover', 'lux med', 'luxmed', 'enel-med', 'szpital', 'klinika'], category: 'HEALTH' },
  { keywords: ['siłownia', 'silownia', 'gym', 'fitness', 'fittime', 'multisport', 'squash', 'basen', 'swimming', 'decathlon', 'intersport', 'sport'], category: 'SPORT' },
  { keywords: ['kino', 'cinema', 'cinema city', 'multikino', 'helios', 'teatr', 'concert', 'steam', 'gog.com', 'epic games', 'ticketmaster', 'going'], category: 'ENTERTAINMENT' },
  { keywords: ['alkohol', 'winiarnia', 'winnica', 'monopolowy', 'alkoholowy', 'piwo', 'browar', 'whisky', 'wódka'], category: 'ALCOHOL' },
  { keywords: ['hotel', 'airbnb', 'booking.com', 'ryanair', 'wizz', 'lot ', 'wizzair', 'flixbus', 'trivago', 'kayak'], category: 'TRAVEL' },
]

export function categorize(merchant: string | null, description: string | null): Category {
  const text = `${merchant ?? ''} ${description ?? ''}`.toLowerCase()
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(kw => text.includes(kw))) {
      return rule.category
    }
  }
  return 'OTHER'
}

// ── CRUD ──────────────────────────────────────────────────────

export interface CreateTransactionInput {
  userId: string
  amount: number
  currency?: string
  category?: Category
  merchant?: string
  description?: string
  date: Date
  source: TransactionSource
  externalId?: string
  rawData?: Record<string, unknown>
}

export async function createTransaction(input: CreateTransactionInput) {
  const category = input.category ?? categorize(input.merchant ?? null, input.description ?? null)

  const transaction = await prisma.transaction.create({
    data: {
      userId:      input.userId,
      amount:      input.amount,
      currency:    input.currency ?? 'PLN',
      category,
      merchant:    input.merchant,
      description: input.description,
      date:        input.date,
      source:      input.source,
      externalId:  input.externalId,
      rawData:     input.rawData,
    },
  })

  // Queue async analytics (non-blocking)
  await analyzeTransactionQueue.add('analyze', { transactionId: transaction.id })

  return transaction
}

export async function listTransactions(
  userId: string,
  options: { limit?: number; offset?: number; from?: Date; to?: Date; category?: Category } = {},
) {
  return prisma.transaction.findMany({
    where: {
      userId,
      date: {
        gte: options.from,
        lte: options.to,
      },
      category: options.category,
    },
    orderBy: { date: 'desc' },
    take:    options.limit  ?? 50,
    skip:    options.offset ?? 0,
    include: {
      comments: {
        where: { type: 'TRANSACTION' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })
}

export async function getTransaction(id: string, userId: string) {
  return prisma.transaction.findFirst({
    where: { id, userId },
    include: { comments: true, suggestions: true },
  })
}

export async function updateCategory(id: string, userId: string, category: Category) {
  return prisma.transaction.update({
    where: { id, userId },
    data: { category },
  })
}

// ── History helpers (used by analytics pipeline) ──────────────

export async function getHistory(userId: string, days: number) {
  const from = new Date()
  from.setDate(from.getDate() - days)
  return prisma.transaction.findMany({
    where: { userId, date: { gte: from } },
    orderBy: { date: 'asc' },
  })
}
