"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/src/db/server";
import { requestOrigin, requireAdmin } from "@/src/lib/auth/session";
import { createInvite, revokeAllSessions } from "@/src/lib/auth/store";

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

/** Admin only: sign a person out of every phone (lost phone, forwarded link). */
export async function revokeSessionsAction(id: string) {
  const admin = await requireAdmin();
  const db = getDb();
  const parsed = memberId.safeParse(id);
  if (!db || !parsed.success) return;
  await revokeAllSessions(db, { memberId: parsed.data, actorId: admin.id, now: new Date() });
  revalidatePath("/admin");
}
