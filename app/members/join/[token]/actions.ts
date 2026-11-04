"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/src/db/server";
import { SESSION_COOKIE } from "@/src/lib/auth/cookie";
import { sessionCookieOptions } from "@/src/lib/auth/session";
import { redeemInvite } from "@/src/lib/auth/store";
import { looksLikeToken } from "@/src/lib/auth/tokens";
import { hitAll, LIMITS } from "@/src/lib/rate-limit";
import { requestIpHash, voteSecrets } from "@/src/lib/vote-session";

/** Runs only when the person taps "Sign in": a link preview's GET never reaches this. */
export async function redeemAction(token: string) {
  const db = getDb();
  const page = `/members/join/${encodeURIComponent(token)}`;

  // Sign-in attempts per network. Tokens are unguessable (256 bits); this only blunts abuse.
  const secrets = voteSecrets();
  if (db && secrets) {
    const ipHash = await requestIpHash(secrets.salt);
    if (!(await hitAll(db, [[`signin:ip:${ipHash}`, LIMITS.signInPerIp]], new Date()))) {
      redirect(`${page}?slow=1`);
    }
  }

  const result = db && looksLikeToken(token) ? await redeemInvite(db, token, new Date()) : null;
  // A dead link: back to the page, which explains and offers WhatsApp.
  if (!result) redirect(page);
  (await cookies()).set(
    SESSION_COOKIE,
    result.sessionToken,
    sessionCookieOptions(result.expiresAt),
  );
  redirect(result.member.role === "admin" ? "/admin" : "/members");
}
