// Team sign-in against Postgres (gtas_test): invites are single-use, expire, replace each
// other, and sessions end when revoked. pnpm test:int (needs `pnpm db:up`).

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/src/db/schema";
import {
  createInvite,
  endSession,
  getSessionMember,
  peekInvite,
  redeemInvite,
  revokeAllSessions,
  teamOverview,
} from "@/src/lib/auth/store";

const url = process.env.DATABASE_URL_TEST ?? "postgres://gtas:gtas@localhost:5418/gtas_test";
const sql = postgres(url, { max: 1, onnotice: () => {} });
const db = drizzle(sql, { schema });
const now = new Date("2026-11-04T10:00:00Z");
const hours = (h: number) => new Date(now.getTime() + h * 3_600_000);
let adminId = "";
let lungaId = "";

beforeAll(async () => {
  await sql.unsafe(
    "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;",
  );
  await migrate(db, { migrationsFolder: "drizzle" });
  const rows = await db
    .insert(schema.member)
    .values([
      { name: "Admin", email: "admin@example.com", role: "admin" },
      { name: "Lunga M", email: "lunga@example.com", role: "member" },
    ])
    .returning({ id: schema.member.id, role: schema.member.role });
  adminId = rows.find((r) => r.role === "admin")!.id;
  lungaId = rows.find((r) => r.role === "member")!.id;
}, 60_000);

afterAll(async () => {
  await sql.end();
});

describe("WhatsApp invite sign-in", () => {
  it("lets a link be looked at without using it up, then used exactly once", async () => {
    const { token } = await createInvite(db, { memberId: lungaId, createdBy: adminId, now });
    // A link preview (or the person opening the page) only peeks.
    expect(await peekInvite(db, token, now)).toEqual({ state: "valid", name: "Lunga M" });
    expect(await peekInvite(db, token, now)).toEqual({ state: "valid", name: "Lunga M" });

    const first = await redeemInvite(db, token, now);
    expect(first?.member).toMatchObject({ id: lungaId, name: "Lunga M", role: "member" });
    expect(await getSessionMember(db, first!.sessionToken, now)).toMatchObject({ id: lungaId });

    expect(await redeemInvite(db, token, now)).toBeNull(); // single use
    expect((await peekInvite(db, token, now)).state).toBe("used");
  });

  it("refuses an expired link", async () => {
    const { token } = await createInvite(db, { memberId: lungaId, createdBy: adminId, now });
    expect(await redeemInvite(db, token, hours(25))).toBeNull();
    expect((await peekInvite(db, token, hours(25))).state).toBe("expired");
  });

  it("cancels the old link when a new one is made", async () => {
    const old = await createInvite(db, { memberId: lungaId, createdBy: adminId, now });
    const fresh = await createInvite(db, { memberId: lungaId, createdBy: adminId, now });
    expect((await peekInvite(db, old.token, now)).state).toBe("unknown");
    expect(await redeemInvite(db, fresh.token, now)).not.toBeNull();
  });

  it("only one of two simultaneous taps wins", async () => {
    const { token } = await createInvite(db, { memberId: lungaId, createdBy: adminId, now });
    const results = await Promise.all([redeemInvite(db, token, now), redeemInvite(db, token, now)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("ends sessions on sign-out, on revoke, and after 30 days", async () => {
    const a = await redeemInvite(
      db,
      (await createInvite(db, { memberId: lungaId, createdBy: adminId, now })).token,
      now,
    );
    expect(await getSessionMember(db, a!.sessionToken, hours(24 * 29))).not.toBeNull();
    expect(await getSessionMember(db, a!.sessionToken, hours(24 * 31))).toBeNull();

    await endSession(db, a!.sessionToken, now);
    expect(await getSessionMember(db, a!.sessionToken, now)).toBeNull();

    const b = await redeemInvite(
      db,
      (await createInvite(db, { memberId: lungaId, createdBy: adminId, now })).token,
      now,
    );
    const ended = await revokeAllSessions(db, { memberId: lungaId, actorId: adminId, now });
    expect(ended).toBeGreaterThanOrEqual(1);
    expect(await getSessionMember(db, b!.sessionToken, now)).toBeNull();
  });

  it("shows the admin who is signed in and who has a link waiting", async () => {
    await revokeAllSessions(db, { memberId: lungaId, actorId: adminId, now });
    await createInvite(db, { memberId: lungaId, createdBy: adminId, now });
    const team = await teamOverview(db, now);
    expect(team.map((p) => p.name)).toEqual(["Admin", "Lunga M"]); // admins first
    const lunga = team.find((p) => p.id === lungaId)!;
    expect(lunga.activeSessions).toBe(0);
    expect(lunga.inviteExpiresAt?.toISOString()).toBe(hours(24).toISOString());
  });

  it("writes every step to the audit log, without tokens", async () => {
    const log = await db.select().from(schema.auditLog);
    const actions = new Set(log.map((r) => r.action));
    expect(actions).toEqual(new Set(["invite.created", "invite.redeemed", "sessions.revoked"]));
    expect(JSON.stringify(log)).not.toMatch(/[A-Za-z0-9_-]{43}/); // no raw tokens
    const created = log.filter((r) => r.action === "invite.created");
    expect(created.every((r) => r.actorMemberId === adminId)).toBe(true);
    const [lunga] = await db.select().from(schema.member).where(eq(schema.member.id, lungaId));
    expect(lunga).toBeDefined();
  });
});
