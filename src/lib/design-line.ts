// The two lines of the brand (CLAUDE.md §1), and crossovers: designs that keep one primary
// line but speak to both audiences (e.g. "Youth Elders", "Square Monogram"). A crossover
// carries the tag below, appears under both line filters, and shows a joint badge.

export const LINES = ["EITEEN", "G-TAS"] as const;
export type Line = (typeof LINES)[number];

export const CROSSOVER_TAG = "crossover";

type HasLine = { line: Line; tags: readonly string[] };

export const isCrossover = (design: HasLine) => design.tags.includes(CROSSOVER_TAG);

/** True when the design belongs in a view filtered to `line`. */
export function inLine(design: HasLine, line: Line): boolean {
  return design.line === line || isCrossover(design);
}

/** Badge text: "EITEEN", "G-TAS", or both with the primary line first. */
export function lineBadge(design: HasLine): string {
  if (!isCrossover(design)) return design.line;
  const other = design.line === "EITEEN" ? "G-TAS" : "EITEEN";
  return `${design.line} × ${other}`;
}
