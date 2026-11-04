import { describe, expect, it } from "vitest";
import { shortlistCoverage, validateFinalTen, type FinalCandidate } from "@/src/lib/final-ten";
import type { PrintMethod } from "@/src/lib/print-methods";

const c = (designId: string, printMethod: PrintMethod | null): FinalCandidate => ({
  designId,
  printMethod,
});
const many = (prefix: string, n: number, m: PrintMethod) =>
  Array.from({ length: n }, (_, i) => c(`${prefix}${i}`, m));

describe("validateFinalTen (CLAUDE.md §0.1.3: 5 sublimation + 5 other)", () => {
  it("accepts 5 sublimation and 5 across other methods", () => {
    const chosen = [
      ...many("s", 5, "full-sublimation"),
      ...many("d", 3, "dtf"),
      ...many("e", 2, "embroidery-or-dtf"),
    ];
    expect(validateFinalTen(chosen)).toEqual([]);
  });

  it("does not require any particular split among the other methods", () => {
    expect(
      validateFinalTen([...many("s", 5, "full-sublimation"), ...many("v", 5, "velvet-flock")]),
    ).toEqual([]);
  });

  it("rejects 6 sublimation and 4 other", () => {
    const kinds = validateFinalTen([
      ...many("s", 6, "full-sublimation"),
      ...many("d", 4, "dtf"),
    ]).map((p) => p.kind);
    expect(kinds).toEqual(["wrong_sublimation", "wrong_other"]);
  });

  it("rejects fewer than ten", () => {
    const kinds = validateFinalTen([
      ...many("s", 5, "full-sublimation"),
      ...many("d", 4, "dtf"),
    ]).map((p) => p.kind);
    expect(kinds).toContain("wrong_total");
  });

  it("refuses a design with no print method rather than guessing its half", () => {
    const chosen = [...many("s", 5, "full-sublimation"), ...many("d", 4, "dtf"), c("x", null)];
    expect(validateFinalTen(chosen)).toContainEqual({
      kind: "missing_print_method",
      designId: "x",
    });
  });

  it("rejects the same design twice", () => {
    const chosen = [...many("s", 5, "full-sublimation"), ...many("d", 4, "dtf"), c("d0", "dtf")];
    expect(validateFinalTen(chosen)).toContainEqual({ kind: "duplicate_design", designId: "d0" });
  });
});

describe("shortlistCoverage (CLAUDE.md §0.4)", () => {
  it("warns when the shortlist cannot fill the sublimation half", () => {
    const cov = shortlistCoverage([
      ...many("s", 4, "full-sublimation"),
      ...many("d", 8, "dtf"),
      c("x", null),
    ]);
    expect(cov).toMatchObject({ sublimation: 4, other: 8, unknown: 1 });
    expect(cov.enoughSublimation).toBe(false);
    expect(cov.enoughOther).toBe(true);
  });
});
