"use server";

// Public voting actions. No account and no personal data: each call proves itself with the
// signed voter cookie, and the database only ever sees salted hashes.

import { z } from "zod";
import { getDb } from "@/src/db/server";
import { seededShuffle } from "@/src/lib/catalogue";
import { currentPublicRound, publicEntries } from "@/src/lib/stages";
import { hitAll, LIMITS, type Limit } from "@/src/lib/rate-limit";
import { normaliseRef } from "@/src/lib/tally";
import {
  readVoterCookie,
  requestIpHash,
  verifiedVoter,
  verifyTurnstile,
  voteSecrets,
  writeVoterCookie,
} from "@/src/lib/vote-session";
import {
  newDeviceToken,
  readReceipt,
  saltedHash,
  signReceipt,
  VERIFIED_FOR_MS,
} from "@/src/lib/voter";
import {
  chooseNumberOne,
  recordSwipe,
  submitBallot,
  undoSwipe,
  VoteError,
  voterState,
} from "@/src/lib/voting";

export type VoteResult = { ok: true } | { ok: false; code: string };
export type StartResult =
  | {
      ok: true;
      order: string[];
      swipes: { entryId: string; liked: boolean }[];
      numberOne: string | null;
      submitted: boolean;
      /** The signed receipt the phone keeps in its own storage (see signReceipt). */
      receipt: string;
    }
  | { ok: false; code: string };

const uuid = z.uuid();

async function openRoundId() {
  const pr = await currentPublicRound(getDb()!);
  return pr?.status === "open" ? pr.id : null;
}

/**
 * Shuffled per phone (seeded by its hash), so position bias spreads evenly. Not exported:
 * every export of a "use server" file becomes an action any browser can call.
 */
async function orderFor(publicRoundId: string, deviceHash: string) {
  const ids = (await publicEntries(getDb()!, publicRoundId)).map((e) => e.entryId);
  return seededShuffle(ids, deviceHash.slice(0, 12));
}

/**
 * "Let's go": checks for bots once, then this phone may swipe for the next 6 hours.
 * One phone, one vote: the phone is recognised by its cookie, else by the signed receipt in
 * its own storage, so clearing cookies alone does not open a second vote. Nothing else about
 * the phone is collected (owner, Nov 2026).
 */
export async function startVotingAction(
  turnstileToken: string | null,
  receipt: string | null = null,
): Promise<StartResult> {
  const secrets = voteSecrets();
  const roundId = await openRoundId();
  if (!secrets) return { ok: false, code: "not_ready" };
  if (!roundId) return { ok: false, code: "not_open" };
  const ipHash = await requestIpHash(secrets.salt);
  if (!(await hitAll(getDb()!, [[`start:ip:${ipHash}`, LIMITS.startPerIp]], new Date()))) {
    return { ok: false, code: "rate_limited" };
  }
  if (!(await verifyTurnstile(turnstileToken))) return { ok: false, code: "bot" };

  const existing = await readVoterCookie(secrets.secret);
  const token = existing?.d ?? readReceipt(receipt, secrets.secret) ?? newDeviceToken();
  await writeVoterCookie({ d: token, v: Date.now() + VERIFIED_FOR_MS }, secrets.secret);
  const deviceHash = saltedHash(token, secrets.salt);
  const state = await voterState(getDb()!, { publicRoundId: roundId, deviceHash });
  return {
    ok: true,
    order: await orderFor(roundId, deviceHash),
    ...state,
    receipt: signReceipt(token, secrets.secret),
  };
}

/** ipHash keys the speed limits only; it is never written to a vote. */
type Voter = { publicRoundId: string; deviceHash: string; ipHash: string };

/** Runs a vote step for this phone, after its session and rate limits are checked. */
async function asVoter(
  limits: (v: Voter) => [string, Limit][],
  fn: (v: Voter) => Promise<void>,
): Promise<VoteResult> {
  const voter = await verifiedVoter();
  if (!voter) return { ok: false, code: "session" };
  const roundId = await openRoundId();
  if (!roundId) return { ok: false, code: "not_open" };
  const v = { publicRoundId: roundId, ...voter };
  if (!(await hitAll(getDb()!, limits(v), new Date()))) return { ok: false, code: "rate_limited" };
  try {
    await fn(v);
    return { ok: true };
  } catch (error) {
    if (error instanceof VoteError) return { ok: false, code: error.code };
    throw error;
  }
}

const swipeLimits = (v: Voter): [string, Limit][] => [
  [`swipe:dev:${v.deviceHash}`, LIMITS.swipePerDevice],
  [`swipe:ip:${v.ipHash}`, LIMITS.swipePerIp],
];
const finishLimits = (v: Voter): [string, Limit][] => [
  [`finish:dev:${v.deviceHash}`, LIMITS.finishPerDevice],
];

export async function swipeAction(entryId: string, liked: boolean, ref: string | null) {
  if (!uuid.safeParse(entryId).success) return { ok: false, code: "unknown_entry" } as VoteResult;
  return asVoter(swipeLimits, (v) =>
    recordSwipe(getDb()!, {
      publicRoundId: v.publicRoundId,
      deviceHash: v.deviceHash,
      entryId,
      liked: liked === true,
      ref: normaliseRef(ref),
    }),
  );
}

export async function undoAction(entryId: string) {
  if (!uuid.safeParse(entryId).success) return { ok: false, code: "unknown_entry" } as VoteResult;
  return asVoter(swipeLimits, (v) => undoSwipe(getDb()!, { ...v, entryId }));
}

export async function numberOneAction(entryId: string, ref: string | null) {
  if (!uuid.safeParse(entryId).success) return { ok: false, code: "unknown_entry" } as VoteResult;
  return asVoter(finishLimits, (v) =>
    chooseNumberOne(getDb()!, {
      publicRoundId: v.publicRoundId,
      deviceHash: v.deviceHash,
      entryId,
      ref: normaliseRef(ref),
    }),
  );
}

/** Submits this phone's vote: final, once. */
export async function submitVoteAction() {
  return asVoter(finishLimits, (v) =>
    submitBallot(getDb()!, { publicRoundId: v.publicRoundId, deviceHash: v.deviceHash }),
  );
}
