// Tokens for WhatsApp invite links and sign-in sessions. 32 random bytes each; only the
// SHA-256 hash is stored. High-entropy tokens need no salt: there is nothing to guess.

import { createHash, randomBytes } from "node:crypto";

export const INVITE_TTL_MS = 24 * 60 * 60 * 1000; // an invite link works for 24 hours
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // a phone stays signed in for 30 days

export const newToken = () => randomBytes(32).toString("base64url");

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Shape check before touching the database: 32 bytes in base64url is 43 characters. */
export const looksLikeToken = (value: string) => /^[A-Za-z0-9_-]{43}$/.test(value);

export type InviteState = "valid" | "used" | "expired";

export function inviteState(
  invite: { usedAt: Date | null; expiresAt: Date },
  now: Date,
): InviteState {
  if (invite.usedAt) return "used";
  return invite.expiresAt > now ? "valid" : "expired";
}

export function isSessionActive(s: { revokedAt: Date | null; expiresAt: Date }, now: Date) {
  return !s.revokedAt && s.expiresAt > now;
}
