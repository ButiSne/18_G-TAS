// Stage 1, the team round (CLAUDE.md §0.1, §2; HANDOVER §7 steps 6–7): opening a round,
// saving and submitting picks, auto-close, unlock, and results that stay hidden until the
// round is closed. Plain functions taking `db`, tested against Postgres.

import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { createDb } from "../db/client.ts";
import { design, member, memberPick, roundMember, selectionRound } from "../db/schema.ts";
import { audit } from "./audit.ts";
import { picksPerMemberSchema, validatePicks, type PicksProblem } from "./picks.ts";
import { computeStandings, type MemberPicks, type Standing } from "./scoring.ts";

type Db = ReturnType<typeof createDb>;
export type RoundStatus = "draft" | "open" | "closed" | "published";

export type RoundErrorCode =
  | "no_round"
  | "not_open"
  | "not_draft"
  | "not_in_round"
  | "already_submitted"
  | "invalid_picks"
  | "unknown_design"
  | "bad_settings";

// Explicit fields, not parameter properties: plain Node (scripts) strips types only.
export class RoundError extends Error {
  code: RoundErrorCode;
  problems: PicksProblem[];
  constructor(code: RoundErrorCode, problems: PicksProblem[] = []) {
    super(code);
    this.code = code;
    this.problems = problems;
  }
}

/** The round the team works on: the most recently created one. */
export async function currentRound(db: Db) {
  const [round] = await db
    .select()
    .from(selectionRound)
    .orderBy(desc(selectionRound.createdAt))
    .limit(1);
  return round ?? null;
}

/** Progress counts only: who has submitted stays private to the admin. */
export async function roundProgress(db: Db, roundId: string) {
  const [row] = await db
    .select({
      invited: sql<number>`count(*)::int`,
      submitted: sql<number>`count(${roundMember.submittedAt})::int`,
    })
    .from(roundMember)
    .where(eq(roundMember.roundId, roundId));
  return row ?? { invited: 0, submitted: 0 };
}

export async function myRoundState(db: Db, roundId: string, memberId: string) {
  const [membership] = await db
    .select({ submittedAt: roundMember.submittedAt })
    .from(roundMember)
    .where(and(eq(roundMember.roundId, roundId), eq(roundMember.memberId, memberId)));
  const picks = await db
    .select({ designId: memberPick.designId, rank: memberPick.rank })
    .from(memberPick)
    .where(and(eq(memberPick.roundId, roundId), eq(memberPick.memberId, memberId)))
    .orderBy(asc(memberPick.rank));
  return {
    inRound: Boolean(membership),
    submittedAt: membership?.submittedAt ?? null,
    designIds: picks.map((p) => p.designId),
  };
}

// --- Admin: open, close, unlock ---------------------------------------------------

export async function openRound(
  db: Db,
  opts: {
    roundId: string;
    memberIds: string[];
    picksPerMember: number;
    shortlistSize: number;
    actorId: string;
    now: Date;
  },
) {
  const picks = picksPerMemberSchema.safeParse(opts.picksPerMember);
  const sizeOk =
    Number.isInteger(opts.shortlistSize) && opts.shortlistSize >= 10 && opts.shortlistSize <= 40;
  if (!picks.success || !sizeOk || opts.memberIds.length === 0)
    throw new RoundError("bad_settings");
  await db.transaction(async (tx) => {
    const [round] = await tx
      .select()
      .from(selectionRound)
      .where(eq(selectionRound.id, opts.roundId))
      .for("update");
    if (!round) throw new RoundError("no_round");
    if (round.status !== "draft") throw new RoundError("not_draft");
    await tx
      .update(selectionRound)
      .set({
        status: "open",
        picksPerMember: picks.data,
        shortlistSize: opts.shortlistSize,
        opensAt: opts.now,
      })
      .where(eq(selectionRound.id, round.id));
    await tx.delete(roundMember).where(eq(roundMember.roundId, round.id));
    await tx
      .insert(roundMember)
      .values(opts.memberIds.map((memberId) => ({ roundId: round.id, memberId })));
    await audit(tx, opts.actorId, "round.opened", {
      roundId: round.id,
      memberIds: opts.memberIds,
      picksPerMember: picks.data,
      shortlistSize: opts.shortlistSize,
    });
  });
}

