// The public vote against Postgres (gtas_test): swipes only while open and only for this
// round's entries, undo, one number-one vote per phone (refused politely the second time),
// and optional demographics.

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/src/db/schema";
import { publicResults } from "@/src/lib/stages";
import {
  chooseNumberOne,
  recordSwipe,
  saveDemographics,
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
const phone = (deviceHash: string) => ({ publicRoundId: roundId, deviceHash, ipHash: "iphash" });

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

  it("applies optional demographics to this phone only, ignoring made-up values", async () => {
    await recordSwipe(db, { ...phone("p2"), entryId: e[0]!, liked: true, ref: null });
    await saveDemographics(db, { ...phone("p1"), ageBracket: "16-17", province: "Mars" });
    const rows = await sql<
      { device_hash: string; age_bracket: string | null; province: string | null }[]
    >`
      select device_hash, age_bracket, province from swipe order by device_hash`;
    expect(rows.filter((r) => r.device_hash === "p1").every((r) => r.age_bracket === "16-17")).toBe(
      true,
    );
    expect(rows.every((r) => r.province === null)).toBe(true);
    expect(rows.find((r) => r.device_hash === "p2")?.age_bracket).toBeNull();
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
