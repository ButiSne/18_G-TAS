// Rate limiting and 90-day retention against Postgres (gtas_test).

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/src/db/schema";
import { hit, sweepRateLimits, windowStart } from "@/src/lib/rate-limit";
import { runRetention } from "@/src/lib/retention";
import { publicResults } from "@/src/lib/stages";

const url = process.env.DATABASE_URL_TEST ?? "postgres://gtas:gtas@localhost:5418/gtas_test";
const sql = postgres(url, { max: 10, onnotice: () => {} });
const db = drizzle(sql, { schema });
const now = new Date("2026-11-08T12:00:30Z");
const day = 24 * 60 * 60_000;

beforeAll(async () => {
  await sql.unsafe(
    "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;",
  );
  await migrate(db, { migrationsFolder: "drizzle" });
}, 60_000);

afterAll(async () => {
  await sql.end();
});

describe("rate limiting", () => {
  const limit = { limit: 5, windowMs: 60_000 };

  it("counts hits in a window and refuses past the limit", async () => {
    const results = [];
    for (let i = 0; i < 7; i++) results.push(await hit(db, "swipe:dev:a", limit, now));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, true, true, false, false]);
    expect(results[6]!.retryAfterMs).toBe(30_000);
  });

  it("starts again in a new window", async () => {
    const r = await hit(db, "swipe:dev:a", limit, new Date(now.getTime() + 60_000));
    expect(r).toMatchObject({ allowed: true, count: 1 });
  });

  it("holds the limit under concurrent hits", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => hit(db, "swipe:ip:shared", limit, now)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
    expect(results.map((r) => r.count).sort((x, y) => x - y)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
  });

  it("keeps separate keys apart, and sweeps windows older than a day", async () => {
    expect((await hit(db, "swipe:dev:b", limit, now)).count).toBe(1);
    await hit(db, "old", limit, new Date(now.getTime() - 2 * day));
    expect(await sweepRateLimits(db, now)).toBe(1);
    expect(windowStart(now, 60_000).toISOString()).toBe("2026-11-08T12:00:00.000Z");
  });
});

describe("retention (90 days after publishing)", () => {
  let oldRound = "";
  let newRound = "";

  beforeAll(async () => {
    const [d] = await db
      .insert(schema.design)
      .values({ slug: "kasi", title: "Kasi Halo", line: "EITEEN" })
      .returning({ id: schema.design.id });
    await db.insert(schema.colourway).values({
      designId: d!.id,
      name: "Black",
      imageUrl: "https://x/i.webp",
      thumbUrl: "https://x/t.webp",
      imageHash: "h1",
    });
    const rounds = await db
      .insert(schema.publicRound)
      .values([
        {
          title: "Old",
          mode: "swipe",
          status: "published",
          publishedAt: new Date(now.getTime() - 91 * day),
        },
        {
          title: "New",
          mode: "swipe",
          status: "published",
          publishedAt: new Date(now.getTime() - 10 * day),
        },
      ])
      .returning({ id: schema.publicRound.id });
    [oldRound, newRound] = rounds.map((r) => r.id) as [string, string];
    for (const roundId of [oldRound, newRound]) {
      const [entry] = await db
        .insert(schema.publicEntry)
        .values({ publicRoundId: roundId, designId: d!.id })
        .returning({ id: schema.publicEntry.id });
      await db.insert(schema.swipe).values([
        {
          publicRoundId: roundId,
          entryId: entry!.id,
          deviceHash: "p1",
          ipHash: "i",
          liked: true,
          ref: "fb",
          ageBracket: "16-17",
        },
        {
          publicRoundId: roundId,
          entryId: entry!.id,
          deviceHash: "p2",
          ipHash: "i",
          liked: true,
          ref: "fb",
          ageBracket: "16-17",
        },
        {
          publicRoundId: roundId,
          entryId: entry!.id,
          deviceHash: "p3",
          ipHash: "i",
          liked: false,
          ref: null,
        },
      ]);
      await db
        .insert(schema.vote)
        .values({
          publicRoundId: roundId,
          entryId: entry!.id,
          deviceHash: "p1",
          ipHash: "i",
          ref: "fb",
        });
    }
  });

  it("rolls up and deletes raw rows only for rounds published over 90 days ago", async () => {
    const before = await publicResults(db, oldRound);
    const report = await runRetention(db, now);
    expect(report).toMatchObject({ rounds: 1, swipesDeleted: 3, votesDeleted: 1 });

    const raw = await db
      .select()
      .from(schema.swipe)
      .where(eq(schema.swipe.publicRoundId, oldRound));
    expect(raw).toHaveLength(0);
    const kept = await db
      .select()
      .from(schema.swipe)
      .where(eq(schema.swipe.publicRoundId, newRound));
    expect(kept).toHaveLength(3);

    const totals = await db
      .select()
      .from(schema.swipeAggregate)
      .where(eq(schema.swipeAggregate.publicRoundId, oldRound));
    expect(totals.reduce((n, t) => n + t.likes, 0)).toBe(2);
    expect(totals.reduce((n, t) => n + t.passes, 0)).toBe(1);
    const votes = await db
      .select()
      .from(schema.voteAggregate)
      .where(eq(schema.voteAggregate.publicRoundId, oldRound));
    expect(votes.reduce((n, v) => n + v.votes, 0)).toBe(1);

    // The results page keeps working from the frozen snapshot.
    expect(await publicResults(db, oldRound)).toEqual(before);
  });

  it("is safe to run again", async () => {
    expect(await runRetention(db, now)).toMatchObject({
      rounds: 1,
      swipesDeleted: 0,
      votesDeleted: 0,
    });
    const totals = await db
      .select()
      .from(schema.swipeAggregate)
      .where(eq(schema.swipeAggregate.publicRoundId, oldRound));
    expect(totals.reduce((n, t) => n + t.likes, 0)).toBe(2);
  });
});
