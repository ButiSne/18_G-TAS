// The Blob-ready design pack (archive/ALL DESIGN IMAGES/18GTAS_Blob_Ready): every design
// rebuilt singly on a tee mockup, with a manifest.json that states range, collection, print
// method, placement, tee colour and status outright. That replaces the filename guessing
// of the archive ingest (src/ingest/run.ts) for everything the pack covers.
//
// One design per `family`, one colourway per front record; back views attach to their
// front colourway. Superseded families stay in the database for the record, hidden.
// Pure functions: the runner (manifest-run.ts) does the reading, uploading and writing.

import { z } from "zod";
import {
  isPlacement,
  isPrintMethod,
  type Placement,
  type PrintMethod,
} from "../lib/print-methods.ts";
import { brandFlags } from "./brand-check.ts";
import {
  nameLetteredColourways,
  normaliseHex,
  teeColourFromHex,
  type TeeColour,
} from "./tee-colour.ts";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const relPath = z
  .string()
  .min(1)
  .refine((p) => !p.startsWith("/") && !p.split("/").includes(".."), "relative path");

export const manifestRecordSchema = z.object({
  slug,
  title: z.string().trim().min(1),
  range: z.enum(["EITEEN", "G-TAS"]),
  collection: slug,
  collection_title: z.string().trim().min(1),
  view: z.enum(["front", "back"]),
  product: z.string().trim().min(1),
  placement: z.string(),
  print_method: z.string(),
  tee_colour: z.string(),
  colourway: z.string().nullable(),
  status: z.enum(["active", "superseded"]),
  status_note: z.string().nullable(),
  image: relPath,
  thumb: relPath,
  blob_pathname: relPath,
  blob_thumb_pathname: relPath,
  print_master_png: z.string().nullable(),
  print_master_pdf: z.string().nullable(),
  family: slug,
});
export type ManifestRecord = z.infer<typeof manifestRecordSchema>;

export const manifestSchema = z.object({ designs: z.array(manifestRecordSchema).min(1) });

export type PackView = {
  image: string;
  thumb: string;
  blobPathname: string;
  blobThumbPathname: string;
  label: string;
};

export type PackColourway = PackView & {
  slug: string;
  name: string;
  teeColour: TeeColour | null;
  teeHex: string | null;
  printFiles: string[];
  /** Back views (and any extra fronts) of this colourway. */
  views: PackView[];
};

export type PackFamily = {
  key: string;
  slug: string;
  title: string;
  line: "EITEEN" | "G-TAS";
  collection: { slug: string; title: string; sortOrder: number };
  printMethod: PrintMethod | null;
  placement: Placement | null;
  product: string;
  /** Every record superseded: kept for the record, never shown or voted on. */
  hidden: boolean;
  statusNote: string | null;
  brandFlags: string[];
  colourways: PackColourway[];
};

export type PackPlan = {
  families: PackFamily[];
  collections: PackFamily["collection"][];
  /** Problems a person should look at; none of them stops the import. */
  issues: string[];
};

/** "Kasi Halo A" → "Kasi Halo" when the record is colourway A. */
export function familyTitle(title: string, colourway: string | null): string {
  if (!colourway) return title.trim();
  const suffix = new RegExp(`\\s+${colourway.replace(/[^A-Za-z0-9]/g, "")}$`, "i");
  return title.trim().replace(suffix, "");
}

const BACK_LABEL = "Back";

export function planPack(records: ManifestRecord[]): PackPlan {
  const issues: string[] = [];
  const byFamily = new Map<string, ManifestRecord[]>();
  for (const r of records) byFamily.set(r.family, [...(byFamily.get(r.family) ?? []), r]);

  // Collections keep the order they first appear in the manifest.
  const collections = new Map<string, PackFamily["collection"]>();
  for (const r of records) {
    if (!collections.has(r.collection))
      collections.set(r.collection, {
        slug: r.collection,
        title: r.collection_title,
        sortOrder: collections.size,
      });
  }

  const families: PackFamily[] = [];
  for (const [key, rs] of byFamily) {
    const fronts = rs.filter((r) => r.view === "front");
    const backs = rs.filter((r) => r.view === "back");
    // A family photographed only from the back (Pinstripes Velvet) shows its back.
    const main = fronts.length ? fronts : backs;
    const extra = fronts.length ? backs : [];
    const lead = main[0]!;

    for (const field of ["range", "collection", "print_method", "product"] as const) {
      if (new Set(rs.map((r) => r[field])).size > 1)
        issues.push(`${key}: records disagree on ${field}; used "${lead[field]}".`);
    }
    const printMethod = isPrintMethod(lead.print_method) ? lead.print_method : null;
    if (!printMethod) issues.push(`${key}: unknown print method "${lead.print_method}".`);
    const placement = isPlacement(lead.placement) ? lead.placement : null;
    if (!placement) issues.push(`${key}: unknown placement "${lead.placement}".`);

    const teeColours = main.map((r) => teeColourFromHex(r.tee_colour));
    main.forEach((r, i) => {
      if (!teeColours[i])
        issues.push(`${r.slug}: tee colour "${r.tee_colour}" is not a hex colour.`);
    });
    const names = nameLetteredColourways(
      main.map((r, i) => ({
        letter: r.colourway,
        name: r.colourway ?? teeColours[i] ?? "Original",
        teeColour: teeColours[i] ?? null,
      })),
    );

    const colourways: PackColourway[] = main.map((r, i) => ({
      slug: r.slug,
      name: names[i]!,
      teeColour: teeColours[i] ?? null,
      teeHex: normaliseHex(r.tee_colour),
      printFiles: printFilesOf(r),
      image: r.image,
      thumb: r.thumb,
      blobPathname: r.blob_pathname,
      blobThumbPathname: r.blob_thumb_pathname,
      label: r.view === "back" ? BACK_LABEL : "Front",
      views: [],
    }));
    for (const b of extra) {
      // A back belongs to the front of the same colourway, else to the first front.
      const target =
        colourways[main.findIndex((f) => f.colourway === b.colourway)] ?? colourways[0]!;
      target.views.push({
        image: b.image,
        thumb: b.thumb,
        blobPathname: b.blob_pathname,
        blobThumbPathname: b.blob_thumb_pathname,
        label: BACK_LABEL,
      });
      target.printFiles = [...new Set([...target.printFiles, ...printFilesOf(b)])];
    }

    const title = familyTitle(lead.title, lead.colourway);
    const hidden = rs.every((r) => r.status === "superseded");
    families.push({
      key,
      slug: key,
      title,
      line: lead.range,
      collection: collections.get(lead.collection)!,
      printMethod,
      placement,
      product: lead.product,
      hidden,
      statusNote: hidden ? (rs.find((r) => r.status_note)?.status_note ?? null) : null,
      brandFlags: [...new Set([title, ...colourways.map((c) => c.name)].flatMap(brandFlags))],
      colourways,
    });
  }

  for (const f of families)
    if (f.brandFlags.length) issues.push(`${f.key}: title mentions ${f.brandFlags.join(", ")}.`);

  return { families, collections: [...collections.values()], issues };
}

function printFilesOf(r: ManifestRecord): string[] {
  return [r.print_master_png, r.print_master_pdf].filter((p): p is string => Boolean(p));
}

/** Old archive-ingest family keys look like "tee-collection-72/t07"; pack keys have no "/". */
export const isArchiveFamilyKey = (key: string | null) => key !== null && key.includes("/");
