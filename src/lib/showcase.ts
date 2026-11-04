// The landing page's "first look", from the database, in two stages:
// - Teaser (before the team has confirmed a shortlist): how many new designs there are per
//   line, and a strip of heavily blurred previews (the 16 px placeholders from ingest).
//   They tease colour and mood without revealing any design, and cost almost no data.
// - Shortlist (once the team's shortlist is confirmed): the real images of the shortlisted
//   designs only, and the state of the public vote, so the page can say "vote now".

import { and, asc, eq } from "drizzle-orm";
import { colourway, design } from "@/src/db/schema";
import { getDb } from "@/src/db/server";
import { inLine, type Line } from "./design-line";
import { currentPublicRound, publicEntries } from "./stages";

export type Teaser = { id: string; line: Line; blur: string };

/** Public vote status as the landing page talks about it. */
export type VotingState = "none" | "soon" | "open" | "closed" | "published";

export type ShortlistCard = {
  designId: string;
  slug: string;
  title: string;
  line: Line;
  tags: string[];
  colourwayName: string;
  thumbUrl: string;
  blurDataUrl: string | null;
};

export type Showcase = {
  total: number;
  byLine: Record<Line, number>;
  teasers: Teaser[];
  voting: VotingState;
  /** Empty until the team's shortlist is confirmed. */
  shortlist: ShortlistCard[];
};

export const EMPTY_SHOWCASE: Showcase = {
  total: 0,
  byLine: { EITEEN: 0, "G-TAS": 0 },
  teasers: [],
  voting: "none",
  shortlist: [],
};

type Row = { id: string; line: Line; blur: string | null };

/** Counts per line, and teasers alternating EITEEN / G-TAS so the strip mixes both moods. */
export function summarise(
  rows: Row[],
  limit: number,
): Pick<Showcase, "total" | "byLine" | "teasers"> {
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

/** A public round's status, as the landing page and collection pages present it. */
export function votingState(status: string | null | undefined): VotingState {
  if (!status) return "none";
  if (status === "draft") return "soon";
  return status === "open" || status === "closed" || status === "published" ? status : "none";
}

/** The shortlisted designs of one line (crossovers count in both). */
export const shortlistFor = (show: Showcase, line: Line) =>
  show.shortlist.filter((c) => inLine(c, line));

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
    const pr = await currentPublicRound(db);
    const shortlist: ShortlistCard[] = pr
      ? (await publicEntries(db, pr.id))
          .filter((e) => e.thumbUrl)
          .map((e) => ({
            designId: e.designId,
            slug: e.slug,
            title: e.title,
            line: e.line,
            tags: e.tags,
            colourwayName: e.colourwayName,
            thumbUrl: e.thumbUrl,
            blurDataUrl: e.blurDataUrl,
          }))
      : [];
    return { ...summarise(rows, limit), voting: votingState(pr?.status), shortlist };
  } catch (error) {
    // The landing page must never fail because the database is unreachable.
    console.error("[showcase] falling back to no live data:", (error as Error).message);
    return EMPTY_SHOWCASE;
  }
}
