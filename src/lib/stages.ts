// Stages 2 and 3 for the admin (CLAUDE.md §0.1, §9; HANDOVER §7.8): confirm the shortlist
// (which creates the public round), run the public round, read its results, and choose
// the final ten. Plain functions taking `db`, tested against Postgres.

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { createDb } from "../db/client.ts";
import {
  colourway,
  design,
  finalSelection,
  publicEntry,
  publicRound,
  selectionRound,
  shortlist,
  swipe,
  vote,
} from "../db/schema.ts";
import { audit } from "./audit.ts";
import type { Line } from "./design-line.ts";
import { shortlistCoverage, validateFinalTen, type FinalTenProblem } from "./final-ten.ts";
import { isPrintMethod, PRINT_METHODS, slotFor } from "./print-methods.ts";
import { cutShortlist, type ShortlistCut } from "./scoring.ts";
import { rankSwipes, type RankedEntry } from "./swipe-score.ts";
import { roundResults } from "./team-round.ts";

type Db = ReturnType<typeof createDb>;

export class StageError extends Error {
  constructor(
    public code:
      | "round_not_closed"
      | "already_confirmed"
      | "tie_decision_required"
      | "bad_transition"
      | "no_public_round"
      | "invalid_final_ten"
      | "bad_design",
    public problems: FinalTenProblem[] = [],
  ) {
    super(code);
  }
}

// --- Designs: the admin sets print method, line and visibility ---------------------

export async function updateDesign(
  db: Db,
  opts: {
    designId: string;
    printMethod: string | null;
    line: Line;
    hidden: boolean;
    actorId: string;
  },
) {
  if (opts.printMethod !== null && !isPrintMethod(opts.printMethod)) {
    throw new StageError("bad_design");
  }
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(design).where(eq(design.id, opts.designId));
    if (!before) throw new StageError("bad_design");
    await tx
      .update(design)
      .set({ printMethod: opts.printMethod, line: opts.line, hidden: opts.hidden })
      .where(eq(design.id, opts.designId));
    await audit(tx, opts.actorId, "design.updated", {
      designId: opts.designId,
      from: { printMethod: before.printMethod, line: before.line, hidden: before.hidden },
      to: { printMethod: opts.printMethod, line: opts.line, hidden: opts.hidden },
    });
  });
}

// --- Shortlist -----------------------------------------------------------------------

export type ShortlistPlan = {
  roundId: string;
  size: number;
  cut: ShortlistCut;
  coverage: ReturnType<typeof shortlistCoverage>;
};

/** The computed shortlist for a closed team round, with any tie the admin must settle. */
export async function shortlistPlan(db: Db, roundId: string): Promise<ShortlistPlan | null> {
  const [round] = await db.select().from(selectionRound).where(eq(selectionRound.id, roundId));
  const results = round ? await roundResults(db, roundId) : null;
  if (!round || !results) return null;
  const cut = cutShortlist(results.standings, round.shortlistSize);
  const ids = [...cut.included, ...(cut.needsDecision?.candidates ?? [])].map((s) => s.designId);
  const methods = ids.length
    ? await db
        .select({ id: design.id, printMethod: design.printMethod })
        .from(design)
        .where(inArray(design.id, ids))
    : [];
  const byId = new Map(methods.map((m) => [m.id, m.printMethod]));
  const coverage = shortlistCoverage(
    cut.included.map((s) => {
      const pm = byId.get(s.designId) ?? null;
      return { designId: s.designId, printMethod: isPrintMethod(pm) ? pm : null };
    }),
  );
  return { roundId, size: round.shortlistSize, cut, coverage };
}

/**
 * Confirms the shortlist and creates the public round (swipe mode, one entry per design,
 * showing its first colourway). A tie at the cut needs the admin's explicit choice
 * (tie-break 3), recorded on the shortlist rows and in the audit log.
 */
