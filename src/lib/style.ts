// "Your style" at the end of the swipe deck (CLAUDE.md §0.7): a label from this phone's
// own YEBOs only, never from anyone else's votes, so it reveals no crowd standings.

import type { Line } from "./design-line";

export type StyleKey = "street" | "luxe" | "classic" | "picky";

/** ≥ 70% of YEBOs in one line names that line's style; a mix is "Kasi Classic". */
export function styleFor(liked: { line: Line }[]): StyleKey {
  if (liked.length === 0) return "picky";
  const eiteen = liked.filter((d) => d.line === "EITEEN").length / liked.length;
  if (eiteen >= 0.7) return "street";
  if (eiteen <= 0.3) return "luxe";
  return "classic";
}
