import Bull from 'bull'
import { processTransaction } from '../services/DrSpenderService'

export const analyzeTransactionQueue = new Bull('analyze-transaction', {
  redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
  defaultJobOptions: {
    attempts:    3,
    backoff:     { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail:     50,
  },
})

analyzeTransactionQueue.process('analyze', async (job) => {
  const { transactionId } = job.data as { transactionId: string }
  await processTransaction(transactionId)
})

analyzeTransactionQueue.on('failed', (job, err) => {
  console.error(`[analyzeTransactionQueue] Job ${job.id} failed:`, err.message)
})
