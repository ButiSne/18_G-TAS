// Stages 2–3 against Postgres (gtas_test): shortlist with a tie at the cut, the public round
// lifecycle, swipe results, and the final ten (exactly 5 sublimation + 5 other).

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/src/db/schema";
import {
  advancePublicRound,
  confirmShortlist,
  currentPublicRound,
  finalCandidates,
  productionHandoff,
  publicResults,
  saveFinalTen,
  shortlistPlan,
  StageError,
  updateDesign,
} from "@/src/lib/stages";
import { openRound, savePicks, submitPicks } from "@/src/lib/team-round";

const url = process.env.DATABASE_URL_TEST ?? "postgres://gtas:gtas@localhost:5418/gtas_test";
const sql = postgres(url, { max: 4, onnotice: () => {} });
const db = drizzle(sql, { schema });
const now = new Date("2026-11-06T09:00:00Z");
let admin = "";
let d: string[] = [];
let roundId = "";
let publicRoundId = "";

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof StageError ? e.code : String(e);
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
      ["Admin", "A", "B", "C"].map((name, i) => ({
        name,
        email: `${name.toLowerCase()}@example.com`,
        role: i === 0 ? ("admin" as const) : ("member" as const),
      })),
    )
    .returning({ id: schema.member.id });
  admin = people[0]!.id;
  const designs = await db
    .insert(schema.design)
    .values(
      Array.from({ length: 16 }, (_, i) => ({
        slug: `d${String(i).padStart(2, "0")}`,
        title: `D${i}`,
        line: "EITEEN" as const,
      })),
    )
    .returning({ id: schema.design.id });
  d = designs.map((x) => x.id);
  await db.insert(schema.colourway).values(
    d.map((designId, i) => ({
      designId,
      name: "Black",
      imageUrl: `https://x/${i}.webp`,
      thumbUrl: `https://x/${i}-t.webp`,
      imageHash: `hash-${i}`,
      printFiles: [`print/${i}.pdf`],
    })),
  );
  const [round] = await db
    .insert(schema.selectionRound)
    .values({ title: "Team round 1" })
    .returning({ id: schema.selectionRound.id });
  roundId = round!.id;
  const [a, b, c] = people.slice(1).map((p) => p.id) as [string, string, string];
  await openRound(db, {
    roundId,
    memberIds: [a, b, c],
    picksPerMember: 6,
    shortlistSize: 10,
    actorId: admin,
    now,
  });
  // Totals: d0 18 · d1 10 · d2 8 · d9 5 · d10 4 · {d3,d6,d11} 3 · {d4,d7,d12} 2 · {d5,d8,d13} 1
  const picks: [string, number[]][] = [
    [a, [0, 1, 2, 3, 4, 5]],
    [b, [0, 1, 2, 6, 7, 8]],
    [c, [0, 9, 10, 11, 12, 13]],
  ];
  for (const [memberId, idx] of picks) {
    await savePicks(db, { roundId, memberId, designIds: idx.map((i) => d[i]!), now });
    await submitPicks(db, { roundId, memberId, now });
  }
}, 60_000);

afterAll(async () => {
  await sql.end();
});

describe("shortlist", () => {
  it("finds the tie that straddles the cut", async () => {
    const plan = (await shortlistPlan(db, roundId))!;
    expect(plan.cut.included).toHaveLength(8);
    expect(plan.cut.needsDecision?.seatsLeft).toBe(2);
    expect(plan.cut.needsDecision?.candidates.map((s) => s.designId).sort()).toEqual(
      [d[4], d[7], d[12]].sort(),
    );
  });

  it("refuses to confirm without the admin's choice and a reason", async () => {
    const base = { roundId, actorId: admin, now };
    expect(await code(confirmShortlist(db, { ...base, tieChoice: [], note: null }))).toBe(
      "tie_decision_required",
    );
    expect(
      await code(confirmShortlist(db, { ...base, tieChoice: [d[4]!, d[7]!], note: " " })),
    ).toBe("tie_decision_required");
    expect(
      await code(confirmShortlist(db, { ...base, tieChoice: [d[4]!, d[0]!], note: "x" })),
    ).toBe("tie_decision_required");
  });

  it("confirms, creating a swipe-mode public round with ten entries, once", async () => {
    const result = await confirmShortlist(db, {
      roundId,
      tieChoice: [d[4]!, d[12]!],
      note: "Stronger colourways",
      actorId: admin,
      now,
    });
    publicRoundId = result.publicRoundId;
    const pr = (await currentPublicRound(db))!;
    expect(pr).toMatchObject({ id: publicRoundId, mode: "swipe", status: "draft" });
    const entries = await db
      .select()
      .from(schema.publicEntry)
      .where(eq(schema.publicEntry.publicRoundId, publicRoundId));
    expect(entries).toHaveLength(10);
    expect(entries.map((e) => e.designId)).not.toContain(d[7]);
    const notes = await db.select().from(schema.shortlist);
    expect(notes.filter((s) => s.tieBreakNote === "Stronger colourways")).toHaveLength(2);
    expect(
      await code(
        confirmShortlist(db, {
          roundId,
          tieChoice: [d[4]!, d[12]!],
          note: "again",
          actorId: admin,
          now,
        }),
      ),
    ).not.toBe("ok");
  });
});

