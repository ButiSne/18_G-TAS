import type { Pick } from "./picks";

export type MemberPicks = { memberId: string; picks: Pick[] };

export type Standing = {
  designId: string;
  points: number;
  pickedBy: number;
  firstPlaces: number;
  /** 1-based. Designs that tie on every automatic rule share a position. */
  position: number;
  /** Designs this one is still tied with after tie-breaks 1 and 2. */
  tiedWith: string[];
  consensus: boolean;
};

/**
 * Borda count with N picks: rank 1 earns N points, rank N earns 1.
 * N is the round's picks-per-member, not a fixed 6 (CLAUDE.md §0.2).
 */
export function bordaPoints(rank: number, picksPerMember: number): number {
  return picksPerMember - rank + 1;
}

/** Brief §2: a design picked by 3 or more members earns the consensus badge. */
export const CONSENSUS_MIN_MEMBERS = 3;

export function computeStandings(all: MemberPicks[], picksPerMember: number): Standing[] {
  const tally = new Map<string, { points: number; pickedBy: number; firstPlaces: number }>();
  for (const member of all) {
    for (const p of member.picks) {
      const t = tally.get(p.designId) ?? { points: 0, pickedBy: 0, firstPlaces: 0 };
      t.points += bordaPoints(p.rank, picksPerMember);
      t.pickedBy += 1;
      if (p.rank === 1) t.firstPlaces += 1;
      tally.set(p.designId, t);
    }
  }

  // Order: points, then tie-break 1 (picked by more members), then tie-break 2
  // (more first places). Design id last only so the output is stable; it is
  // never presented as a decision — tie-break 3 is the admin's, and logged.
  const rows = [...tally.entries()]
    .map(([designId, t]) => ({ designId, ...t }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.pickedBy - a.pickedBy ||
        b.firstPlaces - a.firstPlaces ||
        a.designId.localeCompare(b.designId),
    );

  const key = (r: (typeof rows)[number]) => `${r.points}|${r.pickedBy}|${r.firstPlaces}`;
  const groups = new Map<string, string[]>();
  for (const r of rows) groups.set(key(r), [...(groups.get(key(r)) ?? []), r.designId]);

  let position = 0;
  let previousKey = "";
  return rows.map((r, i) => {
    if (key(r) !== previousKey) position = i + 1;
    previousKey = key(r);
    return {
      ...r,
      position,
      tiedWith: (groups.get(key(r)) ?? []).filter((id) => id !== r.designId),
      consensus: r.pickedBy >= CONSENSUS_MIN_MEMBERS,
    };
  });
}

export type ShortlistCut = {
  /** Designs certainly in. */
  included: Standing[];
  /** A tie straddling the cut: the admin must choose `seatsLeft` of these (tie-break 3). */
  needsDecision: { candidates: Standing[]; seatsLeft: number } | null;
};

export function cutShortlist(standings: Standing[], size: number): ShortlistCut {
  if (standings.length <= size) return { included: standings, needsDecision: null };
  const boundary = standings[size - 1]!;
  const next = standings[size]!;
  if (boundary.position !== next.position) {
    return { included: standings.slice(0, size), needsDecision: null };
  }
  const included = standings.filter((s) => s.position < boundary.position);
  const candidates = standings.filter((s) => s.position === boundary.position);
  return { included, needsDecision: { candidates, seatsLeft: size - included.length } };
}
