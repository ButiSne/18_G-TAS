import { describe, expect, it } from "vitest";
import { validatePicks } from "@/src/lib/picks";

const picks = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ designId: `d${i}`, rank: i + 1 }));

describe("validatePicks", () => {
  it("accepts exactly N ranked picks on submit", () => {
    expect(validatePicks(picks(6), 6, true)).toEqual([]);
  });

  it("refuses to submit fewer than N picks (brief §8: can't submit with fewer)", () => {
    expect(validatePicks(picks(4), 6, true)).toContainEqual({
      kind: "wrong_count",
      expected: 6,
      actual: 4,
    });
  });

  it("allows a partial draft but never more than N", () => {
    expect(validatePicks(picks(4), 6, false)).toEqual([]);
    expect(validatePicks(picks(7), 6, false)[0]?.kind).toBe("wrong_count");
  });

  it("honours a per-round N other than 6", () => {
    expect(validatePicks(picks(10), 10, true)).toEqual([]);
    expect(validatePicks(picks(6), 10, true)[0]?.kind).toBe("wrong_count");
  });

  it("rejects a duplicate rank", () => {
    const p = [
      { designId: "a", rank: 1 },
      { designId: "b", rank: 1 },
    ];
    expect(validatePicks(p, 2, true)).toContainEqual({ kind: "duplicate_rank", rank: 1 });
  });

  it("rejects the same design twice", () => {
    const p = [
      { designId: "a", rank: 1 },
      { designId: "a", rank: 2 },
    ];
    expect(validatePicks(p, 2, true)).toContainEqual({ kind: "duplicate_design", designId: "a" });
  });

  it("rejects ranks outside 1..N", () => {
    expect(validatePicks([{ designId: "a", rank: 0 }], 6, false)[0]?.kind).toBe(
      "rank_out_of_range",
    );
    expect(validatePicks([{ designId: "a", rank: 7 }], 6, false)[0]?.kind).toBe(
      "rank_out_of_range",
    );
  });
});
