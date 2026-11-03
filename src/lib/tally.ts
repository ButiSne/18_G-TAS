export type FavouriteVote = { entryId: string; ref: string | null; ageBracket: string | null };

export type EntryResult = { entryId: string; votes: number; percent: number };

/** Favourite-mode results: one vote per device, so a count is a share of voters. */
export function tallyFavourites(votes: FavouriteVote[]): EntryResult[] {
  const counts = new Map<string, number>();
  for (const v of votes) counts.set(v.entryId, (counts.get(v.entryId) ?? 0) + 1);
  const total = votes.length;
  return [...counts.entries()]
    .map(([entryId, n]) => ({
      entryId,
      votes: n,
      percent: total === 0 ? 0 : Math.round((n / total) * 1000) / 10,
    }))
    .sort((a, b) => b.votes - a.votes || a.entryId.localeCompare(b.entryId));
}

/**
 * Splits results by share channel (`?ref=`), so Facebook and each WhatsApp group can
 * be read separately. A missing ref is kept as "direct", never dropped: a vote with
 * no ref is still a vote.
 */
export function tallyByRef(votes: FavouriteVote[]): Record<string, EntryResult[]> {
  const byRef = new Map<string, FavouriteVote[]>();
  for (const v of votes) {
    const ref = v.ref ?? "direct";
    byRef.set(ref, [...(byRef.get(ref) ?? []), v]);
  }
  return Object.fromEntries([...byRef.entries()].map(([ref, vs]) => [ref, tallyFavourites(vs)]));
}

const REF_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** Refs come from a URL anyone can edit; keep only short slugs, never free text. */
export function normaliseRef(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const ref = raw.trim().toLowerCase();
  return REF_PATTERN.test(ref) ? ref : null;
}