export async function closeRound(db: Db, opts: { roundId: string; actorId: string; now: Date }) {
  await db.transaction(async (tx) => {
    const [round] = await tx
      .select()
      .from(selectionRound)
      .where(eq(selectionRound.id, opts.roundId))
      .for("update");
    if (!round) throw new RoundError("no_round");
    if (round.status !== "open") throw new RoundError("not_open");
    await tx
      .update(selectionRound)
      .set({ status: "closed", closesAt: opts.now })
      .where(eq(selectionRound.id, round.id));
    await audit(tx, opts.actorId, "round.closed", { roundId: round.id, by: "admin" });
  });
}

/** Lets a member change their submitted picks again, while the round is still open. */
export async function unlockMember(
  db: Db,
  opts: { roundId: string; memberId: string; actorId: string },
) {
  await db.transaction(async (tx) => {
    const [round] = await tx
      .select()
      .from(selectionRound)
      .where(eq(selectionRound.id, opts.roundId))
      .for("update");
    if (!round) throw new RoundError("no_round");
    if (round.status !== "open") throw new RoundError("not_open");
    await tx
      .update(roundMember)
      .set({ submittedAt: null })
      .where(and(eq(roundMember.roundId, round.id), eq(roundMember.memberId, opts.memberId)));
    await audit(tx, opts.actorId, "member.unlocked", {
      roundId: round.id,
      memberId: opts.memberId,
    });
  });
}

export async function adminRoundOverview(db: Db, roundId: string) {
  return db
    .select({
      memberId: member.id,
      name: member.name,
      submittedAt: roundMember.submittedAt,
      picks: sql<number>`(select count(*)::int from "member_pick" p
        where p.round_id = ${roundId} and p.member_id = "member"."id")`,
    })
    .from(roundMember)
    .innerJoin(member, eq(member.id, roundMember.memberId))
    .where(eq(roundMember.roundId, roundId))
    .orderBy(asc(member.name));
}

// --- Members: save and submit picks ------------------------------------------------

/** Locks the round row so concurrent saves and submits are serialised. */
async function lockOpenRound(tx: Parameters<Parameters<Db["transaction"]>[0]>[0], roundId: string) {
  const [round] = await tx
    .select()
    .from(selectionRound)
    .where(eq(selectionRound.id, roundId))
    .for("update");
  if (!round) throw new RoundError("no_round");
  if (round.status !== "open") throw new RoundError("not_open");
  return round;
}

async function lockMembership(
  tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
  roundId: string,
  memberId: string,
) {
  const [membership] = await tx
    .select()
    .from(roundMember)
    .where(and(eq(roundMember.roundId, roundId), eq(roundMember.memberId, memberId)))
    .for("update");
  if (!membership) throw new RoundError("not_in_round");
  if (membership.submittedAt) throw new RoundError("already_submitted");
  return membership;
}

/** Saves a draft: the ordered design ids are ranks 1…k (k ≤ picks per member). */
export async function savePicks(
  db: Db,
  opts: { roundId: string; memberId: string; designIds: string[]; now: Date },
) {
  await db.transaction(async (tx) => {
    const round = await lockOpenRound(tx, opts.roundId);
    await lockMembership(tx, round.id, opts.memberId);
    const picks = opts.designIds.map((designId, i) => ({ designId, rank: i + 1 }));
    const problems = validatePicks(picks, round.picksPerMember, false);
    if (problems.length) throw new RoundError("invalid_picks", problems);
    if (picks.length) {
      const found = await tx
        .select({ id: design.id })
        .from(design)
        .where(and(inArray(design.id, opts.designIds), eq(design.hidden, false)));
      if (found.length !== picks.length) throw new RoundError("unknown_design");
    }
    await tx
      .delete(memberPick)
      .where(and(eq(memberPick.roundId, round.id), eq(memberPick.memberId, opts.memberId)));
    if (picks.length) {
      await tx.insert(memberPick).values(
        picks.map((p) => ({
          roundId: round.id,
          memberId: opts.memberId,
          designId: p.designId,
          rank: p.rank,
          updatedAt: opts.now,
        })),
      );
    }
  });
}

