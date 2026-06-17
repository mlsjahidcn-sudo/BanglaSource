// Lightweight in-process rate limiter (token bucket).
// For production: replace with Vercel KV or Upstash Ratelimit (Redis-backed).
// Single-instance only — works on Node runtime. On Edge runtime, swap to
// Upstash Ratelimit (@upstash/ratelimit) which uses Web Crypto.

type Bucket = {
  tokens: number;
  lastRefill: number;
};

const buckets = new Map<string, Bucket>();

// AUDIT FIX 2026-06-17 (C2): unbounded Map growth under sustained
// traffic. Each unique (IP × endpoint) pair creates a Map entry
// that never expires. With 100 unique IPs hitting 20 endpoints,
// that's 2000 entries per second the bucket fills. We cap it at
// MAX_BUCKETS; when exceeded, opportunistically drop the
// half-of-entries with the oldest `lastRefill` (cold buckets
// haven't been used recently and are safe to discard — the next
// request from that IP will just create a fresh full bucket).
const MAX_BUCKETS = 10_000;

export type RateLimitOptions = {
  /** Identifier (IP, user id, etc.) */
  key: string;
  /** Max tokens (requests per window) */
  capacity: number;
  /** Refill window in ms */
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetIn: number; // ms until next token
};

function gcIfNeeded() {
  if (buckets.size <= MAX_BUCKETS) return;
  // Drop the coldest half. Sort by lastRefill ASC, drop the first
  // half. O(n log n) but only runs when we hit the cap (rare).
  const entries = Array.from(buckets.entries()).sort(
    (a, b) => a[1].lastRefill - b[1].lastRefill,
  );
  const toDrop = Math.floor(entries.length / 2);
  for (let i = 0; i < toDrop; i++) {
    buckets.delete(entries[i][0]);
  }
}

export function rateLimit(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const refillRate = opts.capacity / opts.windowMs;
  const existing = buckets.get(opts.key);

  if (!existing) {
    gcIfNeeded();
    buckets.set(opts.key, {
      tokens: opts.capacity - 1,
      lastRefill: now,
    });
    return { allowed: true, remaining: opts.capacity - 1, resetIn: opts.windowMs };
  }

  // Refill since last access
  const elapsed = now - existing.lastRefill;
  const refilled = Math.min(opts.capacity, existing.tokens + elapsed * refillRate);
  existing.tokens = refilled;
  existing.lastRefill = now;

  if (existing.tokens >= 1) {
    existing.tokens -= 1;
    buckets.set(opts.key, existing);
    return {
      allowed: true,
      remaining: Math.floor(existing.tokens),
      resetIn: Math.ceil((1 - existing.tokens) / refillRate),
    };
  }

  buckets.set(opts.key, existing);
  return {
    allowed: false,
    remaining: 0,
    resetIn: Math.ceil((1 - existing.tokens) / refillRate),
  };
}

export function clientKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "anonymous";
}
