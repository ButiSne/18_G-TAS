// Next.js side of sign-in: reading the session cookie and guarding pages and actions.
// proxy.ts only checks that a cookie exists; these checks are the real guard (HANDOVER §7.5).

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/src/db/server";
import { SITE_URL } from "@/src/lib/site";
import { SESSION_COOKIE } from "./cookie";
import { getSessionMember, type SessionMember } from "./store";

/** The signed-in team member for this request, or null. Cached per request. */
export const currentMember = cache(async (): Promise<SessionMember | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const db = getDb();
  if (!token || !db) return null;
  return getSessionMember(db, token, new Date());
});

export async function requireMember(): Promise<SessionMember> {
  const me = await currentMember();
  if (!me) redirect("/members/signin");
  return me;
}

export async function requireAdmin(): Promise<SessionMember> {
  const me = await requireMember();
  if (me.role !== "admin") redirect("/members");
  return me;
}

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

/** The origin this request came in on, so invite links match the site (preview or live). */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return SITE_URL;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
