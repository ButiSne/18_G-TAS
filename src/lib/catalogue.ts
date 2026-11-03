// The design catalogue (CLAUDE.md §8): loading, filtering and ordering. At this scale
// (tens to a few hundred designs) everything loads once and filters in memory, which keeps
// the rules in pure, tested functions.

import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { createDb } from "../db/client.ts";
import { collection, colourway, design } from "../db/schema.ts";
import { inLine, LINES, type Line } from "./design-line.ts";
import { TEE_COLOURS, type TeeColour } from "../ingest/tee-colour.ts";

type Db = ReturnType<typeof createDb>;

export type CatalogueColourway = {
  id: string;
  name: string;
  imageUrl: string;
  thumbUrl: string;
  blurDataUrl: string | null;
  teeColour: string | null;
  views: { imageUrl: string; thumbUrl: string }[];
};

export type CatalogueDesign = {
  id: string;
  slug: string;
  title: string;
  line: Line;
  tags: string[];
  printMethod: string | null;
  collection: { slug: string; title: string } | null;
  colourways: CatalogueColourway[];
};

export async function loadCatalogue(db: Db): Promise<CatalogueDesign[]> {
  const designs = await db
    .select({
      id: design.id,
      slug: design.slug,
      title: design.title,
      line: design.line,
      tags: design.tags,
      printMethod: design.printMethod,
      collectionSlug: collection.slug,
      collectionTitle: collection.title,
      collectionOrder: collection.sortOrder,
    })
    .from(design)
    .leftJoin(collection, eq(collection.id, design.collectionId))
    .where(eq(design.hidden, false))
    .orderBy(asc(collection.sortOrder), asc(design.slug));
  const colourways = await db
    .select({
      id: colourway.id,
      designId: colourway.designId,
      name: colourway.name,
      imageUrl: colourway.imageUrl,
      thumbUrl: colourway.thumbUrl,
      blurDataUrl: colourway.blurDataUrl,
      teeColour: colourway.teeColour,
      views: colourway.views,
    })
    .from(colourway)
    .orderBy(asc(colourway.sortOrder));

  const byDesign = new Map<string, CatalogueColourway[]>();
  for (const { designId, ...c } of colourways) {
    byDesign.set(designId, [...(byDesign.get(designId) ?? []), c]);
  }
  return designs
    .map((d) => ({
      id: d.id,
      slug: d.slug,
      title: d.title,
      line: d.line,
      tags: d.tags,
      printMethod: d.printMethod,
      collection: d.collectionSlug ? { slug: d.collectionSlug, title: d.collectionTitle! } : null,
      colourways: byDesign.get(d.id) ?? [],
    }))
    .filter((d) => d.colourways.length > 0);
}

// --- Filters (URL search params, so a filtered view can be shared) ---------------

export type CatalogueFilters = {
  line?: Line;
  collection?: string;
  colour?: TeeColour;
  print?: string;
  q?: string;
  seed?: string;
};

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const slugish = z.string().regex(/^[a-z0-9-]{1,60}$/);

export function parseFilters(
  params: Record<string, string | string[] | undefined>,
): CatalogueFilters {
  const out: CatalogueFilters = {};
  const line = z.enum(LINES).safeParse(first(params.line));
  if (line.success) out.line = line.data;
  const col = slugish.safeParse(first(params.collection));
  if (col.success) out.collection = col.data;
  const colour = z.enum(TEE_COLOURS).safeParse(first(params.colour));
  if (colour.success) out.colour = colour.data;
  const print = z
    .string()
    .regex(/^[a-z_]{1,30}$/)
    .safeParse(first(params.print));
  if (print.success) out.print = print.data;
  const q = z.string().trim().min(1).max(60).safeParse(first(params.q));
  if (q.success) out.q = q.data;
  const seed = z
    .string()
    .regex(/^[a-z0-9]{1,12}$/)
    .safeParse(first(params.seed));
  if (seed.success) out.seed = seed.data;
  return out;
}

export function applyFilters(designs: CatalogueDesign[], f: CatalogueFilters): CatalogueDesign[] {
  const q = f.q?.toLowerCase();
  const kept = designs.filter(
    (d) =>
      (!f.line || inLine(d, f.line)) &&
      (!f.collection || d.collection?.slug === f.collection) &&
      (!f.colour || d.colourways.some((c) => c.teeColour === f.colour)) &&
      (!f.print || d.printMethod === f.print) &&
      (!q || d.title.toLowerCase().includes(q) || d.tags.some((t) => t.toLowerCase().includes(q))),
  );
  return f.seed ? seededShuffle(kept, f.seed) : kept;
}

/** Builds a catalogue URL from filters, dropping empty ones. */
export function catalogueHref(f: CatalogueFilters, change: Partial<CatalogueFilters> = {}): string {
  const merged = { ...f, ...change };
  const params = new URLSearchParams();
  for (const key of ["line", "collection", "colour", "print", "q", "seed"] as const) {
    const v = merged[key];
    if (v) params.set(key, v);
  }
  const s = params.toString();
  return s ? `/designs?${s}` : "/designs";
}

// --- Shuffle: random, but stable for one seed so the order holds while scrolling --

function seedNumber(seed: string): number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function seededShuffle<T>(items: T[], seed: string): T[] {
  let s = seedNumber(seed) || 1;
  const random = () => {
    // mulberry32
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export const newSeed = () => Math.random().toString(36).slice(2, 8);

/** Swatch colours for tee-colour dots, as the tees look in the mockups. */
export const TEE_SWATCH: Record<TeeColour, string> = {
  Black: "#111111",
  White: "#f2f2f0",
  Cream: "#e6dabd",
  Grey: "#4a4e57",
  Navy: "#1f2a44",
  Green: "#14402c",
  Maroon: "#561322",
  Purple: "#3a2156",
  Olive: "#555a26",
  Sand: "#c4ad86",
};

export const swatchFor = (teeColour: string | null) =>
  (teeColour && TEE_SWATCH[teeColour as TeeColour]) || "#888888";
