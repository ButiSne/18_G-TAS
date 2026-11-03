"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/src/db/server";
import { SESSION_COOKIE } from "@/src/lib/auth/cookie";
import { sessionCookieOptions } from "@/src/lib/auth/session";
import { redeemInvite } from "@/src/lib/auth/store";
import { looksLikeToken } from "@/src/lib/auth/tokens";

/** Runs only when the person taps "Sign in": a link preview's GET never reaches this. */
export async function redeemAction(token: string) {
  const db = getDb();
  const result = db && looksLikeToken(token) ? await redeemInvite(db, token, new Date()) : null;
  // A dead link: back to the page, which explains and offers WhatsApp.
  if (!result) redirect(`/members/join/${encodeURIComponent(token)}`);
  (await cookies()).set(
    SESSION_COOKIE,
    result.sessionToken,
    sessionCookieOptions(result.expiresAt),
  );
  redirect(result.member.role === "admin" ? "/admin" : "/members");
}
