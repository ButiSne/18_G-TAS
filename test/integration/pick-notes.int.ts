// Comments and suggestions in the team round, against Postgres (gtas_test): notes only on
// ticked designs, kept through a reorder, gone with the pick, locked on submit, and private
// until the round closes.

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/src/db/schema";
import {
  myRoundState,
  type NoteKind,
  openRound,
  roundResults,
  RoundError,
  savePickNote,
  savePicks,
  saveSuggestion,
  submitPicks,
} from "@/src/lib/team-round";

const url = process.env.DATABASE_URL_TEST ?? "postgres://gtas:gtas@localhost:5418/gtas_test";
const sql = postgres(url, { max: 4, onnotice: () => {} });
const db = drizzle(sql, { schema });
const now = new Date("2026-11-05T09:00:00Z");

let [admin, a, b] = ["", "", ""];
let d: string[] = [];
let roundId = "";

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof RoundError ? e.code : String(e);
  }
};
const note = (memberId: string, designId: string, text: string, kind: NoteKind = "comment") =>
  savePickNote(db, { roundId, memberId, designId, note: text, kind, now });

beforeAll(async () => {
  await sql.unsafe(
    "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;",
  );
  await migrate(db, { migrationsFolder: "drizzle" });
  const people = await db
    .insert(schema.member)
    .values(
      ["Admin", "Ayanda", "Bongi"].map((name, i) => ({
        name,
        email: `${name.toLowerCase()}@example.com`,
        role: i === 0 ? ("admin" as const) : ("member" as const),
      })),
    )
    .returning({ id: schema.member.id });
  [admin, a, b] = people.map((p) => p.id) as [string, string, string];
  d = (
    await db
      .insert(schema.design)
      .values(
        Array.from({ length: 4 }, (_, i) => ({
          slug: `n${i}`,
          title: `N${i}`,
          line: "EITEEN" as const,
        })),
      )
      .returning({ id: schema.design.id })
  ).map((r) => r.id);
  const [round] = await db
    .insert(schema.selectionRound)
    .values({ title: "Notes round" })
    .returning({ id: schema.selectionRound.id });
  roundId = round!.id;
  await openRound(db, {
    roundId,
    memberIds: [a, b],
    picksPerMember: 2,
    shortlistSize: 10,
    actorId: admin,
    now,
  });
}, 60_000);

afterAll(async () => {
  await sql.end();
});

describe("pick notes", () => {
  it("only goes on a design the member ticked", async () => {
    await savePicks(db, { roundId, memberId: a, designIds: [d[0]!, d[1]!], now });
    expect(await code(note(a, d[2]!, "Not mine"))).toBe("not_picked");
    expect(await code(note(a, d[0]!, "  Love the gold  "))).toBe("ok");
    expect(await code(note(a, d[1]!, "Try it on navy", "suggestion"))).toBe("ok");
    expect((await myRoundState(db, roundId, a)).notes).toEqual({
      [d[0]!]: { note: "Love the gold", kind: "comment" },
      [d[1]!]: { note: "Try it on navy", kind: "suggestion" },
    });
  });

  it("refuses a note over 280 characters", async () => {
    expect(await code(note(a, d[0]!, "x".repeat(281)))).toBe("too_long");
    expect(await code(note(a, d[0]!, "x".repeat(280)))).toBe("ok");
    await note(a, d[0]!, "Love the gold");
  });

  it("keeps notes through a reorder and drops one with its pick", async () => {
    await savePicks(db, { roundId, memberId: a, designIds: [d[1]!, d[0]!], now });
    expect(Object.keys((await myRoundState(db, roundId, a)).notes).sort()).toEqual(
      [d[0]!, d[1]!].sort(),
    );
    await savePicks(db, { roundId, memberId: a, designIds: [d[1]!, d[3]!], now });
    expect((await myRoundState(db, roundId, a)).notes).toEqual({
      [d[1]!]: { note: "Try it on navy", kind: "suggestion" },
    });
    await savePicks(db, { roundId, memberId: a, designIds: [d[1]!, d[0]!], now });
    expect((await myRoundState(db, roundId, a)).notes[d[0]!]).toBeUndefined();
  });

  it("deletes a note when it is saved empty", async () => {
    await note(a, d[0]!, "temporary");
    await note(a, d[0]!, "   ");
    expect((await myRoundState(db, roundId, a)).notes[d[0]!]).toBeUndefined();
  });

  it("keeps one free suggestion per member, up to 500 characters", async () => {
    await saveSuggestion(db, { roundId, memberId: a, text: "We need a bucket hat" });
    expect((await myRoundState(db, roundId, a)).suggestion).toBe("We need a bucket hat");
    expect(await code(saveSuggestion(db, { roundId, memberId: a, text: "y".repeat(501) }))).toBe(
      "too_long",
    );
  });

  it("stays private while the round is open", async () => {
    expect(await roundResults(db, roundId)).toBeNull();
  });

  it("locks notes and the suggestion on submit", async () => {
    await submitPicks(db, { roundId, memberId: a, now });
    expect(await code(note(a, d[1]!, "changed my mind"))).toBe("already_submitted");
    expect(await code(saveSuggestion(db, { roundId, memberId: a, text: "late" }))).toBe(
      "already_submitted",
    );
  });

  it("shows everyone's notes and suggestions once the round closes", async () => {
    await savePicks(db, { roundId, memberId: b, designIds: [d[1]!, d[2]!], now });
    await note(b, d[1]!, "Yes!");
    await submitPicks(db, { roundId, memberId: b, now }); // the last one: auto-close
    const res = await roundResults(db, roundId);
    const byName = Object.fromEntries(res!.byMember.map((m) => [m.name, m]));
    expect(byName.Ayanda!.notes[d[1]!]).toEqual({ note: "Try it on navy", kind: "suggestion" });
    expect(byName.Ayanda!.suggestion).toBe("We need a bucket hat");
    expect(byName.Bongi!.notes).toEqual({ [d[1]!]: { note: "Yes!", kind: "comment" } });
    expect(byName.Bongi!.suggestion).toBeNull();
  });

  it("enforces the rules in the database too", async () => {
    await expect(
      sql`update member_pick set note = ${"z".repeat(281)}, note_kind = 'comment'`,
    ).rejects.toThrow(/member_pick_note_length/);
    await expect(sql`update member_pick set note = 'x', note_kind = null`).rejects.toThrow(
      /member_pick_note_kind/,
    );
  });
});
