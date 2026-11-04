// Database side of team sign-in (CLAUDE.md §0.9): invites, sessions and the team overview.
// Plain functions taking `db`, so the rules can be tested against Postgres directly.

import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { createDb } from "../../db/client.ts";
import { invite, member, session } from "../../db/schema.ts";
import { audit } from "../audit.ts";
import {
  hashToken,
  INVITE_TTL_MS,
  inviteState,
  newToken,
  SESSION_TTL_MS,
  type InviteState,
} from "./tokens.ts";

type Db = ReturnType<typeof createDb>;
type Role = "member" | "admin";

export type SessionMember = { id: string; name: string; role: Role; sessionId: string };

/**
 * A fresh invite for one team member. Any earlier unused link for that person stops
 * working, so "send a new link" never leaves two live links behind.
 */
export async function createInvite(
  db: Db,
  { memberId, createdBy, now }: { memberId: string; createdBy: string | null; now: Date },
): Promise<{ token: string; expiresAt: Date; name: string }> {
  return db.transaction(async (tx) => {
    const [person] = await tx
      .select({ name: member.name })
      .from(member)
      .where(eq(member.id, memberId));
    if (!person) throw new Error("No such team member");
    await tx.delete(invite).where(and(eq(invite.memberId, memberId), isNull(invite.usedAt)));
    const token = newToken();
    const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);
    await tx.insert(invite).values({ memberId, tokenHash: hashToken(token), expiresAt, createdBy });
    await audit(tx, createdBy, "invite.created", { memberId, expiresAt: expiresAt.toISOString() });
    return { token, expiresAt, name: person.name };
  });
}

/** Reads an invite without using it up: link previews (WhatsApp) must not burn it. */
export async function peekInvite(
  db: Db,
  token: string,
  now: Date,
): Promise<{ state: InviteState | "unknown"; name?: string; expiresAt?: Date }> {
  const [row] = await db
    .select({ usedAt: invite.usedAt, expiresAt: invite.expiresAt, name: member.name })
    .from(invite)
    .innerJoin(member, eq(member.id, invite.memberId))
    .where(eq(invite.tokenHash, hashToken(token)));
  return row
    ? { state: inviteState(row, now), name: row.name, expiresAt: row.expiresAt }
    : { state: "unknown" };
}

/**
 * Uses an invite and starts a session, atomically: the UPDATE only matches an unused,
 * unexpired invite, so two taps at once cannot both succeed. Null when the link is dead.
 */
export async function redeemInvite(
  db: Db,
  token: string,
  now: Date,
): Promise<{
  sessionToken: string;
  expiresAt: Date;
  member: { id: string; name: string; role: Role };
} | null> {
  return db.transaction(async (tx) => {
    const [used] = await tx
      .update(invite)
      .set({ usedAt: now })
      .where(
        and(
          eq(invite.tokenHash, hashToken(token)),
          isNull(invite.usedAt),
          gt(invite.expiresAt, now),
        ),
      )
      .returning({ memberId: invite.memberId });
    if (!used) return null;
    const [person] = await tx
      .select({ id: member.id, name: member.name, role: member.role })
      .from(member)
      .where(eq(member.id, used.memberId));
    const sessionToken = newToken();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    await tx
      .insert(session)
      .values({ memberId: used.memberId, tokenHash: hashToken(sessionToken), expiresAt });
    await audit(tx, used.memberId, "invite.redeemed");
    return { sessionToken, expiresAt, member: person! };
  });
}

export async function getSessionMember(
  db: Db,
  token: string,
  now: Date,
): Promise<SessionMember | null> {
  const [row] = await db
    .select({ id: member.id, name: member.name, role: member.role, sessionId: session.id })
    .from(session)
    .innerJoin(member, eq(member.id, session.memberId))
    .where(
      and(
        eq(session.tokenHash, hashToken(token)),
        isNull(session.revokedAt),
        gt(session.expiresAt, now),
      ),
    );
  return row ?? null;
}

export async function endSession(db: Db, token: string, now: Date) {
  await db
    .update(session)
    .set({ revokedAt: now })
    .where(and(eq(session.tokenHash, hashToken(token)), isNull(session.revokedAt)));
}

/** Signs a person out of every phone. Returns how many sessions ended. */
export async function revokeAllSessions(
  db: Db,
  { memberId, actorId, now }: { memberId: string; actorId: string; now: Date },
): Promise<number> {
  return db.transaction(async (tx) => {
    const ended = await tx
      .update(session)
      .set({ revokedAt: now })
      .where(and(eq(session.memberId, memberId), isNull(session.revokedAt)))
      .returning({ id: session.id });
    await audit(tx, actorId, "sessions.revoked", { memberId, count: ended.length });
    return ended.length;
  });
}

export type TeamRow = {
  id: string;
  name: string;
  role: Role;
  activeSessions: number;
  inviteExpiresAt: Date | null;
};

/** The admin's team list: who is signed in, and who has a link waiting. */
export async function teamOverview(db: Db, now: Date): Promise<TeamRow[]> {
  // Correlated subqueries spell out table names: inside a subquery Drizzle renders
  // member.id as a bare "id", which Postgres would read as the subquery table's own id.
  const at = now.toISOString();
  const rows = await db
    .select({
      id: member.id,
      name: member.name,
      role: member.role,
      activeSessions: sql<number>`(
        select count(*)::int from "session" s
        where s.member_id = "member"."id"
          and s.revoked_at is null and s.expires_at > ${at}::timestamptz
      )`,
      inviteExpiresAt: sql<string | null>`(
        select max(i.expires_at) from "invite" i
        where i.member_id = "member"."id"
          and i.used_at is null and i.expires_at > ${at}::timestamptz
      )`,
    })
    .from(member)
    .orderBy(sql`${member.role} desc`, member.name);
  return rows.map((r) => ({
    ...r,
    inviteExpiresAt: r.inviteExpiresAt ? new Date(r.inviteExpiresAt) : null,
  }));
}
