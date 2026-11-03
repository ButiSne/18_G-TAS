import { describe, expect, it } from "vitest";
import {
  hashToken,
  INVITE_TTL_MS,
  inviteState,
  isSessionActive,
  looksLikeToken,
  newToken,
} from "@/src/lib/auth/tokens";

const now = new Date("2026-11-04T12:00:00Z");
const later = (ms: number) => new Date(now.getTime() + ms);

describe("tokens", () => {
  it("are 43 URL-safe characters and never repeat", () => {
    const tokens = new Set(Array.from({ length: 200 }, newToken));
    expect(tokens.size).toBe(200);
    for (const tok of tokens) expect(looksLikeToken(tok)).toBe(true);
  });

  it("hash deterministically to hex, and the hash is not the token", () => {
    const tok = newToken();
    expect(hashToken(tok)).toBe(hashToken(tok));
    expect(hashToken(tok)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(tok)).not.toContain(tok);
    expect(hashToken(newToken())).not.toBe(hashToken(tok));
  });

  it("rejects anything that is not token-shaped before it reaches the database", () => {
    expect(looksLikeToken("abc")).toBe(false);
    expect(looksLikeToken(`${"a".repeat(42)}/`)).toBe(false);
    expect(looksLikeToken("' or 1=1 --".padEnd(43, "x"))).toBe(false);
  });
});

describe("inviteState", () => {
  it("is valid until it expires, then expired", () => {
    expect(inviteState({ usedAt: null, expiresAt: later(INVITE_TTL_MS) }, now)).toBe("valid");
    expect(inviteState({ usedAt: null, expiresAt: later(-1) }, now)).toBe("expired");
    expect(inviteState({ usedAt: null, expiresAt: now }, now)).toBe("expired");
  });

  it("is used once used, even before it would expire", () => {
    expect(inviteState({ usedAt: now, expiresAt: later(1000) }, now)).toBe("used");
  });
});

describe("isSessionActive", () => {
  it("ends when revoked or expired", () => {
    expect(isSessionActive({ revokedAt: null, expiresAt: later(1000) }, now)).toBe(true);
    expect(isSessionActive({ revokedAt: now, expiresAt: later(1000) }, now)).toBe(false);
    expect(isSessionActive({ revokedAt: null, expiresAt: later(-1) }, now)).toBe(false);
  });
});
