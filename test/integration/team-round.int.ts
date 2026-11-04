// The team round against Postgres (gtas_test): who may pick, exactly N on submit, lock,
// auto-close on the last submit (also under a race), unlock, and results hidden until close.

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/src/db/schema";
import {
  closeRound,
  myRoundState,
  openRound,
  roundProgress,
  roundResults,
  RoundError,
  savePicks,
  submitPicks,
  unlockMember,
} from "@/src/lib/team-round";

const url = process.env.DATABASE_URL_TEST ?? "postgres://gtas:gtas@localhost:5418/gtas_test";
const sql = postgres(url, { max: 4, onnotice: () => {} });
const db = drizzle(sql, { schema });
const now = new Date("2026-11-05T09:00:00Z");

let admin = "";
let [a, b, c, outsider] = ["", "", "", ""];
let designs: string[] = [];
let roundId = "";

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
      ["Admin", "Ayanda", "Bongi", "Cebo", "Outsider"].map((name, i) => ({
        name,
        email: `${name.toLowerCase()}@example.com`,
        role: i === 0 ? ("admin" as const) : ("member" as const),
      })),
    )
    .returning({ id: schema.member.id });
  [admin, a, b, c, outsider] = people.map((p) => p.id) as [string, string, string, string, string];
  const rows = await db
    .insert(schema.design)
    .values(
      Array.from({ length: 8 }, (_, i) => ({
        slug: `d${i}`,
        title: `Design ${i}`,
        line: "EITEEN" as const,
      })),
    )
    .returning({ id: schema.design.id });
  designs = rows.map((r) => r.id);
  const [round] = await db
    .insert(schema.selectionRound)
    .values({ title: "Team round 1" })
    .returning({ id: schema.selectionRound.id });
  roundId = round!.id;
}, 60_000);

afterAll(async () => {
  await sql.end();
});

describe("team round", () => {
  it("refuses picks before the round opens", async () => {
    expect(await code(savePicks(db, { roundId, memberId: a, designIds: [designs[0]!], now }))).toBe(
      "not_open",
    );
  });

  it("opens with the chosen team and settings, once", async () => {
    expect(
      await code(
        openRound(db, {
          roundId,
          memberIds: [a, b, c],
          picksPerMember: 3,
          shortlistSize: 99,
          actorId: admin,
          now,
        }),
      ),
    ).toBe("bad_settings");
    await openRound(db, {
      roundId,
      memberIds: [a, b, c],
      picksPerMember: 3,
      shortlistSize: 10,
      actorId: admin,
      now,
    });
    expect(
      await code(
        openRound(db, {
          roundId,
          memberIds: [a],
          picksPerMember: 3,
          shortlistSize: 10,
          actorId: admin,
          now,
        }),
      ),
    ).toBe("not_draft");
    expect(await roundProgress(db, roundId)).toEqual({ invited: 3, submitted: 0 });
  });

  it("only lets invited members pick, never more than N, never a duplicate", async () => {
    expect(
      await code(savePicks(db, { roundId, memberId: outsider, designIds: [designs[0]!], now })),
    ).toBe("not_in_round");
    expect(
      await code(savePicks(db, { roundId, memberId: a, designIds: designs.slice(0, 4), now })),
    ).toBe("invalid_picks");
    expect(
      await code(
        savePicks(db, { roundId, memberId: a, designIds: [designs[0]!, designs[0]!], now }),
      ),
    ).toBe("invalid_picks");
    expect(
      await code(
        savePicks(db, {
          roundId,
          memberId: a,
          designIds: ["00000000-0000-0000-0000-000000000000"],
          now,
        }),
      ),
    ).toBe("unknown_design");
  });

  it("saves a draft in rank order and lets it change until submit", async () => {
    await savePicks(db, { roundId, memberId: a, designIds: [designs[1]!, designs[0]!], now });
    expect((await myRoundState(db, roundId, a)).designIds).toEqual([designs[1], designs[0]]);
    await savePicks(db, {
      roundId,
      memberId: a,
      designIds: [designs[0]!, designs[1]!, designs[2]!],
      now,
    });
    expect((await myRoundState(db, roundId, a)).designIds).toEqual(designs.slice(0, 3));
  });

  it("will not submit fewer than N picks, then locks after submit", async () => {
    await savePicks(db, { roundId, memberId: b, designIds: [designs[0]!], now });
    expect(await code(submitPicks(db, { roundId, memberId: b, now }))).toBe("invalid_picks");

    expect(await submitPicks(db, { roundId, memberId: a, now })).toEqual({ roundClosed: false });
    expect(await code(savePicks(db, { roundId, memberId: a, designIds: [designs[3]!], now }))).toBe(
      "already_submitted",
    );
    expect(await code(submitPicks(db, { roundId, memberId: a, now }))).toBe("already_submitted");
  });

  it("hides results while the round is open", async () => {
    expect(await roundResults(db, roundId)).toBeNull();
  });

  it("lets the admin unlock a member, who can then change and resubmit", async () => {
    await unlockMember(db, { roundId, memberId: a, actorId: admin });
    await savePicks(db, {
      roundId,
      memberId: a,
      designIds: [designs[0]!, designs[2]!, designs[1]!],
      now,
    });
    await submitPicks(db, { roundId, memberId: a, now });
    expect((await myRoundState(db, roundId, a)).submittedAt).not.toBeNull();
  });

  it("closes automatically when the last two submit at the same moment", async () => {
    await savePicks(db, {
      roundId,
      memberId: b,
      designIds: [designs[0]!, designs[3]!, designs[4]!],
      now,
    });
    await savePicks(db, {
      roundId,
      memberId: c,
      designIds: [designs[2]!, designs[0]!, designs[5]!],
      now,
    });
    const results = await Promise.all([
      submitPicks(db, { roundId, memberId: b, now }),
      submitPicks(db, { roundId, memberId: c, now }),
    ]);
    expect(results.filter((r) => r.roundClosed)).toHaveLength(1);
    const [round] = await db
      .select()
      .from(schema.selectionRound)
      .where(eq(schema.selectionRound.id, roundId));
    expect(round!.status).toBe("closed");
  });

  it("then shows Borda standings and who picked what", async () => {
    const r = (await roundResults(db, roundId))!;
    // a: d0,d2,d1 · b: d0,d3,d4 · c: d2,d0,d5 → d0 = 3+3+2 = 8, d2 = 2+3 = 5
    expect(r.standings[0]).toMatchObject({
      designId: designs[0],
      points: 8,
      pickedBy: 3,
      consensus: true,
    });
    expect(r.standings[1]).toMatchObject({ designId: designs[2], points: 5, pickedBy: 2 });
    expect(r.byMember.map((m) => m.name)).toEqual(["Ayanda", "Bongi", "Cebo"]);
    expect(r.byMember[0]!.designIds).toEqual([designs[0], designs[2], designs[1]]);
  });

  it("refuses changes once closed, and closing twice", async () => {
    expect(await code(savePicks(db, { roundId, memberId: a, designIds: [], now }))).toBe(
      "not_open",
    );
    expect(await code(closeRound(db, { roundId, actorId: admin, now }))).toBe("not_open");
  });

  it("logs every step", async () => {
    const actions = (await db.select().from(schema.auditLog)).map((r) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        "round.opened",
        "picks.submitted",
        "member.unlocked",
        "round.closed",
      ]),
    );
  });
});