describe("public round", () => {
  it("moves forward one step at a time", async () => {
    const step = (to: "open" | "closed" | "published") =>
      code(advancePublicRound(db, { publicRoundId, to, actorId: admin, now }));
    expect(await step("closed")).toBe("bad_transition");
    expect(await step("open")).toBe("ok");
    expect(await step("open")).toBe("bad_transition");
  });

  it("ranks entries by confident YEBO rate and counts channels", async () => {
    const entries = await db
      .select()
      .from(schema.publicEntry)
      .where(eq(schema.publicEntry.publicRoundId, publicRoundId));
    const entryOf = (i: number) => entries.find((e) => e.designId === d[i])!.id;
    // 20 devices love d1; 20 devices pass on d0; 3 love d2.
    const rows = [
      ...Array.from({ length: 20 }, (_, k) => ({
        entry: entryOf(1),
        liked: true,
        dev: `p${k}`,
        ref: "fb",
      })),
      ...Array.from({ length: 20 }, (_, k) => ({
        entry: entryOf(0),
        liked: false,
        dev: `p${k}`,
        ref: "fb",
      })),
      ...Array.from({ length: 3 }, (_, k) => ({
        entry: entryOf(2),
        liked: true,
        dev: `w${k}`,
        ref: "wa-umlazi",
      })),
    ];
    await db.insert(schema.swipe).values(
      rows.map((r) => ({
        publicRoundId,
        entryId: r.entry,
        deviceHash: r.dev,
        ipHash: "ip",
        liked: r.liked,
        ref: r.ref,
      })),
    );
    const res = await publicResults(db, publicRoundId);
    expect(res.ranked[0]!.card.designId).toBe(d[1]);
    expect(res.ranked[1]!.card.designId).toBe(d[2]);
    expect(res.ranked.at(-1)!.card.designId).not.toBe(d[1]);
    expect(res.devices).toBe(23);
    expect(res.byRef).toEqual([
      { ref: "fb", devices: 20 },
      { ref: "wa-umlazi", devices: 3 },
    ]);
  });
});

describe("final ten", () => {
  it("needs a print method on every design, and exactly 5 + 5", async () => {
    const cands = await finalCandidates(db, publicRoundId);
    expect(cands).toHaveLength(10);
    const ids = cands.map((c) => c.designId);
    expect(
      await code(saveFinalTen(db, { publicRoundId, designIds: ids, actorId: admin, now })),
    ).toBe("invalid_final_ten");

    for (const [i, id] of ids.entries()) {
      await updateDesign(db, {
        designId: id,
        printMethod: i < 4 ? "sublimation" : "dtf",
        line: "EITEEN",
        hidden: false,
        actorId: admin,
      });
    }
    expect(
      await code(saveFinalTen(db, { publicRoundId, designIds: ids, actorId: admin, now })),
    ).toBe("invalid_final_ten"); // 4 + 6
    await updateDesign(db, {
      designId: ids[4]!,
      printMethod: "sublimation",
      line: "EITEEN",
      hidden: false,
      actorId: admin,
    });
    expect(
      await code(saveFinalTen(db, { publicRoundId, designIds: ids, actorId: admin, now })),
    ).toBe("ok");
  });

  it("rejects a print method that is not on the list", async () => {
    expect(
      await code(
        updateDesign(db, {
          designId: d[0]!,
          printMethod: "glitter",
          line: "EITEEN",
          hidden: false,
          actorId: admin,
        }),
      ),
    ).toBe("bad_design");
  });

  it("hands production every print file for the ten", async () => {
    const handoff = await productionHandoff(db, publicRoundId);
    expect(handoff).toHaveLength(10);
    expect(handoff.filter((h) => h.slot === "sublimation")).toHaveLength(5);
    expect(handoff[0]!.colourways[0]!.files[0]).toMatch(/^print\/\d+\.pdf$/);
  });

  it("logs every decision", async () => {
    const actions = new Set((await db.select().from(schema.auditLog)).map((r) => r.action));
    for (const a of [
      "shortlist.confirmed",
      "public_round.open",
      "design.updated",
      "final_ten.saved",
    ]) {
      expect(actions).toContain(a);
    }
  });
});
