// pnpm ingest:pack [--dry-run] [--pack=<folder with manifest.json>] [--store=blob|local]
//                  [--keep-archive]
//
// Loads the Blob-ready design pack: images go to Vercel Blob at the manifest's own
// pathnames (18gtas/designs/…, 18gtas/thumbs/…), designs and colourways into the database.
//   --dry-run       writes ingest-pack-report.md only: no uploads, no database writes.
//   --store         default: Vercel Blob when BLOB_READ_WRITE_TOKEN is set, else public/_local/.
//   --keep-archive  leaves the designs from the old archive ingest alone. By default they
//                   are retired, because the pack redraws all of them.
// Safe to re-run: a second run with the same pack uploads and changes nothing.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createDb } from "../src/db/client.ts";
import { manifestSchema, planPack, type PackPlan } from "../src/ingest/manifest.ts";
import { applyPack, type PackStats } from "../src/ingest/pack-run.ts";
import { blobStore, localStore, type ImageStore } from "../src/ingest/storage.ts";
import { PLACEMENT_LABELS, PRINT_METHOD_LABELS } from "../src/lib/print-methods.ts";

const DEFAULT_PACK = "archive/ALL DESIGN IMAGES/18GTAS_Blob_Ready/18GTAS_Blob_Ready";

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const dryRun = args.includes("--dry-run");
const packDir = flag("pack") ?? DEFAULT_PACK;
const storeChoice = flag("store") ?? (process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local");

const manifest = manifestSchema.parse(
  JSON.parse(await readFile(join(packDir, "manifest.json"), "utf8")),
);
const plan = planPack(manifest.designs);
const shown = plan.families.filter((f) => !f.hidden);
console.log(
  `${manifest.designs.length} images → ${plan.families.length} designs (${shown.length} shown, ${plan.families.length - shown.length} superseded), ${plan.collections.length} collections.`,
);

let store: ImageStore | undefined;
let stats: PackStats | undefined;
let target: string | undefined;
if (!dryRun) {
  if (storeChoice === "blob") {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) throw new Error("--store=blob needs BLOB_READ_WRITE_TOKEN.");
    store = blobStore(token);
  } else store = localStore();
  const db = createDb();
  target = new URL(process.env.DATABASE_URL!).host;
  console.log(`Writing to ${target}, images to ${store.name} …`);
  stats = await applyPack(plan, {
    db,
    store,
    packDir,
    retireArchive: !args.includes("--keep-archive"),
    log: console.log,
  });
}

await writeFile(
  "ingest-pack-report.md",
  report(plan, { dryRun, store: store?.name, target, stats }),
);
console.log("Report: ingest-pack-report.md");
if (stats) console.log(JSON.stringify(stats.images), JSON.stringify(stats.designs));
process.exit(0);

function report(
  p: PackPlan,
  o: { dryRun: boolean; store?: string; target?: string; stats?: PackStats },
): string {
  const lines = [
    "# Design pack import",
    "",
    `- Run: ${o.dryRun ? "dry run (nothing written)" : `live → ${o.target}, images → ${o.store}`}`,
    `- Generated: ${new Date().toISOString()}`,
    `- Designs: ${p.families.length} (${p.families.filter((f) => !f.hidden).length} shown, ${p.families.filter((f) => f.hidden).length} superseded and hidden)`,
    `- Colourways: ${p.families.reduce((n, f) => n + f.colourways.length, 0)}, back views: ${p.families.reduce((n, f) => n + f.colourways.reduce((m, c) => m + c.views.length, 0), 0)}`,
    "",
  ];
  if (o.stats) {
    const s = o.stats;
    lines.push(
      "## What changed",
      "",
      `| | Inserted | Updated | Unchanged |`,
      `|---|---|---|---|`,
      `| Collections | ${s.collections.inserted} | ${s.collections.updated} | ${s.collections.unchanged} |`,
      `| Designs | ${s.designs.inserted} | ${s.designs.updated} | ${s.designs.unchanged} |`,
      `| Colourways | ${s.colourways.inserted} | ${s.colourways.updated} | ${s.colourways.unchanged} |`,
      "",
      `Images uploaded: ${s.images.uploaded}, already stored: ${s.images.alreadyStored}. Stale colourways removed: ${s.colourways.removed}.`,
      "",
      `Old archive designs deleted: ${s.retired.deleted.length}${s.retired.deleted.length ? ` (${s.retired.deleted.join(", ")})` : ""}.`,
      `Old archive designs hidden because past rounds use them: ${s.retired.hidden.length}${s.retired.hidden.length ? ` (${s.retired.hidden.join(", ")})` : ""}.`,
      "",
    );
    if (s.duplicates.length)
      lines.push(
        "## The same image in more than one design",
        "",
        ...s.duplicates.map((d) => `- ${d}`),
        "",
      );
  }
  lines.push(
    "## Needs a look",
    "",
    ...(p.issues.length ? p.issues.map((i) => `- ${i}`) : ["Nothing."]),
    "",
  );
  for (const c of p.collections) {
    const fams = p.families.filter((f) => f.collection.slug === c.slug);
    lines.push(
      `## ${c.title} (\`${c.slug}\`, ${fams.length})`,
      "",
      "| Design | Line | Print | Placement | Colourways | |",
      "|---|---|---|---|---|---|",
      ...fams.map(
        (f) =>
          `| ${f.title} | ${f.line} | ${f.printMethod ? PRINT_METHOD_LABELS[f.printMethod] : "?"} | ${f.placement ? PLACEMENT_LABELS[f.placement] : "?"} | ${f.colourways.map((c) => c.name + (c.views.length ? " (+back)" : "")).join(", ")} | ${f.hidden ? `hidden: ${f.statusNote ?? "superseded"}` : ""} |`,
      ),
      "",
    );
  }
  return lines.join("\n");
}
