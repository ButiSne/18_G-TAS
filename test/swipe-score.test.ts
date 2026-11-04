import { describe, expect, it } from "vitest";
import { rankSwipes, wilsonLowerBound } from "@/src/lib/swipe-score";

describe("wilsonLowerBound", () => {
  it("matches known values", () => {
    expect(wilsonLowerBound(0, 0)).toBe(0);
    expect(wilsonLowerBound(5, 10)).toBeCloseTo(0.2366, 4);
    expect(wilsonLowerBound(50, 100)).toBeCloseTo(0.4038, 4);
    expect(wilsonLowerBound(10, 10)).toBeCloseTo(0.7225, 4);
  });

  it("trusts more evidence at the same rate", () => {
    expect(wilsonLowerBound(50, 100)).toBeGreaterThan(wilsonLowerBound(5, 10));
  });

  it("does not let a tiny sample beat a strong large one", () => {
    expect(wilsonLowerBound(70, 100)).toBeGreaterThan(wilsonLowerBound(8, 10));
  });
});

describe("rankSwipes", () => {
  const t = (entryId: string, likes: number, passes: number, numberOne = 0) => ({
    entryId,
    likes,
    passes,
    numberOne,
  });

  it("ranks by confident YEBO rate", () => {
    const r = rankSwipes([t("small", 8, 2), t("big", 70, 30), t("weak", 2, 8)]);
    expect(r.map((x) => x.entryId)).toEqual(["big", "small", "weak"]);
    expect(r[0]).toMatchObject({ swipes: 100, likeRate: 0.7, position: 1 });
  });

  it("breaks score ties by number-one votes, then YEBOs, and reports what is left", () => {
    const r = rankSwipes([t("a", 10, 10, 1), t("b", 10, 10, 3), t("c", 10, 10, 1)]);
    expect(r.map((x) => x.entryId)).toEqual(["b", "a", "c"]);
    expect(r[1]).toMatchObject({ position: 2, tiedWith: ["c"] });
    expect(r[2]).toMatchObject({ position: 2, tiedWith: ["a"] });
  });

  it("gives the same ranking whatever order the votes arrive in", () => {
    const tallies = [t("a", 3, 7), t("b", 30, 20, 2), t("c", 5, 0), t("d", 0, 0)];
    const forward = rankSwipes(tallies).map((x) => x.entryId);
    expect(rankSwipes([...tallies].reverse()).map((x) => x.entryId)).toEqual(forward);
    expect(forward.at(-1)).toBe("d"); // no swipes scores 0
  });
});