export async function confirmShortlist(
  db: Db,
  opts: { roundId: string; tieChoice: string[]; note: string | null; actorId: string; now: Date },
): Promise<{ publicRoundId: string }> {
  const plan = await shortlistPlan(db, opts.roundId);
  if (!plan) throw new StageError("round_not_closed");
  const { cut } = plan;

  let chosen: typeof cut.included = [];
  if (cut.needsDecision) {
    const { candidates, seatsLeft } = cut.needsDecision;
    const valid = new Set(candidates.map((c) => c.designId));
    const picks = [...new Set(opts.tieChoice)];
    if (picks.length !== seatsLeft || !picks.every((id) => valid.has(id)) || !opts.note?.trim()) {
      throw new StageError("tie_decision_required");
    }
    chosen = candidates.filter((c) => picks.includes(c.designId));
  }
  const final = [...cut.included, ...chosen];

  return db.transaction(async (tx) => {
    const [round] = await tx
      .select()
      .from(selectionRound)
      .where(eq(selectionRound.id, opts.roundId))
      .for("update");
    if (!round || round.status !== "closed") throw new StageError("already_confirmed");

    await tx.insert(shortlist).values(
      final.map((s, i) => ({
        roundId: round.id,
        designId: s.designId,
        points: s.points,
        pickedBy: s.pickedBy,
        firstPlaces: s.firstPlaces,
        position: i + 1,
        tieBreakNote: chosen.some((c) => c.designId === s.designId) ? opts.note : null,
      })),
    );
    const [pr] = await tx
      .insert(publicRound)
      .values({ selectionRoundId: round.id, title: "Public vote", mode: "swipe", status: "draft" })
      .returning({ id: publicRound.id });

    const firstColourways = await tx
      .select({ designId: colourway.designId, id: colourway.id, sortOrder: colourway.sortOrder })
      .from(colourway)
      .where(
        inArray(
          colourway.designId,
          final.map((s) => s.designId),
        ),
      )
      .orderBy(asc(colourway.sortOrder));
    const firstOf = new Map<string, string>();
    for (const c of firstColourways) if (!firstOf.has(c.designId)) firstOf.set(c.designId, c.id);
    await tx.insert(publicEntry).values(
      final.map((s) => ({
        publicRoundId: pr!.id,
        designId: s.designId,
        colourwayId: firstOf.get(s.designId) ?? null,
      })),
    );
    await tx
      .update(selectionRound)
      .set({ status: "published" })
      .where(eq(selectionRound.id, round.id));
    await audit(tx, opts.actorId, "shortlist.confirmed", {
      roundId: round.id,
      publicRoundId: pr!.id,
      size: final.length,
      tieBreak: cut.needsDecision
        ? {
            candidates: cut.needsDecision.candidates.map((c) => c.designId),
            chosen: chosen.map((c) => c.designId),
            note: opts.note,
          }
        : null,
    });
    return { publicRoundId: pr!.id };
  });
}

// --- Public round --------------------------------------------------------------------

export async function currentPublicRound(db: Db) {
  const [round] = await db.select().from(publicRound).orderBy(desc(publicRound.createdAt)).limit(1);
  return round ?? null;
}

const NEXT: Record<string, string> = { draft: "open", open: "closed", closed: "published" };

/** draft → open → closed → published, one step at a time. */
export async function advancePublicRound(
  db: Db,
  opts: { publicRoundId: string; to: "open" | "closed" | "published"; actorId: string; now: Date },
) {
  await db.transaction(async (tx) => {
    const [round] = await tx
      .select()
      .from(publicRound)
      .where(eq(publicRound.id, opts.publicRoundId))
      .for("update");
    if (!round) throw new StageError("no_public_round");
    if (NEXT[round.status] !== opts.to) throw new StageError("bad_transition");
    const stamp =
      opts.to === "open"
        ? { opensAt: opts.now }
        : opts.to === "closed"
          ? { closesAt: opts.now }
          : { publishedAt: opts.now };
    await tx
      .update(publicRound)
      .set({ status: opts.to, ...stamp })
      .where(eq(publicRound.id, round.id));
    await audit(tx, opts.actorId, `public_round.${opts.to}`, { publicRoundId: round.id });
  });
}

export async function setLiveResults(
  db: Db,
  opts: { publicRoundId: string; on: boolean; actorId: string },
) {
  await db
    .update(publicRound)
    .set({ showLiveResults: opts.on })
    .where(eq(publicRound.id, opts.publicRoundId));
  await audit(db, opts.actorId, "public_round.live_results", {
    publicRoundId: opts.publicRoundId,
    on: opts.on,
  });
}

