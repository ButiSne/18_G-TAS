// The public voter (CLAUDE.md §2, §6): anonymous, one phone at a time.
// One functional cookie, as the privacy notice promises: it holds a random device token
// and the time until which the bot check counts, signed with HMAC so it cannot be forged
// or edited. Only salted SHA-256 hashes of the token and of the IP ever reach the database.

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const VOTER_COOKIE = "gtas_v";
export const VOTER_COOKIE_DAYS = 400; // the most browsers allow
export const VERIFIED_FOR_MS = 6 * 60 * 60 * 1000; // a bot check counts for 6 hours

export type VoterPayload = { d: string; v: number };

export const newDeviceToken = () => randomBytes(24).toString("base64url");

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString();
const mac = (data: string, secret: string) =>
  createHmac("sha256", secret).update(data).digest("base64url");

export function signVoter(payload: VoterPayload, secret: string): string {
  const body = b64(JSON.stringify(payload));
  return `${body}.${mac(body, secret)}`;
}

/** The payload if the cookie is genuine and well-formed, else null. */
export function readVoter(value: string | undefined, secret: string): VoterPayload | null {
  if (!value || value.length > 300) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(mac(body, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(unb64(body)) as VoterPayload;
    if (typeof p.d !== "string" || !/^[A-Za-z0-9_-]{32}$/.test(p.d) || typeof p.v !== "number") {
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export const isVerified = (p: VoterPayload | null, now: Date) => Boolean(p && p.v > now.getTime());

/** SHA-256 with the server's secret salt: not reversible, and useless without the salt. */
export function saltedHash(value: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

/** The client IP from proxy headers (first hop). Used only to hash, never stored. */
export function clientIp(forwardedFor: string | null, realIp: string | null): string {
  return (forwardedFor?.split(",")[0] ?? realIp ?? "unknown").trim() || "unknown";
}

/**
 * The vote receipt: the device token, signed, kept in the phone's own storage as well as
 * the cookie. Clearing cookies alone then brings back the same phone, not a fresh vote.
 * A separate MAC domain from the cookie, so one can never pass for the other.
 */
export function signReceipt(deviceToken: string, secret: string): string {
  return `${deviceToken}.${mac(`receipt:${deviceToken}`, secret)}`;
}

export function readReceipt(value: unknown, secret: string): string | null {
  if (typeof value !== "string" || value.length > 120) return null;
  const [token, sig] = value.split(".");
  if (!token || !sig || !/^[A-Za-z0-9_-]{32}$/.test(token)) return null;
  const expected = Buffer.from(mac(`receipt:${token}`, secret));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? token : null;
}
