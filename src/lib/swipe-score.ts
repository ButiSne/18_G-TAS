// Ranking for the swipe vote (CLAUDE.md §0.7). A design's YEBO rate is likes ÷ swipes,
// but rates from few swipes are noisy, and voters may stop part-way, so designs end up
// with different numbers of swipes. The Wilson score lower bound (95%) ranks by the rate
// we can be confident of: 8 YEBO out of 10 ranks below 70 out of 100.
// Tie-breaks: more "number one" votes, then more YEBOs. Anything still tied is reported,
// never resolved silently.

export function wilsonLowerBound(likes: number, total: number, z = 1.96): number {
  if (total <= 0) return 0;
  const p = likes / total;
  const z2 = z * z;
  const centre = p + z2 / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
  return (centre - margin) / (1 + z2 / total);
}

export type EntryTally = { entryId: string; likes: number; passes: number; numberOne: number };

export type RankedEntry = EntryTally & {
  swipes: number;
  likeRate: number;
  score: number;
  position: number;
  tiedWith: string[];
};

export function rankSwipes(tallies: EntryTally[]): RankedEntry[] {
  const rows = tallies.map((t) => {
    const swipes = t.likes + t.passes;
    return {
      ...t,
      swipes,
      likeRate: swipes ? t.likes / swipes : 0,
      score: wilsonLowerBound(t.likes, swipes),
    };
  });
  // Scores are compared rounded, so floating-point noise never splits a real tie.
  const key = (r: (typeof rows)[number]) => `${r.score.toFixed(9)}|${r.numberOne}|${r.likes}`;
  rows.sort(
    (a, b) =>
      b.score - a.score ||
      b.numberOne - a.numberOne ||
      b.likes - a.likes ||
      a.entryId.localeCompare(b.entryId),
  );
  const groups = new Map<string, string[]>();
  for (const r of rows) groups.set(key(r), [...(groups.get(key(r)) ?? []), r.entryId]);
  let position = 0;
  let previous = "";
  return rows.map((r, i) => {
    if (key(r) !== previous) position = i + 1;
    previous = key(r);
    return {
      ...r,
      position,
      tiedWith: (groups.get(key(r)) ?? []).filter((id) => id !== r.entryId),
    };
  });
}