export type PublicEntryCard = {
  entryId: string;
  designId: string;
  slug: string;
  title: string;
  line: Line;
  tags: string[];
  printMethod: string | null;
  colourwayName: string;
  imageUrl: string;
  thumbUrl: string;
  blurDataUrl: string | null;
};

export async function publicEntries(db: Db, publicRoundId: string): Promise<PublicEntryCard[]> {
  return db
    .select({
      entryId: publicEntry.id,
      designId: design.id,
      slug: design.slug,
      title: design.title,
      line: design.line,
      tags: design.tags,
      printMethod: design.printMethod,
      colourwayName: colourway.name,
      imageUrl: colourway.imageUrl,
      thumbUrl: colourway.thumbUrl,
      blurDataUrl: colourway.blurDataUrl,
    })
    .from(publicEntry)
    .innerJoin(design, eq(design.id, publicEntry.designId))
    .innerJoin(colourway, eq(colourway.id, publicEntry.colourwayId))
    .where(eq(publicEntry.publicRoundId, publicRoundId))
    .orderBy(asc(design.slug));
}

export type PublicResults = {
  ranked: (RankedEntry & { card: PublicEntryCard })[];
  devices: number;
  byRef: { ref: string; devices: number }[];
  byAge: { ageBracket: string; devices: number }[];
};

/** Results for one public round: ranking, and how many devices each channel brought. */
export async function publicResults(db: Db, publicRoundId: string): Promise<PublicResults> {
  const cards = await publicEntries(db, publicRoundId);
  const tallies = await db
    .select({
      entryId: swipe.entryId,
      likes: sql<number>`count(*) filter (where ${swipe.liked})::int`,
      passes: sql<number>`count(*) filter (where not ${swipe.liked})::int`,
    })
    .from(swipe)
    .where(eq(swipe.publicRoundId, publicRoundId))
    .groupBy(swipe.entryId);
  const ones = await db
    .select({ entryId: vote.entryId, n: sql<number>`count(*)::int` })
    .from(vote)
    .where(eq(vote.publicRoundId, publicRoundId))
    .groupBy(vote.entryId);
  const t = new Map(tallies.map((x) => [x.entryId, x]));
  const o = new Map(ones.map((x) => [x.entryId, x.n]));
  const ranked = rankSwipes(
    cards.map((c) => ({
      entryId: c.entryId,
      likes: t.get(c.entryId)?.likes ?? 0,
      passes: t.get(c.entryId)?.passes ?? 0,
      numberOne: o.get(c.entryId) ?? 0,
    })),
  );
  const byCard = new Map(cards.map((c) => [c.entryId, c]));

  const [devices] = await db
    .select({ n: sql<number>`count(distinct ${swipe.deviceHash})::int` })
    .from(swipe)
    .where(eq(swipe.publicRoundId, publicRoundId));
  const byRef = await db
    .select({
      ref: sql<string>`coalesce(${swipe.ref}, 'direct')`,
      devices: sql<number>`count(distinct ${swipe.deviceHash})::int`,
    })
    .from(swipe)
    .where(eq(swipe.publicRoundId, publicRoundId))
    .groupBy(sql`1`)
    .orderBy(sql`2 desc`);
  const byAge = await db
    .select({
      ageBracket: sql<string>`coalesce(${swipe.ageBracket}, 'not given')`,
      devices: sql<number>`count(distinct ${swipe.deviceHash})::int`,
    })
    .from(swipe)
    .where(eq(swipe.publicRoundId, publicRoundId))
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  return {
    ranked: ranked.map((r) => ({ ...r, card: byCard.get(r.entryId)! })),
    devices: devices?.n ?? 0,
    byRef,
    byAge,
  };
}

// --- Final ten -----------------------------------------------------------------------

export type FinalCandidateRow = PublicEntryCard & {
  teamPoints: number;
  teamPosition: number;
  publicPosition: number | null;
  likeRate: number;
  swipes: number;
  numberOne: number;
  slot: "sublimation" | "other" | null;
};

