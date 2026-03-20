const windowMs = 60 * 60 * 1000; // 1 hour
const maxRequests = 5;

const hits = new Map<string, number[]>();

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of hits) {
    const valid = timestamps.filter((t) => now - t < windowMs);
    if (valid.length === 0) {
      hits.delete(ip);
    } else {
      hits.set(ip, valid);
    }
  }
}, 10 * 60 * 1000);

export function rateLimit(ip: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const timestamps = (hits.get(ip) || []).filter((t) => now - t < windowMs);

  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0];
    return { allowed: false, retryAfterMs: windowMs - (now - oldest) };
  }

  timestamps.push(now);
  hits.set(ip, timestamps);
  return { allowed: true };
}
