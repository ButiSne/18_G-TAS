// The landing page's "first look": how many new designs there are, per line, and a strip
// of blurred previews. The previews are the 16 px placeholders stored at ingest, shown
// heavily blurred: they tease colour and mood without revealing any design before the
// public vote, and they cost almost no data (inline, no image requests).

import { and, asc, eq } from "drizzle-orm";
import { colourway, design } from "@/src/db/schema";
import { getDb } from "@/src/db/server";
import type { Line } from "./design-line";

export type Teaser = { id: string; line: Line; blur: string };
export type Showcase = { total: number; byLine: Record<Line, number>; teasers: Teaser[] };

export const EMPTY_SHOWCASE: Showcase = {
  total: 0,
  byLine: { EITEEN: 0, "G-TAS": 0 },
  teasers: [],
};

type Row = { id: string; line: Line; blur: string | null };

/** Counts per line, and teasers alternating EITEEN / G-TAS so the strip mixes both moods. */
export function summarise(rows: Row[], limit: number): Showcase {
  const byLine: Record<Line, number> = { EITEEN: 0, "G-TAS": 0 };
  for (const r of rows) byLine[r.line]++;

  const queues: Record<Line, Teaser[]> = { EITEEN: [], "G-TAS": [] };
  for (const r of rows) if (r.blur) queues[r.line].push({ id: r.id, line: r.line, blur: r.blur });
  const teasers: Teaser[] = [];
  while (teasers.length < limit && (queues.EITEEN.length || queues["G-TAS"].length)) {
    for (const line of ["EITEEN", "G-TAS"] as const) {
      const next = queues[line].shift();
      if (next && teasers.length < limit) teasers.push(next);
    }
  }
  return { total: rows.length, byLine, teasers };
}

export async function getShowcase(limit = 16): Promise<Showcase> {
  const db = getDb();
  if (!db) return EMPTY_SHOWCASE;
  try {
    const rows = await db
      .select({ id: design.id, line: design.line, blur: colourway.blurDataUrl })
      .from(design)
      .innerJoin(colourway, and(eq(colourway.designId, design.id), eq(colourway.sortOrder, 0)))
      .where(eq(design.hidden, false))
      .orderBy(asc(design.slug));
    return summarise(rows, limit);
  } catch (error) {
    // The landing page must never fail because the database is unreachable.
    console.error("[showcase] falling back to no live data:", (error as Error).message);
    return EMPTY_SHOWCASE;
  }
}
