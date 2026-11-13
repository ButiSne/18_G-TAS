// The public vote against Postgres (gtas_test): swipes only while open and only for this
// round's entries, undo, one number-one vote per phone (refused politely the second time),
// one submission per phone after which nothing changes, and nothing kept but the vote.

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/src/db/schema";
import { publicResults } from "@/src/lib/stages";
import {
  chooseNumberOne,
  recordSwipe,
  submitBallot,
  undoSwipe,
  VoteError,
  voterState,
} from "@/src/lib/voting";

const url = process.env.DATABASE_URL_TEST ?? "postgres://gtas:gtas@localhost:5418/gtas_test";
const sql = postgres(url, { max: 2, onnotice: () => {} });
const db = drizzle(sql, { schema });
let roundId = "";
let otherRoundEntry = "";
let e: string[] = [];
const phone = (deviceHash: string) => ({ publicRoundId: roundId, deviceHash });

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (err) {
    return err instanceof VoteError ? err.code : String(err);
  }
};

beforeAll(async () => {
  await sql.unsafe(
    "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;",
  );
  await migrate(db, { migrationsFolder: "drizzle" });
  const designs = await db
    .insert(schema.design)
    .values(
      ["a", "b", "c"].map((s) => ({ slug: s, title: s.toUpperCase(), line: "EITEEN" as const })),
    )
    .returning({ id: schema.design.id });
  const rounds = await db
    .insert(schema.publicRound)
    .values([
      { title: "Vote", mode: "swipe", status: "draft" },
      { title: "Other", mode: "swipe", status: "open" },
    ])
    .returning({ id: schema.publicRound.id });
  roundId = rounds[0]!.id;
  const entries = await db
    .insert(schema.publicEntry)
    .values(designs.map((d) => ({ publicRoundId: roundId, designId: d.id })))
    .returning({ id: schema.publicEntry.id });
  e = entries.map((x) => x.id);
  const [other] = await db
    .insert(schema.publicEntry)
    .values({ publicRoundId: rounds[1]!.id, designId: designs[0]!.id })
    .returning({ id: schema.publicEntry.id });
  otherRoundEntry = other!.id;
}, 60_000);

afterAll(async () => {
  await sql.end();
});

describe("public vote", () => {
  it("refuses swipes before voting opens", async () => {
    expect(
      await code(recordSwipe(db, { ...phone("p1"), entryId: e[0]!, liked: true, ref: "fb" })),
    ).toBe("not_open");
    await sql`update public_round set status = 'open' where id = ${roundId}`;
  });

  it("only accepts this round's designs", async () => {
    expect(
      await code(
        recordSwipe(db, { ...phone("p1"), entryId: otherRoundEntry, liked: true, ref: null }),
      ),
    ).toBe("unknown_entry");
  });

  it("records one swipe per design per phone; swiping again changes it; undo removes it", async () => {
    await recordSwipe(db, { ...phone("p1"), entryId: e[0]!, liked: false, ref: "fb" });
    await recordSwipe(db, { ...phone("p1"), entryId: e[0]!, liked: true, ref: "fb" });
    await recordSwipe(db, { ...phone("p1"), entryId: e[1]!, liked: true, ref: "fb" });
    await recordSwipe(db, { ...phone("p1"), entryId: e[2]!, liked: false, ref: "fb" });
    let s = await voterState(db, phone("p1"));
    expect(s.swipes).toHaveLength(3);
    expect(s.swipes.find((x) => x.entryId === e[0])?.liked).toBe(true);
    await undoSwipe(db, { ...phone("p1"), entryId: e[2]! });
    s = await voterState(db, phone("p1"));
    expect(s.swipes).toHaveLength(2);
  });

  it("allows one number-one vote per phone, only for a YEBO, and refuses a second", async () => {
    expect(await code(chooseNumberOne(db, { ...phone("p1"), entryId: e[2]!, ref: "fb" }))).toBe(
      "not_liked",
    );
    expect(await code(chooseNumberOne(db, { ...phone("p1"), entryId: e[1]!, ref: "fb" }))).toBe(
      "ok",
    );
    expect(await code(chooseNumberOne(db, { ...phone("p1"), entryId: e[0]!, ref: "fb" }))).toBe(
      "already_voted",
    );
    expect((await voterState(db, phone("p1"))).numberOne).toBe(e[1]);
  });

  it("submits once per phone, after which nothing can change", async () => {
    expect(await code(submitBallot(db, phone("p9")))).toBe("nothing_to_submit");
    expect(await code(submitBallot(db, phone("p1")))).toBe("ok");
    expect((await voterState(db, phone("p1"))).submitted).toBe(true);
    expect(await code(submitBallot(db, phone("p1")))).toBe("already_submitted");
    expect(
      await code(recordSwipe(db, { ...phone("p1"), entryId: e[2]!, liked: true, ref: null })),
    ).toBe("already_submitted");
    expect(await code(undoSwipe(db, { ...phone("p1"), entryId: e[1]! }))).toBe("already_submitted");
    // Another phone is unaffected.
    await recordSwipe(db, { ...phone("p2"), entryId: e[0]!, liked: true, ref: null });
    expect((await voterState(db, phone("p2"))).submitted).toBe(false);
  });

  it("keeps nothing but the vote: no IP, no age, no area", async () => {
    const swipes = await sql<{ n: number }[]>`
      select count(*)::int as n from swipe
      where ip_hash is not null or age_bracket is not null or province is not null`;
    const votes = await sql<{ n: number }[]>`
      select count(*)::int as n from vote
      where ip_hash is not null or age_bracket is not null or province is not null or area is not null`;
    expect([swipes[0]!.n, votes[0]!.n]).toEqual([0, 0]);
    const cols = await sql<{ column_name: string }[]>`
      select column_name from information_schema.columns where table_name = 'ballot'`;
    expect(cols.map((c) => c.column_name).sort()).toEqual(
      ["device_hash", "id", "public_round_id", "submitted_at"].sort(),
    );
  });

  it("feeds the results, then refuses swipes once voting closes", async () => {
    const res = await publicResults(db, roundId);
    expect(res.devices).toBe(2);
    expect(res.ranked[0]!.entryId).toBe(e[0]); // 2 YEBOs
    await sql`update public_round set status = 'closed' where id = ${roundId}`;
    expect(
      await code(recordSwipe(db, { ...phone("p3"), entryId: e[0]!, liked: true, ref: null })),
    ).toBe("not_open");
  });

  it("stores no raw IP or device token", async () => {
    const [row] = await sql<{ n: number }[]>`
      select count(*)::int as n from swipe where ip_hash ~ '\\d+\\.\\d+\\.\\d+\\.\\d+'`;
    expect(row!.n).toBe(0);
  });
});
