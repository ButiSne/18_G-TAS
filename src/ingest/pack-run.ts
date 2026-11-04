// Loads the Blob-ready design pack (src/ingest/manifest.ts) into the database and the
// image store. Idempotent: a second run with the same pack uploads and changes nothing.
//
// Titles, slugs, lines and print methods are written when a design is first created and
// then left alone, because the admin edits them in /admin/designs. Everything the pack is
// the authority on (collection, placement, images, tee colours, print files) is kept in sync.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { and, eq, inArray, isNotNull, like, notInArray, sql } from "drizzle-orm";
import sharp from "sharp";
import type { createDb } from "../db/client.ts";
import {
  collection,
  colourway,
  design,
  finalSelection,
  memberPick,
  publicEntry,
  shortlist,
  type ColourwayView,
} from "../db/schema.ts";
import { audit } from "../lib/audit.ts";
import { sha256 } from "./images.ts";
import type { PackFamily, PackPlan, PackView } from "./manifest.ts";
import type { ImageStore } from "./storage.ts";

type Db = ReturnType<typeof createDb>;
type Counts = { inserted: number; updated: number; unchanged: number };
const zero = (): Counts => ({ inserted: 0, updated: 0, unchanged: 0 });
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export type PackStats = {
  collections: Counts;
  designs: Counts;
  colourways: Counts & { removed: number };
  images: { uploaded: number; alreadyStored: number };
  duplicates: string[];
  retired: { deleted: string[]; hidden: string[] };
};

/** Runs `fn` over `items`, at most `limit` at a time. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

async function blurOf(bytes: Buffer) {
  const blur = await sharp(bytes).resize({ width: 16 }).webp({ quality: 40 }).toBuffer();
  return `data:image/webp;base64,${blur.toString("base64")}`;
}

export async function applyPack(
  plan: PackPlan,
  opts: {
    db: Db;
    store: ImageStore;
    packDir: string;
    /** Retire designs from the old archive ingest that the pack replaces. */
    retireArchive?: boolean;
    concurrency?: number;
    log?: (line: string) => void;
  },
): Promise<PackStats> {
  const { db, store, packDir, log = () => {} } = opts;
  const stats: PackStats = {
    collections: zero(),
    designs: zero(),
    colourways: { ...zero(), removed: 0 },
    images: { uploaded: 0, alreadyStored: 0 },
    duplicates: [],
    retired: { deleted: [], hidden: [] },
  };
  const sync = async (pathname: string, file: string) => {
    const r = await store.sync(pathname, await readFile(join(packDir, file)), "image/webp");
    stats.images[r.uploaded ? "uploaded" : "alreadyStored"]++;
    return r.url;
  };
  const syncView = async (v: PackView): Promise<ColourwayView> => ({
    imageUrl: await sync(v.blobPathname, v.image),
    thumbUrl: await sync(v.blobThumbPathname, v.thumb),
    label: v.label,
  });

  // --- Collections ---------------------------------------------------------------
  const collectionIds = new Map<string, string>();
  for (const c of plan.collections) {
    const [existing] = await db.select().from(collection).where(eq(collection.slug, c.slug));
    if (!existing) {
      const [row] = await db
        .insert(collection)
        .values({ slug: c.slug, title: c.title, roundLabel: c.title, sortOrder: c.sortOrder })
        .returning({ id: collection.id });
      collectionIds.set(c.slug, row!.id);
      stats.collections.inserted++;
    } else {
      collectionIds.set(c.slug, existing.id);
      if (existing.title !== c.title || existing.sortOrder !== c.sortOrder) {
        await db
          .update(collection)
          .set({ title: c.title, roundLabel: c.title, sortOrder: c.sortOrder })
          .where(eq(collection.id, existing.id));
        stats.collections.updated++;
      } else stats.collections.unchanged++;
    }
  }

  // --- Images: hash every file; upload only what the database doesn't have yet -------
  const hashes = new Map<string, string>(); // colourway slug → sha256 of the full image
  const seen = new Map<string, string>();
  for (const f of plan.families)
    for (const c of f.colourways) {
      const hash = sha256(await readFile(join(packDir, c.image)));
      const first = seen.get(hash);
      if (first) stats.duplicates.push(`${c.slug} is the same image as ${first}`);
      else seen.set(hash, c.slug);
      hashes.set(c.slug, hash);
    }
  const known = new Map(
    (
      await db
        .select()
        .from(colourway)
        .where(inArray(colourway.imageHash, [...seen.keys()]))
    ).map((row) => [row.imageHash, row]),
  );

  type Prepared = {
    imageUrl: string;
    thumbUrl: string;
    blurDataUrl: string;
    views: ColourwayView[];
  };
  const prepared = new Map<string, Prepared>();
  const todo = plan.families.flatMap((f) =>
    f.colourways.filter((c) => {
      const hash = hashes.get(c.slug)!;
      if (seen.get(hash) !== c.slug) return false; // a duplicate: skipped
      const row = known.get(hash);
      // Already stored with the same views: nothing to upload.
      return !(
        row &&
        row.blurDataUrl &&
        same(
          row.views.map((v) => v.label),
          c.views.map((v) => v.label),
        )
      );
    }),
  );
  log(`${todo.length} colourways need images (${seen.size - todo.length} already stored).`);
  let done = 0;
  await mapLimit(todo, opts.concurrency ?? 6, async (c) => {
    const bytes = await readFile(join(packDir, c.image));
    const views = [];
    for (const v of c.views) views.push(await syncView(v));
    prepared.set(c.slug, {
      imageUrl: await sync(c.blobPathname, c.image),
      thumbUrl: await sync(c.blobThumbPathname, c.thumb),
      blurDataUrl: await blurOf(bytes),
      views,
    });
    if (++done % 25 === 0) log(`  images ${done}/${todo.length}`);
  });

  // --- Designs and colourways ------------------------------------------------------
  for (const family of plan.families) {
    const designId = await upsertDesign(
      db,
      family,
      collectionIds.get(family.collection.slug)!,
      stats,
    );
    const keep: string[] = [];
    for (const [sortOrder, c] of family.colourways.entries()) {
      const hash = hashes.get(c.slug)!;
      if (seen.get(hash) !== c.slug) continue;
      keep.push(hash);
      const images = prepared.get(c.slug);
      const row = known.get(hash);
      const fields = {
        designId,
        name: c.name,
        teeColour: c.teeColour,
        teeHex: c.teeHex,
        printFiles: c.printFiles,
        sortOrder,
      };
      if (!row) {
        await db.insert(colourway).values({ ...fields, ...images!, imageHash: hash });
        stats.colourways.inserted++;
      } else {
        const changed = (Object.keys(fields) as (keyof typeof fields)[]).some(
          (k) => !same(row[k], fields[k]),
        );
        if (changed || images) {
          await db
            .update(colourway)
            .set({ ...fields, ...(images ?? {}) })
            .where(eq(colourway.id, row.id));
          stats.colourways.updated++;
        } else stats.colourways.unchanged++;
      }
    }
    // Colourways the pack no longer has (an image was redone) go, unless a public round
    // shows that exact colourway.
    const stale = await db
      .select({ id: colourway.id })
      .from(colourway)
      .where(
        and(
          eq(colourway.designId, designId),
          keep.length ? notInArray(colourway.imageHash, keep) : sql`true`,
          sql`NOT EXISTS (SELECT 1 FROM ${publicEntry} WHERE ${publicEntry.colourwayId} = ${colourway.id})`,
        ),
      );
    if (stale.length) {
      await db.delete(colourway).where(
        inArray(
          colourway.id,
          stale.map((s) => s.id),
        ),
      );
      stats.colourways.removed += stale.length;
    }
  }

  if (opts.retireArchive) await retireArchiveDesigns(db, stats, log);
  return stats;
}

