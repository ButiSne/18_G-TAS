// Ingest orchestration (CLAUDE.md §4). planIngest() reads the archive and decides
// everything; applyPlan() uploads images and writes the database. --dry-run stops after
// planning, so the report the owner reviews is produced by the same code as a real run.

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { and, eq } from "drizzle-orm";
import type { createDb } from "../db/client.ts";
import { CROSSOVER_TAG } from "../lib/design-line.ts";
import { collection, colourway, design } from "../db/schema.ts";
import { brandFlags } from "./brand-check.ts";
import { classify, toArchivePath, type FileKind } from "./classify.ts";
import { findDuplicates } from "./duplicates.ts";
import { groupFamilies, slugify, type Collection } from "./family.ts";
import { renderImage, sampleSleeveColour, sha256 } from "./images.ts";
import { assignLine, type LineDecision, type LineOverrides } from "./line.ts";
import { matchPrintMasters } from "./print-match.ts";
import type { ImageStore } from "./storage.ts";
import {
  nameLetteredColourways,
  nearestTeeColour,
  teeColourFromName,
  type TeeColour,
} from "./tee-colour.ts";

type Db = ReturnType<typeof createDb>;

export type PlannedColourway = {
  path: string;
  name: string;
  hash: string;
  teeColour: TeeColour | null;
  teeColourSource: "sampled" | "name" | null;
  /** The colour the file name suggests, kept so the report can show disagreements. */
  nameColour: TeeColour | null;
  printFiles: string[];
  detailPaths: string[];
};

export type PlannedFamily = {
  key: string;
  slug: string;
  title: string;
  collection: Collection;
  line: LineDecision;
  brandFlags: string[];
  notes: string[];
  colourways: PlannedColourway[];
  familyPrintFiles: string[];
};

export type Plan = {
  archiveDir: string;
  counts: Record<FileKind, number>;
  families: PlannedFamily[];
  unmatchedImages: string[];
  unmatchedPrints: string[];
  duplicates: { path: string; duplicateOf: string }[];
  unknown: string[];
  sheets: string[];
};

export type Counts = { inserted: number; updated: number; unchanged: number };
export type IngestStats = {
  collections: Counts;
  designs: Counts;
  colourways: Counts;
  images: { uploaded: number; alreadyStored: number };
  skippedNoLine: string[];
};

async function listFiles(archiveDir: string): Promise<string[]> {
  const entries = await readdir(archiveDir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => toArchivePath(relative(archiveDir, join(e.parentPath, e.name))))
    .sort();
}

