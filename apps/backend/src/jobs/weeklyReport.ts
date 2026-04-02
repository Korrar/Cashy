import Bull from 'bull'
import { prisma } from '../lib/prisma'
import { generateWeeklySummary } from '../services/DrSpenderService'

export const weeklyReportQueue = new Bull('weekly-report', {
  redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
  defaultJobOptions: {
    attempts: 2,
    backoff:  { type: 'fixed', delay: 5000 },
    removeOnComplete: 20,
  },
})

weeklyReportQueue.process('weekly', async (job) => {
  const { userId } = job.data as { userId: string }
  await generateWeeklySummary(userId)
})

weeklyReportQueue.on('failed', (job, err) => {
  console.error(`[weeklyReportQueue] Job ${job.id} failed:`, err.message)
})

/**
 * Schedule weekly reports for all users.
 * Called by cron every Monday at 08:00.
 */
export async function scheduleWeeklyReportsForAllUsers(): Promise<void> {
  const users = await prisma.user.findMany({
    select: { id: true },
    where: {
      settings: {
        notificationFrequency: { not: 'NONE' },
      },
    },
  })

  for (const user of users) {
    // Stagger jobs 2s apart to avoid Claude API burst
    await weeklyReportQueue.add(
      'weekly',
      { userId: user.id },
      { delay: users.indexOf(user) * 2000 },
    )
  }

  console.log(`[weeklyReportQueue] Scheduled ${users.length} weekly reports`)
}