async function upsertDesign(
  db: Db,
  family: PackFamily,
  collectionId: string,
  stats: PackStats,
): Promise<string> {
  const tags = family.product === "t-shirt" ? [] : [family.product];
  const [existing] = await db.select().from(design).where(eq(design.familyKey, family.key));
  if (!existing) {
    // Slugs are the family keys, which are unique in the pack; guard against an old row.
    const [taken] = await db
      .select({ id: design.id })
      .from(design)
      .where(eq(design.slug, family.slug));
    const [row] = await db
      .insert(design)
      .values({
        slug: taken ? `${family.slug}-pack` : family.slug,
        familyKey: family.key,
        title: family.title,
        line: family.line,
        collectionId,
        printMethod: family.printMethod,
        placement: family.placement,
        tags,
        hidden: family.hidden,
        description: family.statusNote,
      })
      .returning({ id: design.id });
    stats.designs.inserted++;
    return row!.id;
  }
  const next = {
    collectionId,
    placement: family.placement,
    // Filled in when empty; an admin's choice is never overwritten.
    printMethod: existing.printMethod ?? family.printMethod,
    tags: [...new Set([...existing.tags, ...tags])],
    // The pack can retire a design, but only the admin brings one back.
    hidden: existing.hidden || family.hidden,
    description: existing.description ?? family.statusNote,
  };
  const changed = (Object.keys(next) as (keyof typeof next)[]).some(
    (k) => !same(existing[k], next[k]),
  );
  if (changed) {
    await db.update(design).set(next).where(eq(design.id, existing.id));
    stats.designs.updated++;
  } else stats.designs.unchanged++;
  return existing.id;
}

/**
 * The old archive ingest made one design per "<collection>/<number>" family from the raw
 * zips. The pack redraws all of them, so they would show twice. A design nobody has picked,
 * shortlisted or voted on is deleted (its colourways go with it); any other is hidden, so
 * past rounds keep their history.
 */
async function retireArchiveDesigns(db: Db, stats: PackStats, log: (line: string) => void) {
  const old = await db
    .select({ id: design.id, familyKey: design.familyKey, hidden: design.hidden })
    .from(design)
    .where(and(isNotNull(design.familyKey), like(design.familyKey, "%/%")));
  for (const d of old) {
    const used = await db.execute<{ used: boolean }>(sql`SELECT
      EXISTS (SELECT 1 FROM ${memberPick} WHERE ${memberPick.designId} = ${d.id})
      OR EXISTS (SELECT 1 FROM ${shortlist} WHERE ${shortlist.designId} = ${d.id})
      OR EXISTS (SELECT 1 FROM ${publicEntry} WHERE ${publicEntry.designId} = ${d.id})
      OR EXISTS (SELECT 1 FROM ${finalSelection} WHERE ${finalSelection.designId} = ${d.id})
      AS used`);
    if (used[0]?.used) {
      if (!d.hidden) {
        await db.update(design).set({ hidden: true }).where(eq(design.id, d.id));
        stats.retired.hidden.push(d.familyKey!);
      }
    } else {
      await db.delete(design).where(eq(design.id, d.id));
      stats.retired.deleted.push(d.familyKey!);
    }
  }
  if (stats.retired.deleted.length || stats.retired.hidden.length) {
    await audit(db, null, "ingest.archive_retired", {
      deleted: stats.retired.deleted,
      hidden: stats.retired.hidden,
    });
    log(
      `Retired ${stats.retired.deleted.length} old archive designs (deleted) and hid ${stats.retired.hidden.length} that past rounds still use.`,
    );
  }
}