export async function planIngest(archiveDir: string, overrides: LineOverrides): Promise<Plan> {
  const paths = await listFiles(archiveDir);
  const kinds = new Map(paths.map((p) => [p, classify(p)]));
  const counts = { display: 0, detail: 0, print_master: 0, sheet: 0, ignore: 0, unknown: 0 };
  for (const kind of kinds.values()) counts[kind]++;
  const ofKind = (...k: FileKind[]) => paths.filter((p) => k.includes(kinds.get(p)!));

  const bytes = new Map<string, Buffer>();
  for (const p of ofKind("display", "detail")) bytes.set(p, await readFile(join(archiveDir, p)));
  const hashes = new Map([...bytes].map(([p, b]) => [p, sha256(b)]));

  const { keep, duplicates } = findDuplicates([...hashes].map(([path, hash]) => ({ path, hash })));
  const { families, unmatched } = groupFamilies(keep.map((f) => f.path));
  const prints = matchPrintMasters(families, ofKind("print_master"));

  const planned: PlannedFamily[] = [];
  for (const f of families) {
    const teeColours: {
      colour: TeeColour | null;
      source: "sampled" | "name" | null;
      fromName: TeeColour | null;
    }[] = [];
    for (const c of f.colourways) {
      const sampled = nearestTeeColour(await sampleSleeveColour(bytes.get(c.path)!));
      const fromName = teeColourFromName(c.tokens);
      teeColours.push({
        colour: sampled ?? fromName,
        source: sampled ? "sampled" : fromName ? "name" : null,
        fromName,
      });
    }
    const names = nameLetteredColourways(
      f.colourways.map((c, i) => ({
        letter: c.letter,
        name: c.name,
        teeColour: teeColours[i]!.colour,
      })),
    );
    const colourways = f.colourways.map((c, i) => ({
      path: c.path,
      name: names[i]!,
      hash: hashes.get(c.path)!,
      teeColour: teeColours[i]!.colour,
      teeColourSource: teeColours[i]!.source,
      nameColour: teeColours[i]!.fromName,
      printFiles: prints.byColourway.get(c.path) ?? [],
      detailPaths: c.detailPaths,
    }));
    planned.push({
      key: f.key,
      slug: f.slug,
      title: f.title,
      collection: f.collection,
      line: assignLine(f, overrides),
      brandFlags: [...new Set([f.title, ...colourways.map((c) => c.name)].flatMap(brandFlags))],
      notes: f.notes,
      colourways,
      familyPrintFiles: prints.byFamily.get(f.key) ?? [],
    });
  }

  return {
    archiveDir,
    counts,
    families: planned,
    unmatchedImages: unmatched,
    unmatchedPrints: prints.unmatched,
    duplicates,
    unknown: ofKind("unknown"),
    sheets: ofKind("sheet"),
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const zero = (): Counts => ({ inserted: 0, updated: 0, unchanged: 0 });

/**
 * Writes the plan. Idempotent: a second run with the same archive changes nothing.
 * Title, line and slug are written only when a design is first created, because the admin
 * edits them afterwards (/admin/designs) and a re-run must not undo that.
 */
export async function applyPlan(
  plan: Plan,
  { db, store, log = () => {} }: { db: Db; store: ImageStore; log?: (line: string) => void },
): Promise<IngestStats> {
  const stats: IngestStats = {
    collections: zero(),
    designs: zero(),
    colourways: zero(),
    images: { uploaded: 0, alreadyStored: 0 },
    skippedNoLine: [],
  };

  const storeImage = async (pathname: string, body: Buffer) => {
    const r = await store.put(pathname, body, "image/webp");
    stats.images[r.uploaded ? "uploaded" : "alreadyStored"]++;
    return r.url;
  };

  const collections = [
    ...new Map(plan.families.map((f) => [f.collection.slug, f.collection])).values(),
  ].sort((a, b) => a.slug.localeCompare(b.slug));
  const collectionIds = new Map<string, string>();
  for (const [i, c] of collections.entries()) {
    const [existing] = await db.select().from(collection).where(eq(collection.slug, c.slug));
    if (existing) {
      collectionIds.set(c.slug, existing.id);
      stats.collections.unchanged++;
    } else {
      const [row] = await db
        .insert(collection)
        .values({ slug: c.slug, title: c.title, roundLabel: c.title, sortOrder: i })
        .returning({ id: collection.id });
      collectionIds.set(c.slug, row!.id);
      stats.collections.inserted++;
    }
  }

  for (const family of plan.families) {
    if (family.line.line === null) {
      stats.skippedNoLine.push(family.key);
      continue;
    }
    const collectionId = collectionIds.get(family.collection.slug)!;
    const [existing] = await db.select().from(design).where(eq(design.familyKey, family.key));
    let designId: string;
    if (!existing) {
      const [row] = await db
        .insert(design)
        .values({
          slug: family.slug,
          familyKey: family.key,
          title: family.title,
          line: family.line.line,
          collectionId,
          printFiles: family.familyPrintFiles,
          tags: family.line.crossover ? [CROSSOVER_TAG] : [],
        })
        .returning({ id: design.id });
      designId = row!.id;
      stats.designs.inserted++;
    } else {
      designId = existing.id;
      if (
        existing.collectionId !== collectionId ||
        !same(existing.printFiles, family.familyPrintFiles)
      ) {
        await db
          .update(design)
          .set({ collectionId, printFiles: family.familyPrintFiles })
          .where(eq(design.id, designId));
        stats.designs.updated++;
      } else stats.designs.unchanged++;
    }

    for (const [sortOrder, c] of family.colourways.entries()) {
      const [current] = await db
        .select()
        .from(colourway)
        .where(and(eq(colourway.designId, designId), eq(colourway.imageHash, c.hash)));
      const fields = {
        designId,
        name: c.name,
        printFiles: c.printFiles,
        sortOrder,
        teeColour: c.teeColour,
      };

      let images: Pick<
        typeof colourway.$inferInsert,
        "imageUrl" | "thumbUrl" | "blurDataUrl" | "views"
      > | null = null;
      if (!current || current.views.length !== c.detailPaths.length) {
        const base = `designs/${family.slug}/${slugify(c.name)}`;
        const main = await renderImage(await readFile(join(plan.archiveDir, c.path)));
        const views = [];
        for (const [n, detail] of c.detailPaths.entries()) {
          const v = await renderImage(await readFile(join(plan.archiveDir, detail)));
          views.push({
            imageUrl: await storeImage(`${base}-detail-${n + 1}-1600.webp`, v.full),
            thumbUrl: await storeImage(`${base}-detail-${n + 1}-480.webp`, v.thumb),
          });
        }
        images = {
          imageUrl: await storeImage(`${base}-1600.webp`, main.full),
          thumbUrl: await storeImage(`${base}-480.webp`, main.thumb),
          blurDataUrl: main.blurDataUrl,
          views,
        };
      }

      if (!current) {
        await db.insert(colourway).values({ ...fields, ...images!, imageHash: c.hash });
        stats.colourways.inserted++;
      } else {
        const changed = (Object.keys(fields) as (keyof typeof fields)[]).some(
          (k) => !same(current[k], fields[k]),
        );
        if (changed || images) {
          await db
            .update(colourway)
            .set({ ...fields, ...(images ?? {}) })
            .where(eq(colourway.id, current.id));
          stats.colourways.updated++;
        } else stats.colourways.unchanged++;
      }
    }
    log(`✓ ${family.key} ${family.title} (${family.colourways.length} colourways)`);
  }
  return stats;
}
