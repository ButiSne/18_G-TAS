// pnpm ingest [--dry-run] [--archive=./archive] [--store=local|blob]
//
// Reads the unzipped design archive and loads the catalogue (CLAUDE.md §4).
//   --dry-run  writes ingest-report.md only: no uploads, no database writes.
//   --store    where display images go. Default: Vercel Blob when BLOB_READ_WRITE_TOKEN is
//              set, else public/_local/ (served by Next at /_local/, for Docker development).
// Safe to re-run: the second run with the same archive changes nothing.

import { readFile, writeFile } from "node:fs/promises";
import { createDb } from "../src/db/client.ts";
import { parseLineOverrides } from "../src/ingest/line.ts";
import { renderReport } from "../src/ingest/report.ts";
import { applyPlan, planIngest } from "../src/ingest/run.ts";
import { blobStore, localStore, type ImageStore } from "../src/ingest/storage.ts";

const args = process.argv.slice(2);
const flag = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const dryRun = args.includes("--dry-run");
const archiveDir = flag("archive") ?? "archive";
const storeChoice = flag("store") ?? (process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local");

const overrides = parseLineOverrides(
  JSON.parse(await readFile("data/line-overrides.json", "utf8")),
);
console.log(`Reading ${archiveDir}/ …`);
const plan = await planIngest(archiveDir, overrides);
console.log(
  `${plan.families.length} families, ${plan.families.reduce((n, f) => n + f.colourways.length, 0)} colourways.`,
);

let store: ImageStore | undefined;
let stats;
if (!dryRun) {
  if (storeChoice === "blob") {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) throw new Error("--store=blob needs BLOB_READ_WRITE_TOKEN.");
    store = blobStore(token);
  } else store = localStore();
  const db = createDb();
  const host = new URL(process.env.DATABASE_URL!).host;
  console.log(`Writing to ${host}, images to ${store.name} …`);
  stats = await applyPlan(plan, { db, store, log: console.log });
}

await writeFile(
  "ingest-report.md",
  renderReport(plan, {
    mode: dryRun ? "dry-run" : "live",
    generatedAt: new Date(),
    store: store?.name,
    stats,
  }),
);
const undecided = plan.families.filter((f) => f.line.line === null).length;
console.log(
  `Report: ingest-report.md${undecided ? ` (${undecided} families need a line before they import)` : ""}`,
);
if (stats) console.log(JSON.stringify(stats));
process.exit(0);