/**
 * Submits and locks a member's picks. When this is the last member to submit, the round
 * closes in the same transaction (HANDOVER §7.6), so it can never be left open by a race.
 */
export async function submitPicks(
  db: Db,
  opts: { roundId: string; memberId: string; now: Date },
): Promise<{ roundClosed: boolean }> {
  return db.transaction(async (tx) => {
    const round = await lockOpenRound(tx, opts.roundId);
    await lockMembership(tx, round.id, opts.memberId);
    const picks = await tx
      .select({ designId: memberPick.designId, rank: memberPick.rank })
      .from(memberPick)
      .where(and(eq(memberPick.roundId, round.id), eq(memberPick.memberId, opts.memberId)));
    const problems = validatePicks(picks, round.picksPerMember, true);
    if (problems.length) throw new RoundError("invalid_picks", problems);

    await tx
      .update(roundMember)
      .set({ submittedAt: opts.now })
      .where(and(eq(roundMember.roundId, round.id), eq(roundMember.memberId, opts.memberId)));
    await audit(tx, opts.memberId, "picks.submitted", { roundId: round.id });

    const [waiting] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(roundMember)
      .where(and(eq(roundMember.roundId, round.id), isNull(roundMember.submittedAt)));
    if ((waiting?.n ?? 0) > 0) return { roundClosed: false };

    await tx
      .update(selectionRound)
      .set({ status: "closed", closesAt: opts.now })
      .where(eq(selectionRound.id, round.id));
    await audit(tx, null, "round.closed", { roundId: round.id, by: "auto: everyone submitted" });
    return { roundClosed: true };
  });
}

// --- Results: only once the round is closed ----------------------------------------

export type RoundResults = {
  standings: Standing[];
  /** Who picked what, in rank order. Present only after the round closes. */
  byMember: { memberId: string; name: string; designIds: string[] }[];
};

/**
 * Standings and picks for a closed or published round. Returns null while the round is
 * draft or open: the hiding is enforced here, in the query, not only in the UI (§7.7).
 */
export async function roundResults(db: Db, roundId: string): Promise<RoundResults | null> {
  const [round] = await db.select().from(selectionRound).where(eq(selectionRound.id, roundId));
  if (!round || (round.status !== "closed" && round.status !== "published")) return null;
  // Only submitted picks count: a member who never submitted has no say.
  const rows = await db
    .select({
      memberId: memberPick.memberId,
      name: member.name,
      designId: memberPick.designId,
      rank: memberPick.rank,
    })
    .from(memberPick)
    .innerJoin(member, eq(member.id, memberPick.memberId))
    .innerJoin(
      roundMember,
      and(
        eq(roundMember.roundId, memberPick.roundId),
        eq(roundMember.memberId, memberPick.memberId),
      ),
    )
    .where(and(eq(memberPick.roundId, roundId), isNotNull(roundMember.submittedAt)))
    .orderBy(asc(member.name), asc(memberPick.rank));

  const grouped = new Map<string, { name: string; picks: { designId: string; rank: number }[] }>();
  for (const r of rows) {
    const g = grouped.get(r.memberId) ?? { name: r.name, picks: [] };
    g.picks.push({ designId: r.designId, rank: r.rank });
    grouped.set(r.memberId, g);
  }
  const all: MemberPicks[] = [...grouped].map(([memberId, g]) => ({ memberId, picks: g.picks }));
  return {
    standings: computeStandings(all, round.picksPerMember),
    byMember: [...grouped].map(([memberId, g]) => ({
      memberId,
      name: g.name,
      designIds: g.picks.map((p) => p.designId),
    })),
  };
}
