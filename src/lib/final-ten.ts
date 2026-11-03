import { type PrintMethod, slotFor } from "./print-methods";

// The market test runs ten designs: five sublimation, and five shared across the
// other print methods (CLAUDE.md §0.1.3). Sublimation gets its own half because it
// is the all-over, full-colour work; the rest are spot or applied prints.
export const FINAL_SIZE = 10;
export const SUBLIMATION_SEATS = 5;
export const OTHER_SEATS = FINAL_SIZE - SUBLIMATION_SEATS;

export type FinalCandidate = { designId: string; printMethod: PrintMethod | null };

export type FinalTenProblem =
  | { kind: "wrong_total"; expected: number; actual: number }
  | { kind: "wrong_sublimation"; expected: number; actual: number }
  | { kind: "wrong_other"; expected: number; actual: number }
  | { kind: "missing_print_method"; designId: string }
  | { kind: "duplicate_design"; designId: string };

export function validateFinalTen(chosen: FinalCandidate[]): FinalTenProblem[] {
  const problems: FinalTenProblem[] = [];
  const seen = new Set<string>();
  let sublimation = 0;
  let other = 0;
  for (const c of chosen) {
    if (seen.has(c.designId)) problems.push({ kind: "duplicate_design", designId: c.designId });
    seen.add(c.designId);
    // A design with no print method cannot be placed in either half; never guess one.
    if (c.printMethod === null) {
      problems.push({ kind: "missing_print_method", designId: c.designId });
      continue;
    }
    if (slotFor(c.printMethod) === "sublimation") sublimation += 1;
    else other += 1;
  }
  if (chosen.length !== FINAL_SIZE) {
    problems.push({ kind: "wrong_total", expected: FINAL_SIZE, actual: chosen.length });
  }
  if (sublimation !== SUBLIMATION_SEATS) {
    problems.push({ kind: "wrong_sublimation", expected: SUBLIMATION_SEATS, actual: sublimation });
  }
  if (other !== OTHER_SEATS) {
    problems.push({ kind: "wrong_other", expected: OTHER_SEATS, actual: other });
  }
  return problems;
}

/**
 * Shortlist warning (CLAUDE.md §0.4): the public round must offer enough of each
 * half for the final ten to be possible at all.
 */
export function shortlistCoverage(shortlist: FinalCandidate[]) {
  const counts = { sublimation: 0, other: 0, unknown: 0 };
  for (const c of shortlist) {
    if (c.printMethod === null) counts.unknown += 1;
    else counts[slotFor(c.printMethod)] += 1;
  }
  return {
    ...counts,
    enoughSublimation: counts.sublimation >= SUBLIMATION_SEATS,
    enoughOther: counts.other >= OTHER_SEATS,
  };
}
