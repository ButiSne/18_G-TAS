"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/src/db/server";
import { SESSION_COOKIE } from "@/src/lib/auth/cookie";
import { MAX_CURATOR_PICKS } from "@/src/lib/picks";
import { requireMember } from "@/src/lib/auth/session";
import { endSession } from "@/src/lib/auth/store";
import {
  NOTE_MAX,
  RoundError,
  savePickNote,
  savePicks,
  saveSuggestion,
  SUGGESTION_MAX,
  submitPicks,
} from "@/src/lib/team-round";

export async function signOutAction() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const db = getDb();
  if (token && db) await endSession(db, token, new Date());
  jar.delete(SESSION_COOKIE);
  redirect("/");
}

export type PickResult = { ok: true; roundClosed?: boolean } | { ok: false; code: string };

const ids = z.array(z.uuid()).max(MAX_CURATOR_PICKS);

// The member is always the signed-in person: a client can never pick on someone's behalf.
async function run(fn: (memberId: string) => Promise<PickResult>): Promise<PickResult> {
  const me = await requireMember();
  try {
    return await fn(me.id);
  } catch (error) {
    if (error instanceof RoundError) return { ok: false, code: error.code };
    throw error;
  }
}

export async function savePicksAction(roundId: string, designIds: string[]): Promise<PickResult> {
  return run(async (memberId) => {
    const round = z.uuid().safeParse(roundId);
    const picks = ids.safeParse(designIds);
    if (!round.success || !picks.success) return { ok: false, code: "invalid_picks" };
    await savePicks(getDb()!, {
      roundId: round.data,
      memberId,
      designIds: picks.data,
      now: new Date(),
    });
    return { ok: true };
  });
}

const noteInput = z.object({
  roundId: z.uuid(),
  designId: z.uuid(),
  // Counted again after trimming in savePickNote; this only stops oversized payloads.
  note: z.string().max(NOTE_MAX * 4),
  kind: z.enum(["comment", "suggestion"]),
});

/** A comment or suggestion on a design the member ticked. Empty text deletes it. */
export async function savePickNoteAction(input: z.input<typeof noteInput>): Promise<PickResult> {
  return run(async (memberId) => {
    const parsed = noteInput.safeParse(input);
    if (!parsed.success) return { ok: false, code: "too_long" };
    await savePickNote(getDb()!, { ...parsed.data, memberId, now: new Date() });
    return { ok: true };
  });
}

export async function saveSuggestionAction(roundId: string, text: string): Promise<PickResult> {
  return run(async (memberId) => {
    const round = z.uuid().safeParse(roundId);
    const body = z
      .string()
      .max(SUGGESTION_MAX * 4)
      .safeParse(text);
    if (!round.success) return { ok: false, code: "no_round" };
    if (!body.success) return { ok: false, code: "too_long" };
    await saveSuggestion(getDb()!, { roundId: round.data, memberId, text: body.data });
    return { ok: true };
  });
}

export async function submitPicksAction(roundId: string): Promise<PickResult> {
  return run(async (memberId) => {
    const round = z.uuid().safeParse(roundId);
    if (!round.success) return { ok: false, code: "no_round" };
    const { roundClosed } = await submitPicks(getDb()!, {
      roundId: round.data,
      memberId,
      now: new Date(),
    });
    revalidatePath("/members");
    return { ok: true, roundClosed };
  });
}
