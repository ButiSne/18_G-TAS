// Next.js side of the public voter: the signed cookie, the salted hashes and the bot check.
// The raw IP is read from the request, hashed at once, and never stored or logged.

import { cookies, headers } from "next/headers";
import {
  clientIp,
  isVerified,
  readVoter,
  saltedHash,
  signVoter,
  VOTER_COOKIE,
  VOTER_COOKIE_DAYS,
  type VoterPayload,
} from "./voter";

/** HASH_SALT salts the hashes; AUTH_SECRET signs the cookie. Null when not configured. */
export function voteSecrets() {
  const salt = process.env.HASH_SALT;
  const secret = process.env.AUTH_SECRET || salt;
  return salt && secret ? { salt, secret } : null;
}

export async function readVoterCookie(secret: string): Promise<VoterPayload | null> {
  return readVoter((await cookies()).get(VOTER_COOKIE)?.value, secret);
}

export async function writeVoterCookie(payload: VoterPayload, secret: string) {
  (await cookies()).set(VOTER_COOKIE, signVoter(payload, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VOTER_COOKIE_DAYS * 24 * 60 * 60,
  });
}

export async function requestIpHash(salt: string): Promise<string> {
  const h = await headers();
  return saltedHash(clientIp(h.get("x-forwarded-for"), h.get("x-real-ip")), salt);
}

/** This phone, if its cookie is genuine and its bot check still counts. */
export async function verifiedVoter() {
  const secrets = voteSecrets();
  if (!secrets) return null;
  const voter = await readVoterCookie(secrets.secret);
  if (!isVerified(voter, new Date())) return null;
  return {
    deviceHash: saltedHash(voter!.d, secrets.salt),
    ipHash: await requestIpHash(secrets.salt),
  };
}

/**
 * Cloudflare Turnstile (brief §2). Until TURNSTILE_SECRET_KEY is set (local development and
 * trial runs) the check is skipped; the launch checklist requires the keys in production.
 */
export async function verifyTurnstile(token: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const h = await headers();
  const body = new URLSearchParams({
    secret,
    response: token,
    remoteip: clientIp(h.get("x-forwarded-for"), h.get("x-real-ip")),
  });
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
