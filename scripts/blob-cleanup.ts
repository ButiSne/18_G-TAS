// pnpm blob:cleanup [--prefix=designs/] [--delete]
//
// Removes the display images the old archive ingest uploaded (pathnames under designs/),
// which the Blob-ready design pack (18gtas/…) has replaced. Only files that no colourway in
// the database points to are removed, so run it against the production database after the
// pack import there. Without --delete it only reports what it would remove.

import { del, list } from "@vercel/blob";
import { sql } from "drizzle-orm";
import { createDb } from "../src/db/client.ts";

const args = process.argv.slice(2);
const prefix = args.find((a) => a.startsWith("--prefix="))?.slice(9) ?? "designs/";
const doDelete = args.includes("--delete");
if (prefix.startsWith("18gtas/")) throw new Error("18gtas/ holds the design pack: not cleaned.");

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) throw new Error("Needs BLOB_READ_WRITE_TOKEN.");
const db = createDb();
console.log(`Database: ${new URL(process.env.DATABASE_URL!).host}. Blob prefix: ${prefix}`);

// Every image URL the database still uses: colourway images, thumbnails and extra views.
const rows = await db.execute<{ url: string }>(sql`
  SELECT image_url AS url FROM colourway
  UNION SELECT thumb_url FROM colourway
  UNION SELECT v->>'imageUrl' FROM colourway, jsonb_array_elements(views) v
  UNION SELECT v->>'thumbUrl' FROM colourway, jsonb_array_elements(views) v`);
const used = new Set(rows.map((r) => r.url));

const blobs: { url: string; pathname: string; size: number }[] = [];
let cursor: string | undefined;
do {
  const page = await list({ prefix, cursor, limit: 1000, token });
  blobs.push(...page.blobs);
  cursor = page.hasMore ? page.cursor : undefined;
} while (cursor);

const unused = blobs.filter((b) => !used.has(b.url));
const kept = blobs.length - unused.length;
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
console.log(
  `${blobs.length} files under ${prefix} (${mb(blobs.reduce((n, b) => n + b.size, 0))}). ` +
    `${kept} still used, kept. ${unused.length} unused (${mb(unused.reduce((n, b) => n + b.size, 0))}).`,
);

if (!doDelete) {
  for (const b of unused.slice(0, 10)) console.log(`  would remove ${b.pathname}`);
  if (unused.length > 10)
    console.log(`  … and ${unused.length - 10} more. Add --delete to remove.`);
  process.exit(0);
}
for (let i = 0; i < unused.length; i += 100) {
  await del(
    unused.slice(i, i + 100).map((b) => b.url),
    { token },
  );
}
console.log(`Removed ${unused.length} files.`);
process.exit(0);
