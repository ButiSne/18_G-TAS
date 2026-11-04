// Stage 2 for the public (CLAUDE.md §0.7, §2): swipes, undo, the one "number one" vote,
// and optional demographics. Everything is keyed by a salted device hash; nothing here
// can identify a person. Plain functions taking `db`, tested against Postgres.

import { and, eq } from "drizzle-orm";
import type { createDb } from "../db/client.ts";
import { publicEntry, publicRound, swipe, vote } from "../db/schema.ts";
import { AGE_BRACKETS, PROVINCES } from "./demographics.ts";

type Db = ReturnType<typeof createDb>;

export type VoteErrorCode = "not_open" | "unknown_entry" | "not_liked" | "already_voted";

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

/** This phone's swipes and number one in a round (to resume where it left off). */
export async function voterState(db: Db, v: Voter) {
  const swipes = await db
    .select({ entryId: swipe.entryId, liked: swipe.liked })
    .from(swipe)
    .where(and(eq(swipe.publicRoundId, v.publicRoundId), eq(swipe.deviceHash, v.deviceHash)));
  const [one] = await db
    .select({ entryId: vote.entryId })
    .from(vote)
    .where(and(eq(vote.publicRoundId, v.publicRoundId), eq(vote.deviceHash, v.deviceHash)));
  return { swipes, numberOne: one?.entryId ?? null };
}

/** YEBO (liked) or CHA. Swiping the same design again replaces the earlier swipe. */
export async function recordSwipe(
  db: Db,
  v: Voter & { entryId: string; ipHash: string; liked: boolean; ref: string | null },
) {
  await openEntry(db, v.publicRoundId, v.entryId);
  await db
    .insert(swipe)
    .values({
      publicRoundId: v.publicRoundId,
      entryId: v.entryId,
      deviceHash: v.deviceHash,
      ipHash: v.ipHash,
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
export async function chooseNumberOne(
  db: Db,
  v: Voter & { entryId: string; ipHash: string; ref: string | null },
) {
  await openEntry(db, v.publicRoundId, v.entryId);
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
      ipHash: v.ipHash,
      ref: v.ref,
    })
    .onConflictDoNothing({ target: [vote.publicRoundId, vote.deviceHash] })
    .returning({ id: vote.id });
  if (inserted.length === 0) throw new VoteError("already_voted");
}

/** Optional and anonymous: an age bracket and a province, applied to this phone's rows. */
export async function saveDemographics(
  db: Db,
  v: Voter & { ageBracket: string | null; province: string | null },
) {
  const age = (AGE_BRACKETS as readonly string[]).includes(v.ageBracket ?? "")
    ? v.ageBracket
    : null;
  const province = (PROVINCES as readonly string[]).includes(v.province ?? "") ? v.province : null;
  if (!age && !province) return;
  const set = { ...(age ? { ageBracket: age } : {}), ...(province ? { province } : {}) };
  const where = (t: typeof swipe | typeof vote) =>
    and(eq(t.publicRoundId, v.publicRoundId), eq(t.deviceHash, v.deviceHash));
  await db.update(swipe).set(set).where(where(swipe));
  await db.update(vote).set(set).where(where(vote));
}
