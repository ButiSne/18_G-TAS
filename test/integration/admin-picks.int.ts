// The admin's picks (owner's decision, Nov 2026) against Postgres (gtas_test): any number,
// no Borda points, every one guaranteed a place in the public vote, hidden until the round
// closes, and the round waits for the admin. Replays production: the team had already
// finished, and the round reopened for the admin alone without touching anyone's picks.

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/src/db/schema";
import { confirmShortlist, shortlistPlan } from "@/src/lib/stages";
import {
  myRoundState,
  openRound,
  reopenForAdmin,
  roundResults,
  RoundError,
  savePicks,
  submitPicks,
  type RoundResults,
} from "@/src/lib/team-round";

const url = process.env.DATABASE_URL_TEST ?? "postgres://gtas:gtas@localhost:5418/gtas_test";
const sql = postgres(url, { max: 4, onnotice: () => {} });
const db = drizzle(sql, { schema });
const now = new Date("2026-11-13T09:00:00Z");

let [admin, a, b, c] = ["", "", "", ""];
let d: string[] = [];
let roundId = "";
let before: RoundResults | null = null;

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof RoundError ? e.code : String(e);
  }
};

beforeAll(async () => {
  await sql.unsafe(
    "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;",
  );
  await migrate(db, { migrationsFolder: "drizzle" });
  const people = await db
    .insert(schema.member)
    .values(
      ["Admin GTAS18", "Ayanda", "Bongi", "Cebo"].map((name, i) => ({
        name,
        email: `p${i}@example.com`,
        role: i === 0 ? ("admin" as const) : ("member" as const),
      })),
    )
    .returning({ id: schema.member.id });
  [admin, a, b, c] = people.map((p) => p.id) as [string, string, string, string];
  d = (
    await db
      .insert(schema.design)
      .values(
        Array.from({ length: 16 }, (_, i) => ({
          slug: `ap${i}`,
          title: `Design ${i}`,
          line: "EITEEN" as const,
          printMethod: i % 2 ? "dtf" : "full-sublimation",
        })),
      )
      .returning({ id: schema.design.id })
  ).map((r) => r.id);
  const [round] = await db
    .insert(schema.selectionRound)
    .values({ title: "Team round 1" })
    .returning({ id: schema.selectionRound.id });
  roundId = round!.id;
}, 60_000);

afterAll(async () => {
  await sql.end();
});

describe("the admin's picks", () => {
  it("replays production: the team finishes and the round closes without the admin", async () => {
    await openRound(db, {
      roundId,
      memberIds: [a, b, c],
      picksPerMember: 3,
      shortlistSize: 10,
      actorId: admin,
      now,
    });
    const sets = { [a]: [0, 1, 2], [b]: [1, 2, 3], [c]: [2, 4, 5] };
    let closed = false;
    for (const [memberId, idx] of Object.entries(sets)) {
      await savePicks(db, { roundId, memberId, designIds: idx.map((i) => d[i]!), now });
      closed = (await submitPicks(db, { roundId, memberId, now })).roundClosed;
    }
    expect(closed).toBe(true);
    before = await roundResults(db, roundId);
    expect(before!.adminPicks).toEqual([]);
  });

  it("only an admin can reopen the round for admin picks", async () => {
    expect(await code(reopenForAdmin(db, { roundId, adminId: a, now }))).toBe("not_admin");
  });

  it("reopens for the admin alone, leaving every member's submitted picks locked", async () => {
    await reopenForAdmin(db, { roundId, adminId: admin, now });
    const [round] = await db
      .select()
      .from(schema.selectionRound)
      .where(eq(schema.selectionRound.id, roundId));
    expect(round!.status).toBe("open");
    for (const m of [a, b, c]) {
      const mine = await myRoundState(db, roundId, m);
      expect(mine.submittedAt).not.toBeNull();
      expect(mine.designIds).toHaveLength(3);
    }
    expect(await code(savePicks(db, { roundId, memberId: a, designIds: [d[9]!], now }))).toBe(
      "already_submitted",
    );
    expect((await myRoundState(db, roundId, admin)).role).toBe("curator");
    // Hidden while open, as for everyone.
    expect(await roundResults(db, roundId)).toBeNull();
  });

  it("lets the admin tick any number of designs, then closes the round on submit", async () => {
    const mine = [2, 4, 9, 10, 11, 12, 13].map((i) => d[i]!); // 7, more than the 3 each
    await savePicks(db, { roundId, memberId: admin, designIds: mine, now });
    expect((await submitPicks(db, { roundId, memberId: admin, now })).roundClosed).toBe(true);
  });

  it("gives the admin's picks no points: the team's ranking is exactly as before", async () => {
    const after = await roundResults(db, roundId);
    expect(after!.standings).toEqual(before!.standings);
    expect(after!.adminPicks).toHaveLength(7);
    expect(after!.byMember.find((m) => m.memberId === admin)?.role).toBe("curator");
  });

  it("puts every admin pick in the public vote, on top of the team's cut", async () => {
    const plan = await shortlistPlan(db, roundId);
    const cutIds = plan!.cut.included.map((s) => s.designId);
    expect(cutIds).toHaveLength(6); // all six designs the team picked
    expect(plan!.adminExtras.sort()).toEqual([9, 10, 11, 12, 13].map((i) => d[i]!).sort());

    const { publicRoundId } = await confirmShortlist(db, {
      roundId,
      tieChoice: [],
      note: null,
      actorId: admin,
      now,
    });
    const entries = await db
      .select({ designId: schema.publicEntry.designId })
      .from(schema.publicEntry)
      .where(eq(schema.publicEntry.publicRoundId, publicRoundId));
    expect(entries).toHaveLength(11); // 6 from the team + 5 admin extras
    const rows = await db.select().from(schema.shortlist);
    expect(
      rows
        .filter((r) => r.adminChoice)
        .map((r) => r.designId)
        .sort(),
    ).toEqual([2, 4, 9, 10, 11, 12, 13].map((i) => d[i]!).sort());
  });

  it("does not let an admin who already submitted pick again", async () => {
    expect(await code(reopenForAdmin(db, { roundId, adminId: admin, now }))).toBe(
      "already_submitted",
    );
  });

  it("logs the reopening", async () => {
    const actions = (await db.select().from(schema.auditLog)).map((l) => l.action);
    expect(actions).toContain("round.reopened_for_admin");
  });

  it("in a new round, an admin chosen to pick holds up the close until they submit", async () => {
    const [r2] = await db
      .insert(schema.selectionRound)
      .values({ title: "Team round 2" })
      .returning({ id: schema.selectionRound.id });
    await openRound(db, {
      roundId: r2!.id,
      memberIds: [a, admin],
      picksPerMember: 2,
      shortlistSize: 10,
      actorId: admin,
      now,
    });
    expect((await myRoundState(db, r2!.id, admin)).role).toBe("curator");
    await savePicks(db, { roundId: r2!.id, memberId: a, designIds: [d[0]!, d[1]!], now });
    expect((await submitPicks(db, { roundId: r2!.id, memberId: a, now })).roundClosed).toBe(false);
    expect(await code(submitPicks(db, { roundId: r2!.id, memberId: admin, now }))).toBe(
      "invalid_picks", // at least one pick
    );
    await savePicks(db, { roundId: r2!.id, memberId: admin, designIds: [d[7]!], now });
    expect((await submitPicks(db, { roundId: r2!.id, memberId: admin, now })).roundClosed).toBe(
      true,
    );
  });

  it("refuses a round with only admins picking", async () => {
    const [r3] = await db
      .insert(schema.selectionRound)
      .values({ title: "Team round 3" })
      .returning({ id: schema.selectionRound.id });
    expect(
      await code(
        openRound(db, {
          roundId: r3!.id,
          memberIds: [admin],
          picksPerMember: 2,
          shortlistSize: 10,
          actorId: admin,
          now,
        }),
      ),
    ).toBe("bad_settings");
  });
});

