// Stage 1, the team round (CLAUDE.md §0.1, §2; HANDOVER §7 steps 6–7): opening a round,
// saving and submitting picks, auto-close, unlock, and results that stay hidden until the
// round is closed. Plain functions taking `db`, tested against Postgres.

import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { createDb } from "../db/client.ts";
import {
  colourway,
  design,
  member,
  memberPick,
  publicEntry,
  publicRound,
  roundMember,
  selectionRound,
  shortlist,
  swipe,
} from "../db/schema.ts";
import { audit } from "./audit.ts";
import { picksPerMemberSchema, UNLIMITED, validatePicks, type PicksProblem } from "./picks.ts";
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
  | "not_picked"
  | "not_admin"
  | "not_closed"
  | "vote_started"
  | "too_long"
  | "bad_settings";

export type NoteKind = "comment" | "suggestion";
export type PickNote = { note: string; kind: NoteKind };
export const NOTE_MAX = 280;
export const SUGGESTION_MAX = 500;

/** Trims; empty means "no note". Throws when too long (the database checks it too). */
function cleanText(text: string, max: number): string | null {
  const t = text.replace(/\r\n/g, "\n").trim();
  if (!t) return null;
  if ([...t].length > max) throw new RoundError("too_long");
  return t;
}

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
    .select({
      submittedAt: roundMember.submittedAt,
      suggestion: roundMember.suggestion,
      role: roundMember.role,
    })
    .from(roundMember)
    .where(and(eq(roundMember.roundId, roundId), eq(roundMember.memberId, memberId)));
  const picks = await db
    .select({
      designId: memberPick.designId,
      rank: memberPick.rank,
      note: memberPick.note,
      noteKind: memberPick.noteKind,
    })
    .from(memberPick)
    .where(and(eq(memberPick.roundId, roundId), eq(memberPick.memberId, memberId)))
    .orderBy(asc(memberPick.rank));
  const notes: Record<string, PickNote> = {};
  for (const p of picks)
    if (p.note && p.noteKind) notes[p.designId] = { note: p.note, kind: p.noteKind };
  return {
    inRound: Boolean(membership),
    /** "curator": the admin, ticking any number of designs for the public vote. */
    role: membership?.role ?? null,
    submittedAt: membership?.submittedAt ?? null,
    designIds: picks.map((p) => p.designId),
    notes,
    suggestion: membership?.suggestion ?? null,
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
    // An admin chosen to pick does so as curator (any number, no points, straight into the
    // public vote), and the round waits for them too. Everyone else ranks for points.
    const admins = new Set(
      (await tx.select({ id: member.id }).from(member).where(eq(member.role, "admin"))).map(
        (a) => a.id,
      ),
    );
    if (opts.memberIds.every((id) => admins.has(id))) throw new RoundError("bad_settings");
    await tx.insert(roundMember).values(
      opts.memberIds.map((memberId) => ({
        roundId: round.id,
        memberId,
        role: admins.has(memberId) ? ("curator" as const) : ("picker" as const),
      })),
    );
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

/**
 * Lets an admin add their picks to a round the team has already finished: the admin joins
 * as curator and the round opens again for them alone. Every member's submitted picks stay
 * exactly as they are, locked. When the admin submits, the round closes again by itself.
 * Not possible once the shortlist is confirmed (the public vote is built from it).
 */
export async function reopenForAdmin(
  db: Db,
  opts: { roundId: string; adminId: string; now: Date },
) {
  await db.transaction(async (tx) => {
    const [round] = await tx
      .select()
      .from(selectionRound)
      .where(eq(selectionRound.id, opts.roundId))
      .for("update");
    if (!round) throw new RoundError("no_round");
    const [admin] = await tx.select().from(member).where(eq(member.id, opts.adminId));
    if (admin?.role !== "admin") throw new RoundError("not_admin");
    const [membership] = await tx
      .select()
      .from(roundMember)
      .where(and(eq(roundMember.roundId, round.id), eq(roundMember.memberId, opts.adminId)))
      .for("update");
    if (round.status === "open") {
      if (!membership)
        await tx
          .insert(roundMember)
          .values({ roundId: round.id, memberId: opts.adminId, role: "curator" });
      return;
    }
    if (round.status === "published") {
      // The shortlist is confirmed; the admin may still add picks while the public vote is
      // a draft. They go straight into it when the admin submits (addAdminPicksToVote).
      if (!(await draftPublicRound(tx, round.id))) throw new RoundError("vote_started");
      if (membership?.submittedAt) throw new RoundError("already_submitted");
      if (!membership)
        await tx
          .insert(roundMember)
          .values({ roundId: round.id, memberId: opts.adminId, role: "curator" });
      else if (membership.role !== "curator")
        await tx
          .update(roundMember)
          .set({ role: "curator" })
          .where(eq(roundMember.id, membership.id));
      await audit(tx, opts.adminId, "round.admin_picks_window", { roundId: round.id });
      return;
    }
    if (round.status !== "closed") throw new RoundError("not_closed");
    if (membership) {
      await tx
        .update(roundMember)
        .set({ role: "curator", submittedAt: null })
        .where(eq(roundMember.id, membership.id));
    } else {
      await tx
        .insert(roundMember)
        .values({ roundId: round.id, memberId: opts.adminId, role: "curator" });
    }
    await tx
      .update(selectionRound)
      .set({ status: "open", closesAt: null })
      .where(eq(selectionRound.id, round.id));
    await audit(tx, opts.adminId, "round.reopened_for_admin", {
      roundId: round.id,
      at: opts.now.toISOString(),
      note: "Members' submitted picks unchanged; closes again when the admin submits.",
    });
  });
}

export async function adminRoundOverview(db: Db, roundId: string) {
  return db
    .select({
      memberId: member.id,
      name: member.name,
      submittedAt: roundMember.submittedAt,
      role: roundMember.role,
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
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** The public round built from this team round, if it is still a draft with no swipes. */
async function draftPublicRound(tx: Tx | Db, roundId: string) {
  const [pr] = await tx
    .select({ id: publicRound.id, status: publicRound.status })
    .from(publicRound)
    .where(eq(publicRound.selectionRoundId, roundId));
  if (!pr || pr.status !== "draft") return null;
  const [anySwipe] = await tx
    .select({ id: swipe.id })
    .from(swipe)
    .where(eq(swipe.publicRoundId, pr.id))
    .limit(1);
  return anySwipe ? null : pr;
}

/**
 * True when the admin may still add picks to a confirmed shortlist: the public vote built
 * from it hasn't started.
 */
export async function adminPicksWindowOpen(db: Db, roundId: string) {
  return Boolean(await draftPublicRound(db, roundId));
}

/**
 * The round a member may pick in: an open round, or, for the admin (curator) only, a
 * confirmed shortlist whose public vote is still a draft.
 */
async function lockPickableRound(tx: Tx, roundId: string, memberId: string) {
  const [round] = await tx
    .select()
    .from(selectionRound)
    .where(eq(selectionRound.id, roundId))
    .for("update");
  if (!round) throw new RoundError("no_round");
  if (round.status === "open") return round;
  if (round.status === "published") {
    const [m] = await tx
      .select({ role: roundMember.role })
      .from(roundMember)
      .where(and(eq(roundMember.roundId, round.id), eq(roundMember.memberId, memberId)));
    if (m?.role === "curator" && (await draftPublicRound(tx, round.id))) return round;
  }
  throw new RoundError("not_open");
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

/**
 * Saves a draft: the ordered design ids are ranks 1…k (k ≤ picks per member). Notes stay
 * with their design through a reorder; removing a design removes its note.
 */
export async function savePicks(
  db: Db,
  opts: { roundId: string; memberId: string; designIds: string[]; now: Date },
) {
  await db.transaction(async (tx) => {
    const round = await lockPickableRound(tx, opts.roundId, opts.memberId);
    const membership = await lockMembership(tx, round.id, opts.memberId);
    const picks = opts.designIds.map((designId, i) => ({ designId, rank: i + 1 }));
    const limit = membership.role === "curator" ? UNLIMITED : round.picksPerMember;
    const problems = validatePicks(picks, limit, false);
    if (problems.length) throw new RoundError("invalid_picks", problems);
    if (picks.length) {
      const found = await tx
        .select({ id: design.id })
        .from(design)
        .where(and(inArray(design.id, opts.designIds), eq(design.hidden, false)));
      if (found.length !== picks.length) throw new RoundError("unknown_design");
    }
    const mine = and(eq(memberPick.roundId, round.id), eq(memberPick.memberId, opts.memberId));
    const kept = new Map(
      (
        await tx
          .select({
            designId: memberPick.designId,
            note: memberPick.note,
            noteKind: memberPick.noteKind,
          })
          .from(memberPick)
          .where(mine)
      ).map((p) => [p.designId, p]),
    );
    await tx.delete(memberPick).where(mine);
    if (picks.length) {
      await tx.insert(memberPick).values(
        picks.map((p) => ({
          roundId: round.id,
          memberId: opts.memberId,
          designId: p.designId,
          rank: p.rank,
          note: kept.get(p.designId)?.note ?? null,
          noteKind: kept.get(p.designId)?.noteKind ?? null,
          updatedAt: opts.now,
        })),
      );
    }
  });
}

/**
 * A comment or suggestion on one of the member's own picks (CLAUDE.md: notes only where
 * they ticked). An empty note deletes it. Editable until the member submits.
 */
export async function savePickNote(
  db: Db,
  opts: {
    roundId: string;
    memberId: string;
    designId: string;
    note: string;
    kind: NoteKind;
    now: Date;
  },
) {
  const note = cleanText(opts.note, NOTE_MAX);
  await db.transaction(async (tx) => {
    const round = await lockPickableRound(tx, opts.roundId, opts.memberId);
    await lockMembership(tx, round.id, opts.memberId);
    const updated = await tx
      .update(memberPick)
      .set({ note, noteKind: note ? opts.kind : null, updatedAt: opts.now })
      .where(
        and(
          eq(memberPick.roundId, round.id),
          eq(memberPick.memberId, opts.memberId),
          eq(memberPick.designId, opts.designId),
        ),
      )
      .returning({ id: memberPick.id });
    if (updated.length === 0) throw new RoundError("not_picked");
  });
}

/** One free suggestion per member per round, not tied to a design. Empty clears it. */
export async function saveSuggestion(
  db: Db,
  opts: { roundId: string; memberId: string; text: string },
) {
  const suggestion = cleanText(opts.text, SUGGESTION_MAX);
  await db.transaction(async (tx) => {
    const round = await lockPickableRound(tx, opts.roundId, opts.memberId);
    await lockMembership(tx, round.id, opts.memberId);
    await tx
      .update(roundMember)
      .set({ suggestion })
      .where(and(eq(roundMember.roundId, round.id), eq(roundMember.memberId, opts.memberId)));
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
    const round = await lockPickableRound(tx, opts.roundId, opts.memberId);
    const membership = await lockMembership(tx, round.id, opts.memberId);
    const picks = await tx
      .select({ designId: memberPick.designId, rank: memberPick.rank })
      .from(memberPick)
      .where(and(eq(memberPick.roundId, round.id), eq(memberPick.memberId, opts.memberId)))
      .orderBy(asc(memberPick.rank));
    const limit = membership.role === "curator" ? UNLIMITED : round.picksPerMember;
    const problems = validatePicks(picks, limit, true);
    if (problems.length) throw new RoundError("invalid_picks", problems);

    await tx
      .update(roundMember)
      .set({ submittedAt: opts.now })
      .where(and(eq(roundMember.roundId, round.id), eq(roundMember.memberId, opts.memberId)));
    await audit(tx, opts.memberId, "picks.submitted", { roundId: round.id });
    if (round.status === "published") {
      await addAdminPicksToVote(
        tx,
        round,
        picks.map((p) => p.designId),
        opts.memberId,
      );
      return { roundClosed: false };
    }

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
  /** Borda points from the team's pickers only. */
  standings: Standing[];
  /** The admin's picks: no points, but every one goes into the public vote. */
  adminPicks: string[];
  /** Who picked what, in rank order, with their notes. Present only after the round closes. */
  byMember: {
    memberId: string;
    name: string;
    designIds: string[];
    notes: Record<string, PickNote>;
    suggestion: string | null;
    role: "picker" | "curator";
  }[];
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
      note: memberPick.note,
      noteKind: memberPick.noteKind,
      suggestion: roundMember.suggestion,
      role: roundMember.role,
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

  type Group = {
    name: string;
    role: "picker" | "curator";
    suggestion: string | null;
    picks: { designId: string; rank: number }[];
    notes: Record<string, PickNote>;
  };
  const grouped = new Map<string, Group>();
  for (const r of rows) {
    const g = grouped.get(r.memberId) ?? {
      name: r.name,
      role: r.role,
      suggestion: r.suggestion,
      picks: [],
      notes: {},
    };
    g.picks.push({ designId: r.designId, rank: r.rank });
    if (r.note && r.noteKind) g.notes[r.designId] = { note: r.note, kind: r.noteKind };
    grouped.set(r.memberId, g);
  }
  const all: MemberPicks[] = [...grouped]
    .filter(([, g]) => g.role === "picker")
    .map(([memberId, g]) => ({ memberId, picks: g.picks }));
  const adminPicks = [
    ...new Set(
      [...grouped.values()]
        .filter((g) => g.role === "curator")
        .flatMap((g) => g.picks.map((p) => p.designId)),
    ),
  ];
  return {
    standings: computeStandings(all, round.picksPerMember),
    adminPicks,
    byMember: [...grouped].map(([memberId, g]) => ({
      memberId,
      name: g.name,
      designIds: g.picks.map((p) => p.designId),
      notes: g.notes,
      suggestion: g.suggestion,
      role: g.role,
    })),
  };
}

/**
 * The admin's picks after the shortlist was confirmed: each joins the public vote (still a
 * draft) as a guaranteed place, marked admin's choice, with whatever team points it has.
 * Picks already on the shortlist are only marked.
 */
async function addAdminPicksToVote(
  tx: Tx,
  round: typeof selectionRound.$inferSelect,
  designIds: string[],
  actorId: string,
) {
  const pr = await draftPublicRound(tx, round.id);
  if (!pr) throw new RoundError("vote_started");
  const listed = await tx
    .select({ designId: shortlist.designId, position: shortlist.position })
    .from(shortlist)
    .where(eq(shortlist.roundId, round.id));
  const onList = new Set(listed.map((l) => l.designId));
  const entries = new Set(
    (
      await tx
        .select({ designId: publicEntry.designId })
        .from(publicEntry)
        .where(eq(publicEntry.publicRoundId, pr.id))
    ).map((e) => e.designId),
  );

  // Team points, for the record (they earn the admin's picks nothing).
  const rows = await tx
    .select({ memberId: memberPick.memberId, designId: memberPick.designId, rank: memberPick.rank })
    .from(memberPick)
    .innerJoin(
      roundMember,
      and(
        eq(roundMember.roundId, memberPick.roundId),
        eq(roundMember.memberId, memberPick.memberId),
      ),
    )
    .where(
      and(
        eq(memberPick.roundId, round.id),
        eq(roundMember.role, "picker"),
        isNotNull(roundMember.submittedAt),
      ),
    );
  const byMember = new Map<string, { designId: string; rank: number }[]>();
  for (const r of rows) byMember.set(r.memberId, [...(byMember.get(r.memberId) ?? []), r]);
  const standing = new Map(
    computeStandings(
      [...byMember].map(([memberId, picks]) => ({ memberId, picks })),
      round.picksPerMember,
    ).map((s) => [s.designId, s]),
  );

  if (designIds.some((id) => onList.has(id))) {
    await tx
      .update(shortlist)
      .set({ adminChoice: true })
      .where(and(eq(shortlist.roundId, round.id), inArray(shortlist.designId, designIds)));
  }
  const added = designIds.filter((id) => !onList.has(id));
  let position = Math.max(0, ...listed.map((l) => l.position));
  if (added.length) {
    await tx.insert(shortlist).values(
      added.map((designId) => {
        const st = standing.get(designId);
        return {
          roundId: round.id,
          designId,
          points: st?.points ?? 0,
          pickedBy: st?.pickedBy ?? 0,
          firstPlaces: st?.firstPlaces ?? 0,
          position: ++position,
          adminChoice: true,
        };
      }),
    );
  }
  const toEnter = designIds.filter((id) => !entries.has(id));
  if (toEnter.length) {
    const cws = await tx
      .select({ designId: colourway.designId, id: colourway.id })
      .from(colourway)
      .where(inArray(colourway.designId, toEnter))
      .orderBy(asc(colourway.sortOrder));
    const first = new Map<string, string>();
    for (const c of cws) if (!first.has(c.designId)) first.set(c.designId, c.id);
    await tx.insert(publicEntry).values(
      toEnter.map((designId) => ({
        publicRoundId: pr.id,
        designId,
        colourwayId: first.get(designId) ?? null,
      })),
    );
  }
  await audit(tx, actorId, "public_round.admin_picks_added", {
    roundId: round.id,
    publicRoundId: pr.id,
    added: toEnter,
    alreadyIn: designIds.filter((id) => entries.has(id)),
  });
}
