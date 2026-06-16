// Lightweight in-process rate limiter (token bucket).
// For production: replace with Vercel KV or Upstash Ratelimit (Redis-backed).
// Single-instance only — works on Node runtime. On Edge runtime, swap to
// Upstash Ratelimit (@upstash/ratelimit) which uses Web Crypto.

type Bucket = {
  tokens: number;
  lastRefill: number;
};

const buckets = new Map<string, Bucket>();

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

export function rateLimit(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const refillRate = opts.capacity / opts.windowMs;
  const existing = buckets.get(opts.key);

  if (!existing) {
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
