'use strict';

/**
 * Fixed-window rate limiter, dependency-free and memory-bounded.
 *
 * Two threats, one mechanism:
 *
 *   - challenge flooding: an attacker requests challenges in a loop to exhaust
 *     the nonce store or the process's memory;
 *   - signature grinding: an attacker retries verification against a captured
 *     signature or a guessed nonce.
 *
 * The counter map is capacity-bounded for the same reason the nonce store is: a
 * per-IP map with no ceiling is itself the memory-exhaustion bug it was added to
 * prevent, and an attacker with a spoofable source address fills it for free.
 * At capacity the limiter sheds by dropping the oldest window rather than
 * growing, which degrades fairness under attack instead of availability.
 */

const DEFAULT_MAX_CLIENTS = 50000;

function createRateLimiter({
  windowMs = 60_000,
  max = 30,
  maxClients = DEFAULT_MAX_CLIENTS,
  now = Date.now,
  keyFor = (req) => req.ip,
} = {}) {
  const windows = new Map();

  function hit(key) {
    const t = now();
    const existing = windows.get(key);

    if (!existing || existing.resetAt <= t) {
      if (!existing && windows.size >= maxClients) {
        // Shed the oldest entry. Map preserves insertion order.
        windows.delete(windows.keys().next().value);
      }
      const fresh = { count: 1, resetAt: t + windowMs };
      windows.set(key, fresh);
      return { allowed: true, remaining: max - 1, resetAt: fresh.resetAt };
    }

    existing.count += 1;
    return {
      allowed: existing.count <= max,
      remaining: Math.max(0, max - existing.count),
      resetAt: existing.resetAt,
    };
  }

  function middleware(req, res, next) {
    const result = hit(keyFor(req));
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(result.remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil((result.resetAt - now()) / 1000)));
    if (!result.allowed) {
      res.status(429).json({ error: 'rate limit exceeded' });
      return;
    }
    next();
  }

  middleware.hit = hit;
  middleware.size = () => windows.size;
  return middleware;
}

module.exports = { createRateLimiter, DEFAULT_MAX_CLIENTS };
