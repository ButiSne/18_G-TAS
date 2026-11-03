// CLAUDE.md §6: design titles must not use club, federation or kit-maker names.
// Matching is whole-word only, so "LV" does not flag "SILVER" and "Puma" does not flag
// "Pumalanga".

export const BANNED_NAMES = [
  "Pirates",
  "Chiefs",
  "Sundowns",
  "Bafana",
  "SAFA",
  "adidas",
  "Kappa",
  "Puma",
  "Givenchy",
  "Fendi",
  "LV",
  "Galxboy",
] as const;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PATTERNS = BANNED_NAMES.map(
  (name) =>
    [name, new RegExp(`(?<![\\p{L}\\p{N}])${escape(name)}(?![\\p{L}\\p{N}])`, "iu")] as const,
);

/** Returns the banned names found in `text` (underscores count as spaces). */
export function brandFlags(text: string): string[] {
  const spaced = text.replace(/_/g, " ");
  return PATTERNS.filter(([, re]) => re.test(spaced)).map(([name]) => name);
}
