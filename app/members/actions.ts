"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/src/db/server";
import { SESSION_COOKIE } from "@/src/lib/auth/cookie";
import { requireMember } from "@/src/lib/auth/session";
import { endSession } from "@/src/lib/auth/store";
import { RoundError, savePicks, submitPicks } from "@/src/lib/team-round";

export async function signOutAction() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const db = getDb();
  if (token && db) await endSession(db, token, new Date());
  jar.delete(SESSION_COOKIE);
  redirect("/");
}

export type PickResult = { ok: true; roundClosed?: boolean } | { ok: false; code: string };

const ids = z.array(z.uuid()).max(20);

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
