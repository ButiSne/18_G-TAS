"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/src/db/server";
import { requestOrigin, requireAdmin } from "@/src/lib/auth/session";
import { createInvite, revokeAllSessions } from "@/src/lib/auth/store";
import { closeRound, openRound, RoundError, unlockMember } from "@/src/lib/team-round";

const memberId = z.uuid();

export type InviteResult =
  { ok: true; url: string; expiresAt: string; name: string } | { ok: false };

/** Admin only: a fresh single-use sign-in link for one team member. */
export async function createInviteAction(id: string): Promise<InviteResult> {
  const admin = await requireAdmin();
  const db = getDb();
  const parsed = memberId.safeParse(id);
  if (!db || !parsed.success) return { ok: false };
  const { token, expiresAt, name } = await createInvite(db, {
    memberId: parsed.data,
    createdBy: admin.id,
    now: new Date(),
  });
  revalidatePath("/admin");
  return {
    ok: true,
    url: `${await requestOrigin()}/members/join/${token}`,
    expiresAt: expiresAt.toISOString(),
    name,
  };
}

export type RoundActionResult = { ok: true } | { ok: false; code: string };

const roundFail = (error: unknown): RoundActionResult => {
  if (error instanceof RoundError) return { ok: false, code: error.code };
  throw error;
};

/** Admin only: open the team round with the chosen people and settings. */
export async function openRoundAction(
  _prev: RoundActionResult | null,
  form: FormData,
): Promise<RoundActionResult> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      roundId: z.uuid(),
      picksPerMember: z.coerce.number().int(),
      shortlistSize: z.coerce.number().int(),
      memberIds: z.array(z.uuid()).min(1),
    })
    .safeParse({
      roundId: form.get("roundId"),
      picksPerMember: form.get("picksPerMember"),
      shortlistSize: form.get("shortlistSize"),
      memberIds: form.getAll("memberIds"),
    });
  if (!parsed.success) return { ok: false, code: "bad_settings" };
  try {
    await openRound(getDb()!, { ...parsed.data, actorId: admin.id, now: new Date() });
  } catch (error) {
    return roundFail(error);
  }
  revalidatePath("/admin");
  revalidatePath("/members");
  return { ok: true };
}

export async function closeRoundAction(roundId: string) {
  const admin = await requireAdmin();
  const id = z.uuid().safeParse(roundId);
  if (!id.success) return;
  try {
    await closeRound(getDb()!, { roundId: id.data, actorId: admin.id, now: new Date() });
  } catch (error) {
    roundFail(error);
  }
  revalidatePath("/admin");
  revalidatePath("/members");
}

export async function unlockMemberAction(roundId: string, member: string) {
  const admin = await requireAdmin();
  const ids = z.tuple([z.uuid(), z.uuid()]).safeParse([roundId, member]);
  if (!ids.success) return;
  try {
    await unlockMember(getDb()!, {
      roundId: ids.data[0],
      memberId: ids.data[1],
      actorId: admin.id,
    });
  } catch (error) {
    roundFail(error);
  }
  revalidatePath("/admin");
}

/** Admin only: sign a person out of every phone (lost phone, forwarded link). */
export async function revokeSessionsAction(id: string) {
  const admin = await requireAdmin();
  const db = getDb();
  const parsed = memberId.safeParse(id);
  if (!db || !parsed.success) return;
  await revokeAllSessions(db, { memberId: parsed.data, actorId: admin.id, now: new Date() });
  revalidatePath("/admin");
}
