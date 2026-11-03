import { describe, expect, it } from "vitest";
import { bordaPoints, computeStandings, cutShortlist } from "@/src/lib/scoring";

const member = (memberId: string, ...designIds: string[]) => ({
  memberId,
  picks: designIds.map((designId, i) => ({ designId, rank: i + 1 })),
});

describe("bordaPoints", () => {
  it("gives rank 1 = 6 … rank 6 = 1 with six picks (brief §2)", () => {
    expect([1, 2, 3, 4, 5, 6].map((r) => bordaPoints(r, 6))).toEqual([6, 5, 4, 3, 2, 1]);
  });

  it("scales with the round's picks-per-member (CLAUDE.md §0.2)", () => {
    expect(bordaPoints(1, 10)).toBe(10);
    expect(bordaPoints(10, 10)).toBe(1);
  });
});

describe("computeStandings", () => {
  it("sums Borda points across members", () => {
    const s = computeStandings([member("m1", "a", "b"), member("m2", "b", "a")], 2);
    expect(s.map((x) => [x.designId, x.points])).toEqual([
      ["a", 3],
      ["b", 3],
    ]);
  });

  it("tie-break 1: on equal points, picked by more members wins", () => {
    // x: one member at rank 1 = 3 pts. y: rank 2 + rank 3 = 2 + 1 = 3 pts from two members.
    const s = computeStandings(
      [member("m1", "x", "p", "q"), member("m2", "p", "y", "q"), member("m3", "q", "p", "y")],
      3,
    );
    const x = s.find((d) => d.designId === "x")!;
    const y = s.find((d) => d.designId === "y")!;
    expect(x.points).toBe(y.points);
    expect(y.pickedBy).toBeGreaterThan(x.pickedBy);
    expect(y.position).toBeLessThan(x.position);
  });

  it("tie-break 2: on equal points and pickers, more first places wins", () => {
    // a: ranks 1 and 3 = 3 + 1 = 4. b: ranks 2 and 2 = 2 + 2 = 4. Both picked by two.
    const s = computeStandings([member("m1", "a", "b", "c"), member("m2", "c", "b", "a")], 3);
    const a = s.find((d) => d.designId === "a")!;
    const b = s.find((d) => d.designId === "b")!;
    expect([a.points, a.pickedBy]).toEqual([b.points, b.pickedBy]);
    expect(a.firstPlaces).toBe(1);
    expect(b.firstPlaces).toBe(0);
    expect(a.position).toBeLessThan(b.position);
    expect(a.tiedWith).not.toContain("b");
  });

  it("leaves a full tie for the admin (tie-break 3) by sharing a position", () => {
    const s = computeStandings([member("m1", "a", "b"), member("m2", "b", "a")], 2);
    expect(s[0]!.position).toBe(1);
    expect(s[1]!.position).toBe(1);
    expect(s[0]!.tiedWith).toEqual(["b"]);
  });

  it("awards the consensus badge at 3 or more pickers", () => {
    const s = computeStandings(
      [member("m1", "a"), member("m2", "a"), member("m3", "a", "b"), member("m4", "b")],
      2,
    );
    expect(s.find((d) => d.designId === "a")!.consensus).toBe(true);
    expect(s.find((d) => d.designId === "b")!.consensus).toBe(false);
  });
});

describe("cutShortlist", () => {
  it("cuts cleanly when there is no tie at the boundary", () => {
    const s = computeStandings([member("m1", "a", "b", "c")], 3);
    const cut = cutShortlist(s, 2);
    expect(cut.included.map((d) => d.designId)).toEqual(["a", "b"]);
    expect(cut.needsDecision).toBeNull();
  });

  it("hands a tie straddling the cut to the admin instead of choosing silently", () => {
    // a first, then b/c/d fully tied for the last two seats.
    const s = computeStandings(
      [member("m1", "a", "b"), member("m2", "a", "c"), member("m3", "a", "d")],
      2,
    );
    const cut = cutShortlist(s, 3);
    expect(cut.included.map((d) => d.designId)).toEqual(["a"]);
    expect(cut.needsDecision?.seatsLeft).toBe(2);
    expect(cut.needsDecision?.candidates.map((d) => d.designId).sort()).toEqual(["b", "c", "d"]);
  });

  it("includes everything when there are fewer designs than seats", () => {
    const s = computeStandings([member("m1", "a")], 1);
    expect(cutShortlist(s, 20).included).toHaveLength(1);
  });
});
