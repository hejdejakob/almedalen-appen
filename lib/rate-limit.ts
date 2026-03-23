type RateLimitResult = { allowed: boolean; retryAfterMs?: number };

function createLimiter(windowMs: number, maxRequests: number) {
  const hits = new Map<string, number[]>();

  // Clean up old entries every 10 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, valid);
      }
    }
  }, 10 * 60 * 1000);

  return function check(key: string): RateLimitResult {
    const now = Date.now();
    const timestamps = (hits.get(key) || []).filter((t) => now - t < windowMs);

    if (timestamps.length >= maxRequests) {
      const oldest = timestamps[0];
      return { allowed: false, retryAfterMs: windowMs - (now - oldest) };
    }

    timestamps.push(now);
    hits.set(key, timestamps);
    return { allowed: true };
  };
}

// 5 requests per hour — expensive AI generation
export const rateLimit = createLimiter(60 * 60 * 1000, 5);

// 120 requests per minute — read-only data endpoints
export const rateLimitApi = createLimiter(60 * 1000, 120);