/** Every shortlisted design with team and public results side by side (§0.1.3). */
export async function finalCandidates(db: Db, publicRoundId: string): Promise<FinalCandidateRow[]> {
  const [pr] = await db.select().from(publicRound).where(eq(publicRound.id, publicRoundId));
  if (!pr?.selectionRoundId) return [];
  const team = await db.select().from(shortlist).where(eq(shortlist.roundId, pr.selectionRoundId));
  const teamBy = new Map(team.map((s) => [s.designId, s]));
  const results = await publicResults(db, publicRoundId);
  return results.ranked.map((r) => {
    const s = teamBy.get(r.card.designId);
    const pm = r.card.printMethod;
    return {
      ...r.card,
      teamPoints: s?.points ?? 0,
      teamPosition: s?.position ?? 0,
      publicPosition: r.swipes ? r.position : null,
      likeRate: r.likeRate,
      swipes: r.swipes,
      numberOne: r.numberOne,
      slot: isPrintMethod(pm) ? slotFor(pm) : null,
    };
  });
}

/** Saves the final ten: exactly 5 sublimation + 5 other, every one with a print method. */
export async function saveFinalTen(
  db: Db,
  opts: { publicRoundId: string; designIds: string[]; actorId: string; now: Date },
) {
  const rows = opts.designIds.length
    ? await db
        .select({ id: design.id, printMethod: design.printMethod })
        .from(design)
        .where(inArray(design.id, opts.designIds))
    : [];
  const pm = new Map(rows.map((r) => [r.id, r.printMethod]));
  const candidates = opts.designIds.map((id) => {
    const m = pm.get(id) ?? null;
    return { designId: id, printMethod: isPrintMethod(m) ? m : null };
  });
  const problems = validateFinalTen(candidates);
  if (problems.length) throw new StageError("invalid_final_ten", problems);

  await db.transaction(async (tx) => {
    await tx.delete(finalSelection).where(eq(finalSelection.publicRoundId, opts.publicRoundId));
    await tx.insert(finalSelection).values(
      candidates.map((c, i) => ({
        publicRoundId: opts.publicRoundId,
        designId: c.designId,
        slot: slotFor(c.printMethod!),
        printMethod: c.printMethod!,
        position: i + 1,
        decidedBy: opts.actorId,
      })),
    );
    await audit(tx, opts.actorId, "final_ten.saved", {
      publicRoundId: opts.publicRoundId,
      designIds: opts.designIds,
    });
  });
}

/** The production hand-off: the final ten with every print-master path recorded at ingest. */
export async function productionHandoff(db: Db, publicRoundId: string) {
  const chosen = await db
    .select({
      position: finalSelection.position,
      slot: finalSelection.slot,
      printMethod: finalSelection.printMethod,
      designId: design.id,
      title: design.title,
      slug: design.slug,
      designFiles: design.printFiles,
    })
    .from(finalSelection)
    .innerJoin(design, eq(design.id, finalSelection.designId))
    .where(eq(finalSelection.publicRoundId, publicRoundId))
    .orderBy(asc(finalSelection.position));
  if (!chosen.length) return [];
  const cws = await db
    .select({ designId: colourway.designId, name: colourway.name, files: colourway.printFiles })
    .from(colourway)
    .where(
      and(
        inArray(
          colourway.designId,
          chosen.map((c) => c.designId),
        ),
      ),
    )
    .orderBy(asc(colourway.sortOrder));
  return chosen.map((c) => ({
    ...c,
    colourways: cws.filter((x) => x.designId === c.designId),
  }));
}

export { PRINT_METHODS };

/** Every design, hidden ones too, with its first thumbnail: the admin's design list. */
export async function adminDesignList(db: Db) {
  const rows = await db
    .select({
      id: design.id,
      slug: design.slug,
      title: design.title,
      line: design.line,
      tags: design.tags,
      printMethod: design.printMethod,
      hidden: design.hidden,
      thumbUrl: sql<string | null>`(select c.thumb_url from "colourway" c
        where c.design_id = "design"."id" order by c.sort_order limit 1)`,
    })
    .from(design)
    .orderBy(asc(design.slug));
  return rows;
}
