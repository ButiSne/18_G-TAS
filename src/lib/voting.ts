// Stage 2 for the public (CLAUDE.md §0.7, §2): swipes, undo, the one "number one" vote, and
// the single submission per phone. Nothing but the vote is kept (owner, Nov 2026): each
// row holds the design, YEBO or CHA, the share link it came from, and a salted device hash
// so a phone votes once. No IP, no age, no area. Plain functions taking `db`, tested
// against Postgres.

import { and, eq } from "drizzle-orm";
import type { createDb } from "../db/client.ts";
import { ballot, publicEntry, publicRound, swipe, vote } from "../db/schema.ts";

type Db = ReturnType<typeof createDb>;

export type VoteErrorCode =
  | "not_open"
  | "unknown_entry"
  | "not_liked"
  | "already_voted"
  | "already_submitted"
  | "nothing_to_submit";

// Explicit field, not a parameter property: plain Node (scripts) strips types only.
export class VoteError extends Error {
  code: VoteErrorCode;
  constructor(code: VoteErrorCode) {
    super(code);
    this.code = code;
  }
}

type Voter = { publicRoundId: string; deviceHash: string };

async function openEntry(db: Db, publicRoundId: string, entryId: string) {
  const [row] = await db
    .select({ status: publicRound.status, entryId: publicEntry.id })
    .from(publicRound)
    .leftJoin(
      publicEntry,
      and(eq(publicEntry.publicRoundId, publicRound.id), eq(publicEntry.id, entryId)),
    )
    .where(eq(publicRound.id, publicRoundId));
  if (!row || row.status !== "open") throw new VoteError("not_open");
  if (!row.entryId) throw new VoteError("unknown_entry");
}

/** Once a phone has submitted, its vote is final: nothing more can change. */
async function assertNotSubmitted(db: Db, v: Voter) {
  const [done] = await db
    .select({ id: ballot.id })
    .from(ballot)
    .where(and(eq(ballot.publicRoundId, v.publicRoundId), eq(ballot.deviceHash, v.deviceHash)));
  if (done) throw new VoteError("already_submitted");
}

/**
 * Submits this phone's vote, once (owner's rule): its swipes and number one become final.
 * Needs at least one swipe. The ballot_once_per_device constraint is the final guard.
 */
export async function submitBallot(db: Db, v: Voter) {
  const [round] = await db
    .select({ status: publicRound.status })
    .from(publicRound)
    .where(eq(publicRound.id, v.publicRoundId));
  if (round?.status !== "open") throw new VoteError("not_open");
  await assertNotSubmitted(db, v);
  const [any] = await db
    .select({ id: swipe.id })
    .from(swipe)
    .where(and(eq(swipe.publicRoundId, v.publicRoundId), eq(swipe.deviceHash, v.deviceHash)))
    .limit(1);
  if (!any) throw new VoteError("nothing_to_submit");
  const inserted = await db
    .insert(ballot)
    .values({ publicRoundId: v.publicRoundId, deviceHash: v.deviceHash })
    .onConflictDoNothing({ target: [ballot.publicRoundId, ballot.deviceHash] })
    .returning({ id: ballot.id });
  if (inserted.length === 0) throw new VoteError("already_submitted");
}

/** This phone's swipes, number one and whether it has submitted (to resume or to thank). */
export async function voterState(db: Db, v: Voter) {
  const swipes = await db
    .select({ entryId: swipe.entryId, liked: swipe.liked })
    .from(swipe)
    .where(and(eq(swipe.publicRoundId, v.publicRoundId), eq(swipe.deviceHash, v.deviceHash)));
  const [one] = await db
    .select({ entryId: vote.entryId })
    .from(vote)
    .where(and(eq(vote.publicRoundId, v.publicRoundId), eq(vote.deviceHash, v.deviceHash)));
  const [done] = await db
    .select({ id: ballot.id })
    .from(ballot)
    .where(and(eq(ballot.publicRoundId, v.publicRoundId), eq(ballot.deviceHash, v.deviceHash)));
  return { swipes, numberOne: one?.entryId ?? null, submitted: Boolean(done) };
}

/** YEBO (liked) or CHA. Until the phone submits, swiping again replaces the earlier swipe. */
export async function recordSwipe(
  db: Db,
  v: Voter & { entryId: string; liked: boolean; ref: string | null },
) {
  await openEntry(db, v.publicRoundId, v.entryId);
  await assertNotSubmitted(db, v);
  await db
    .insert(swipe)
    .values({
      publicRoundId: v.publicRoundId,
      entryId: v.entryId,
      deviceHash: v.deviceHash,
      liked: v.liked,
      ref: v.ref,
    })
    .onConflictDoUpdate({
      target: [swipe.publicRoundId, swipe.deviceHash, swipe.entryId],
      set: { liked: v.liked },
    });
}

export async function undoSwipe(db: Db, v: Voter & { entryId: string }) {
  await openEntry(db, v.publicRoundId, v.entryId);
  await assertNotSubmitted(db, v);
  await db
    .delete(swipe)
    .where(
      and(
        eq(swipe.publicRoundId, v.publicRoundId),
        eq(swipe.deviceHash, v.deviceHash),
        eq(swipe.entryId, v.entryId),
      ),
    );
}

/**
 * The single favourite vote: one per phone per round (the vote_one_per_device constraint
 * is the final guard), and only for a design this phone said YEBO to.
 */
export async function chooseNumberOne(db: Db, v: Voter & { entryId: string; ref: string | null }) {
  await openEntry(db, v.publicRoundId, v.entryId);
  await assertNotSubmitted(db, v);
  const [liked] = await db
    .select({ liked: swipe.liked })
    .from(swipe)
    .where(
      and(
        eq(swipe.publicRoundId, v.publicRoundId),
        eq(swipe.deviceHash, v.deviceHash),
        eq(swipe.entryId, v.entryId),
      ),
    );
  if (!liked?.liked) throw new VoteError("not_liked");
  const inserted = await db
    .insert(vote)
    .values({
      publicRoundId: v.publicRoundId,
      entryId: v.entryId,
      deviceHash: v.deviceHash,
      ref: v.ref,
    })
    .onConflictDoNothing({ target: [vote.publicRoundId, vote.deviceHash] })
    .returning({ id: vote.id });
  if (inserted.length === 0) throw new VoteError("already_voted");
}
