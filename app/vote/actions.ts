"use server";

// Public voting actions. No account and no personal data: each call proves itself with the
// signed voter cookie, and the database only ever sees salted hashes.

import { z } from "zod";
import { getDb } from "@/src/db/server";
import { seededShuffle } from "@/src/lib/catalogue";
import { currentPublicRound, publicEntries } from "@/src/lib/stages";
import { normaliseRef } from "@/src/lib/tally";
import {
  readVoterCookie,
  verifiedVoter,
  verifyTurnstile,
  voteSecrets,
  writeVoterCookie,
} from "@/src/lib/vote-session";
import { newDeviceToken, saltedHash, VERIFIED_FOR_MS } from "@/src/lib/voter";
import {
  chooseNumberOne,
  recordSwipe,
  saveDemographics,
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

/** "Let's go": checks for bots once, then this phone may swipe for the next 6 hours. */
export async function startVotingAction(turnstileToken: string | null): Promise<StartResult> {
  const secrets = voteSecrets();
  const roundId = await openRoundId();
  if (!secrets) return { ok: false, code: "not_ready" };
  if (!roundId) return { ok: false, code: "not_open" };
  if (!(await verifyTurnstile(turnstileToken))) return { ok: false, code: "bot" };

  const existing = await readVoterCookie(secrets.secret);
  const token = existing?.d ?? newDeviceToken();
  await writeVoterCookie({ d: token, v: Date.now() + VERIFIED_FOR_MS }, secrets.secret);
  const deviceHash = saltedHash(token, secrets.salt);
  const state = await voterState(getDb()!, { publicRoundId: roundId, deviceHash });
  return { ok: true, order: await orderFor(roundId, deviceHash), ...state };
}

async function asVoter(
  fn: (v: { publicRoundId: string; deviceHash: string; ipHash: string }) => Promise<void>,
): Promise<VoteResult> {
  const voter = await verifiedVoter();
  if (!voter) return { ok: false, code: "session" };
  const roundId = await openRoundId();
  if (!roundId) return { ok: false, code: "not_open" };
  try {
    await fn({ publicRoundId: roundId, ...voter });
    return { ok: true };
  } catch (error) {
    if (error instanceof VoteError) return { ok: false, code: error.code };
    throw error;
  }
}

export async function swipeAction(entryId: string, liked: boolean, ref: string | null) {
  if (!uuid.safeParse(entryId).success) return { ok: false, code: "unknown_entry" } as VoteResult;
  return asVoter((v) =>
    recordSwipe(getDb()!, { ...v, entryId, liked: liked === true, ref: normaliseRef(ref) }),
  );
}

export async function undoAction(entryId: string) {
  if (!uuid.safeParse(entryId).success) return { ok: false, code: "unknown_entry" } as VoteResult;
  return asVoter((v) => undoSwipe(getDb()!, { ...v, entryId }));
}

export async function numberOneAction(entryId: string, ref: string | null) {
  if (!uuid.safeParse(entryId).success) return { ok: false, code: "unknown_entry" } as VoteResult;
  return asVoter((v) => chooseNumberOne(getDb()!, { ...v, entryId, ref: normaliseRef(ref) }));
}

export async function aboutYouAction(ageBracket: string | null, province: string | null) {
  return asVoter((v) =>
    saveDemographics(getDb()!, {
      publicRoundId: v.publicRoundId,
      deviceHash: v.deviceHash,
      ageBracket: ageBracket ? String(ageBracket).slice(0, 10) : null,
      province: province ? String(province).slice(0, 30) : null,
    }),
  );
}
