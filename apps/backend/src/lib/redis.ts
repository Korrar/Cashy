import { createClient } from 'redis'

export const redis = createClient({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
})

redis.on('error', (err) => console.error('[Redis] Client error:', err))

export async function connectRedis(): Promise<void> {
  if (!redis.isOpen) {
    await redis.connect()
  }
}

// ── Cache helpers ────────────────────────────────────────────

const DEFAULT_TTL = 60 * 5  // 5 minutes

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key)
  return raw ? (JSON.parse(raw) as T) : null
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds = DEFAULT_TTL,
): Promise<void> {
  await redis.set(key, JSON.stringify(value), { EX: ttlSeconds })
}

export async function cacheDel(key: string): Promise<void> {
  await redis.del(key)
}

// ── Rate limiting ─────────────────────────────────────────────

/**
 * Returns false if rate limit hit, true if OK.
 * Uses sliding window counter.
 */
export async function rateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<boolean> {
  const current = await redis.incr(key)
  if (current === 1) {
    await redis.expire(key, windowSeconds)
  }
  return current <= maxRequests
}
