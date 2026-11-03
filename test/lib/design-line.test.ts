import { describe, expect, it } from "vitest";
import { inLine, isCrossover, lineBadge } from "@/src/lib/design-line";

const gtas = { line: "G-TAS" as const, tags: [] };
const crossover = { line: "G-TAS" as const, tags: ["crossover"] };

describe("design lines and crossovers", () => {
  it("keeps a plain design in its own line only", () => {
    expect(inLine(gtas, "G-TAS")).toBe(true);
    expect(inLine(gtas, "EITEEN")).toBe(false);
    expect(lineBadge(gtas)).toBe("G-TAS");
  });

  it("shows a crossover under both lines, primary line first on the badge", () => {
    expect(isCrossover(crossover)).toBe(true);
    expect(inLine(crossover, "G-TAS")).toBe(true);
    expect(inLine(crossover, "EITEEN")).toBe(true);
    expect(lineBadge(crossover)).toBe("G-TAS × EITEEN");
    expect(lineBadge({ line: "EITEEN", tags: ["crossover"] })).toBe("EITEEN × G-TAS");
  });
});
