import { describe, expect, it } from "vitest";
import { formatSATime } from "@/src/lib/format";

describe("formatSATime", () => {
  it("shows South African time (UTC+2), whatever the server's time zone", () => {
    const shown = formatSATime(new Date("2026-11-05T11:42:00Z"));
    expect(shown).toContain("13:42");
    expect(shown).toMatch(/Thu/);
    expect(shown).toMatch(/5 Nov|05 Nov/);
  });

  it("rolls the date over at SA midnight, not UTC midnight", () => {
    expect(formatSATime(new Date("2026-11-04T22:30:00Z"))).toMatch(/Thu.*00:30/);
  });
});
