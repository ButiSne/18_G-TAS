import { describe, expect, it } from "vitest";
import { styleFor } from "@/src/lib/style";
import {
  clientIp,
  isVerified,
  newDeviceToken,
  readVoter,
  saltedHash,
  signVoter,
} from "@/src/lib/voter";

const secret = "test-secret";
const now = new Date("2026-11-07T12:00:00Z");

describe("voter cookie", () => {
  it("round-trips a signed payload", () => {
    const p = { d: newDeviceToken(), v: now.getTime() + 1000 };
    expect(readVoter(signVoter(p, secret), secret)).toEqual(p);
  });

  it("rejects a forged, edited or foreign cookie", () => {
    const value = signVoter({ d: newDeviceToken(), v: 0 }, secret);
    expect(readVoter(value, "other-secret")).toBeNull();
    const [body, sig] = value.split(".");
    const edited = Buffer.from(
      JSON.stringify({ d: JSON.parse(Buffer.from(body!, "base64url").toString()).d, v: 9e15 }),
    ).toString("base64url");
    expect(readVoter(`${edited}.${sig}`, secret)).toBeNull();
    expect(readVoter("garbage", secret)).toBeNull();
    expect(readVoter(undefined, secret)).toBeNull();
    expect(readVoter(signVoter({ d: "short", v: 0 }, secret), secret)).toBeNull();
  });

  it("counts the bot check only until it expires", () => {
    expect(isVerified({ d: newDeviceToken(), v: now.getTime() + 1 }, now)).toBe(true);
    expect(isVerified({ d: newDeviceToken(), v: now.getTime() }, now)).toBe(false);
    expect(isVerified(null, now)).toBe(false);
  });
});

describe("hashing", () => {
  it("is salted: the same IP hashes differently under another salt", () => {
    expect(saltedHash("102.1.2.3", "a")).toBe(saltedHash("102.1.2.3", "a"));
    expect(saltedHash("102.1.2.3", "a")).not.toBe(saltedHash("102.1.2.3", "b"));
    expect(saltedHash("102.1.2.3", "a")).not.toContain("102.1.2.3");
  });

  it("takes the first hop of x-forwarded-for", () => {
    expect(clientIp("102.1.2.3, 10.0.0.1", null)).toBe("102.1.2.3");
    expect(clientIp(null, "41.0.0.9")).toBe("41.0.0.9");
    expect(clientIp(null, null)).toBe("unknown");
  });
});

describe("styleFor", () => {
  const e = { line: "EITEEN" as const };
  const g = { line: "G-TAS" as const };
  it("names a style from this phone's own YEBOs", () => {
    expect(styleFor([e, e, e, g])).toBe("street");
    expect(styleFor([g, g, g, e])).toBe("luxe");
    expect(styleFor([e, g])).toBe("classic");
    expect(styleFor([])).toBe("picky");
  });
});
