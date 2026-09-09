/** Oddiy xotiradagi tezlik chegarasi — IP yoki foydalanuvchi bo'yicha. */

const buckets = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) {
    if (now >= b.reset) buckets.delete(key);
  }
}, 60 * 1000).unref();

/**
 * Limit oshsa qolgan soniyani, aks holda 0 qaytaradi.
 */
export function tooMany(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now >= b.reset) {
    b = { n: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.n += 1;
  if (b.n > max) return Math.max(1, Math.ceil((b.reset - now) / 1000));
  return 0;
}

export function rateLimit({ max, windowMs, keyFn }) {
  return (req, res, next) => {
    const key = keyFn(req);
    const wait = tooMany(key, max, windowMs);
    if (wait > 0) {
      res.setHeader('Retry-After', String(wait));
      return res.status(429).json({
        error: `Juda ko‘p so‘rov. ${wait} soniyadan keyin qayta urinib ko‘ring.`,
        retryAfter: wait,
      });
    }
    next();
  };
}