describe("the admin's picks after the shortlist is confirmed (production, 13 Nov 2026)", () => {
  let r = "";
  let prId = "";
  const entryCount = async () =>
    (
      await db
        .select({ id: schema.publicEntry.id })
        .from(schema.publicEntry)
        .where(eq(schema.publicEntry.publicRoundId, prId))
    ).length;

  it("starts from a confirmed shortlist whose public vote is still a draft", async () => {
    const [round] = await db
      .insert(schema.selectionRound)
      .values({ title: "Team round 4" })
      .returning({ id: schema.selectionRound.id });
    r = round!.id;
    await openRound(db, {
      roundId: r,
      memberIds: [a, b],
      picksPerMember: 2,
      shortlistSize: 10,
      actorId: admin,
      now,
    });
    for (const [m, idx] of [
      [a, [0, 1]],
      [b, [1, 2]],
    ] as const) {
      await savePicks(db, { roundId: r, memberId: m, designIds: idx.map((i) => d[i]!), now });
      await submitPicks(db, { roundId: r, memberId: m, now });
    }
    prId = (
      await confirmShortlist(db, { roundId: r, tieChoice: [], note: null, actorId: admin, now })
    ).publicRoundId;
    expect(await entryCount()).toBe(3);
  });

  it("lets the admin in without reopening the team round", async () => {
    await reopenForAdmin(db, { roundId: r, adminId: admin, now });
    const [round] = await db
      .select()
      .from(schema.selectionRound)
      .where(eq(schema.selectionRound.id, r));
    expect(round!.status).toBe("published");
    expect((await myRoundState(db, r, admin)).role).toBe("curator");
    // Members stay locked: the round itself is not open to them.
    expect(await code(savePicks(db, { roundId: r, memberId: a, designIds: [d[5]!], now }))).toBe(
      "not_open",
    );
  });

  it("puts the admin's picks straight into the public vote on submit", async () => {
    // d1 is already on the shortlist; d14 and d15 are new.
    await savePicks(db, { roundId: r, memberId: admin, designIds: [d[1]!, d[14]!, d[15]!], now });
    expect((await submitPicks(db, { roundId: r, memberId: admin, now })).roundClosed).toBe(false);
    expect(await entryCount()).toBe(5);
    const rows = await db.select().from(schema.shortlist).where(eq(schema.shortlist.roundId, r));
    expect(
      rows
        .filter((x) => x.adminChoice)
        .map((x) => x.designId)
        .sort(),
    ).toEqual([d[1]!, d[14]!, d[15]!].sort());
    expect(rows.find((x) => x.designId === d[14])).toMatchObject({ points: 0, position: 4 });
    // Team points untouched: d1 was #2 for one member and #1 for the other (2 + 1).
    expect(rows.find((x) => x.designId === d[1])?.points).toBe(3);
  });

  it("closes the window once the public vote starts", async () => {
    await db
      .update(schema.publicRound)
      .set({ status: "open" })
      .where(eq(schema.publicRound.id, prId));
    expect(await code(reopenForAdmin(db, { roundId: r, adminId: admin, now }))).toBe(
      "vote_started",
    );
  });
});
