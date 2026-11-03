// Runs the real ingest against Postgres (Docker locally, a service container in CI) on a
// small synthetic archive. Proves CLAUDE.md §4.7: running it twice creates no duplicates.
// pnpm test:int   (needs `pnpm db:up`; uses the gtas_test database)

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/src/db/schema";
import { applyPlan, planIngest } from "@/src/ingest/run";
import { localStore } from "@/src/ingest/storage";

const url = process.env.DATABASE_URL_TEST ?? "postgres://gtas:gtas@localhost:5418/gtas_test";
const sql = postgres(url, { max: 1, onnotice: () => {} });
const db = drizzle(sql, { schema });
let root = "";

type Rgb = { r: number; g: number; b: number };
const BLACK = { r: 14, g: 14, b: 14 };
const WHITE = { r: 208, g: 207, b: 203 };
const NAVY = { r: 23, g: 37, b: 64 };
const MAROON = { r: 64, g: 12, b: 24 };

/** A fake mockup: a plain tee colour with a "print" in the middle, away from the sleeves. */
async function mockup(tee: Rgb, print: Rgb) {
  const art = await sharp({ create: { width: 120, height: 120, channels: 3, background: print } })
    .png()
    .toBuffer();
  return sharp({ create: { width: 300, height: 345, channels: 3, background: tee } })
    .composite([{ input: art, top: 110, left: 90 }])
    .jpeg()
    .toBuffer();
}

async function put(path: string, body: Buffer | string) {
  const file = join(root, "archive", path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, body);
}

const overrides = { "test-set/t01": "EITEEN", "test-set/02": "G-TAS" } as const;
const run = async () =>
  applyPlan(await planIngest(join(root, "archive"), overrides), {
    db,
    store: localStore(join(root, "public")),
  });

beforeAll(async () => {
  await sql.unsafe(
    "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;",
  );
  await migrate(db, { migrationsFolder: "drizzle" });

  root = await mkdtemp(join(tmpdir(), "gtas-ingest-"));
  const teeA = await mockup(BLACK, { r: 255, g: 107, b: 53 });
  await put("18GTAS-Test-Set/mockups/18GTAS_T01_Test_Tee_A.jpg", teeA);
  await put("18GTAS-Test-Set/mockups/18GTAS_T01_Test_Tee_B.jpg", await mockup(WHITE, BLACK));
  await put(
    "18GTAS-Test-Set/mockups/02_Jewel_Navy.jpg",
    await mockup(NAVY, { r: 201, g: 162, b: 74 }),
  );
  await put("18GTAS-Test-Set/mockups/02_Jewel_Navy_detail.jpg", await mockup(NAVY, WHITE));
  await put("18GTAS-Test-Set/mockups/02_Jewel_Maroon.jpg", await mockup(MAROON, WHITE));
  await put("18GTAS-Test-Set/mockups/99_Copy_Black.jpg", teeA); // byte-identical duplicate
  await put("18GTAS-Test-Set/print/18GTAS_T01_Test_Tee_A.pdf", "%PDF-1.4 test");
  await put("18GTAS-Test-Set/print/18GTAS_02_Jewel_artwork.pdf", "%PDF-1.4 test");
  await put("18GTAS-Test-Set/18GTAS_Test_Board.jpg", teeA);
}, 60_000);

afterAll(async () => {
  await sql.end();
  if (root) await rm(root, { recursive: true, force: true });
});

describe("ingest against Postgres", () => {
  it("imports families, colourways, images and print paths on the first run", async () => {
    const stats = await run();
    expect(stats.collections.inserted).toBe(1);
    expect(stats.designs.inserted).toBe(2);
    expect(stats.colourways.inserted).toBe(4);
    expect(stats.images.uploaded).toBe(10); // 4 colourways × 2 sizes + 1 detail × 2 sizes

    const tee = await db.query.design.findFirst({
      where: eq(schema.design.familyKey, "test-set/t01"),
    });
    expect(tee).toMatchObject({ title: "Test Tee", line: "EITEEN", slug: "test-tee-ts-t01" });
    const teeColourways = await db.query.colourway.findMany({
      where: eq(schema.colourway.designId, tee!.id),
      orderBy: schema.colourway.sortOrder,
    });
    expect(teeColourways.map((c) => [c.name, c.teeColour])).toEqual([
      ["Black", "Black"],
      ["White", "White"],
    ]);
    expect(teeColourways[0]!.printFiles).toEqual([
      "18GTAS-Test-Set/print/18GTAS_T01_Test_Tee_A.pdf",
    ]);
    expect(teeColourways[0]!.blurDataUrl).toMatch(/^data:image\/webp;base64,/);

    const jewel = await db.query.design.findFirst({
      where: eq(schema.design.familyKey, "test-set/02"),
    });
    expect(jewel!.printFiles).toEqual(["18GTAS-Test-Set/print/18GTAS_02_Jewel_artwork.pdf"]);
    const navy = await db.query.colourway.findFirst({ where: eq(schema.colourway.name, "Navy") });
    expect(navy!.views).toHaveLength(1);
  }, 60_000);

  it("changes nothing on a second run", async () => {
    const stats = await run();
    expect(stats.collections).toEqual({ inserted: 0, updated: 0, unchanged: 1 });
    expect(stats.designs).toEqual({ inserted: 0, updated: 0, unchanged: 2 });
    expect(stats.colourways).toEqual({ inserted: 0, updated: 0, unchanged: 4 });
    expect(stats.images.uploaded).toBe(0);
    const [row] = await sql<{ count: number }[]>`select count(*)::int from colourway`;
    expect(row?.count).toBe(4);
  }, 60_000);

  it("keeps the admin's edits to title and line on later runs", async () => {
    await db
      .update(schema.design)
      .set({ title: "Renamed by admin", line: "G-TAS" })
      .where(eq(schema.design.familyKey, "test-set/t01"));
    await run();
    const tee = await db.query.design.findFirst({
      where: eq(schema.design.familyKey, "test-set/t01"),
    });
    expect(tee).toMatchObject({ title: "Renamed by admin", line: "G-TAS" });
  }, 60_000);
});
