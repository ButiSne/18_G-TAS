import { z } from "zod";

// Picks per member is set by the admin per round (CLAUDE.md §0.2). The bounds keep
// Borda meaningful: one pick is a plain vote, and past 20 nobody ranks with care.
export const MIN_PICKS = 1;
export const MAX_PICKS = 20;

export const picksPerMemberSchema = z.number().int().min(MIN_PICKS).max(MAX_PICKS);

export type Pick = { designId: string; rank: number };

export type PicksProblem =
  | { kind: "wrong_count"; expected: number; actual: number }
  | { kind: "rank_out_of_range"; rank: number }
  | { kind: "duplicate_rank"; rank: number }
  | { kind: "duplicate_design"; designId: string };

/**
 * Checks a member's picks for one round.
 * `final` is true on Submit: the set must then be complete. While drafting, a member may
 * hold fewer picks, but never a broken ranking.
 */
export function validatePicks(
  picks: Pick[],
  picksPerMember: number,
  final: boolean,
): PicksProblem[] {
  const problems: PicksProblem[] = [];
  if (final ? picks.length !== picksPerMember : picks.length > picksPerMember) {
    problems.push({ kind: "wrong_count", expected: picksPerMember, actual: picks.length });
  }
  const ranks = new Set<number>();
  const designs = new Set<string>();
  for (const p of picks) {
    if (!Number.isInteger(p.rank) || p.rank < 1 || p.rank > picksPerMember) {
      problems.push({ kind: "rank_out_of_range", rank: p.rank });
    }
    if (ranks.has(p.rank)) problems.push({ kind: "duplicate_rank", rank: p.rank });
    if (designs.has(p.designId)) problems.push({ kind: "duplicate_design", designId: p.designId });
    ranks.add(p.rank);
    designs.add(p.designId);
  }
  return problems;
}
