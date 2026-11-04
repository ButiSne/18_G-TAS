// Rate limiting (brief §2) in Postgres: a fixed-window counter per key, updated in one
// atomic statement, so concurrent requests can't slip past the limit. No extra service;
// Upstash can replace this later behind the same function if traffic ever needs it.
// Keys carry only salted hashes, never an IP or a token.

import { lt, sql } from "drizzle-orm";
import type { createDb } from "../db/client.ts";
import { rateLimit } from "../db/schema.ts";

type Db = ReturnType<typeof createDb>;

export type Limit = { limit: number; windowMs: number };

/** The limits used across the app, in one place. */
export const LIMITS = {
  // One phone swiping: 20 designs in a minute is fast; 90 is a script.
  swipePerDevice: { limit: 90, windowMs: 60_000 },
  // One network: generous, because a whole school or taxi rank can share an IP.
  swipePerIp: { limit: 1200, windowMs: 60_000 },
  // "Let's go" (the bot check) from one network.
  startPerIp: { limit: 60, windowMs: 10 * 60_000 },
  // Number one and "about you" from one phone.
  finishPerDevice: { limit: 15, windowMs: 60_000 },
  // Invite-link sign-in attempts from one network.
  signInPerIp: { limit: 20, windowMs: 10 * 60_000 },
} satisfies Record<string, Limit>;

export const windowStart = (now: Date, windowMs: number) =>
  new Date(Math.floor(now.getTime() / windowMs) * windowMs);

export type RateResult = { allowed: boolean; count: number; retryAfterMs: number };

/** Counts one hit against `key` and says whether it is within the limit. */
export async function hit(
  db: Db,
  key: string,
  { limit, windowMs }: Limit,
  now: Date,
): Promise<RateResult> {
  const start = windowStart(now, windowMs);
  const [row] = await db
    .insert(rateLimit)
    .values({ key, windowStart: start, count: 1 })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        // Same window: add one. A new window: start again at 1.
        count: sql`case when ${rateLimit.windowStart} = excluded.window_start
          then ${rateLimit.count} + 1 else 1 end`,
        windowStart: sql`excluded.window_start`,
      },
    })
    .returning({ count: rateLimit.count });
  const count = row?.count ?? 1;
  return {
    allowed: count <= limit,
    count,
    retryAfterMs: start.getTime() + windowMs - now.getTime(),
  };
}

/** Checks several limits; refused if any is exceeded. */
export async function hitAll(db: Db, checks: [string, Limit][], now: Date): Promise<boolean> {
  const results = await Promise.all(checks.map(([key, l]) => hit(db, key, l, now)));
  return results.every((r) => r.allowed);
}

/** Housekeeping for the daily job: windows that ended over a day ago are useless. */
export async function sweepRateLimits(db: Db, now: Date) {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60_000);
  const gone = await db.delete(rateLimit).where(lt(rateLimit.windowStart, cutoff)).returning();
  return gone.length;
}
