// The design-pack import against Postgres (gtas_test), with a small synthetic pack and the
// local image store: one design per family, backs attached, superseded hidden, a second run
// changes nothing, admin edits survive, and old archive designs are retired safely.

import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/src/db/schema";
import { manifestSchema, planPack } from "@/src/ingest/manifest";
import { applyPack } from "@/src/ingest/pack-run";
import { localStore } from "@/src/ingest/storage";

const url = process.env.DATABASE_URL_TEST ?? "postgres://gtas:gtas@localhost:5418/gtas_test";
const sql = postgres(url, { max: 1, onnotice: () => {} });
const db = drizzle(sql, { schema });
let root = "";
const pack = () => join(root, "pack");

async function webp(hex: string, size = 60) {
  return sharp({ create: { width: size, height: size + 9, channels: 3, background: hex } })
    .webp()
    .toBuffer();
}

type Rec = {
  slug: string;
  family: string;
  view?: "front" | "back";
  colourway?: string | null;
  tee?: string;
  status?: "active" | "superseded";
  collection?: string;
  range?: "EITEEN" | "G-TAS";
};
const records: Rec[] = [
  { slug: "e-t72-t01-kasi-halo-a", family: "e-t72-t01-kasi-halo", colourway: "A", tee: "#111111" },
  { slug: "e-t72-t01-kasi-halo-b", family: "e-t72-t01-kasi-halo", colourway: "B", tee: "#F4F3EF" },
  {
    slug: "g-fav-tess",
    family: "g-fav-tess",
    range: "G-TAS",
    collection: "favourites",
    tee: "#F3EDE2",
  },
  {
    slug: "g-fav-tess-back",
    family: "g-fav-tess",
    view: "back",
    range: "G-TAS",
    collection: "favourites",
    tee: "#F3EDE2",
  },
  {
    slug: "e-logo-old",
    family: "e-logo-old",
    status: "superseded",
    collection: "logo-exploration",
    tee: "#0D0D0D",
  },
  { slug: "e-logo-copy", family: "e-logo-copy", collection: "logo-exploration", tee: "#0D0D0D" },
];
const colours: Record<string, string> = {
  "e-t72-t01-kasi-halo-a": "#101010",
  "e-t72-t01-kasi-halo-b": "#f0f0f0",
  "g-fav-tess": "#e0d8c8",
  "g-fav-tess-back": "#c8b890",
  "e-logo-old": "#202020",
  "e-logo-copy": "#202020", // the same bytes as e-logo-old, on purpose: both kept
};

async function writePack(over: Record<string, Buffer> = {}) {
  const designs = [];
  for (const r of records) {
    const range = r.range ?? "EITEEN";
    const col = r.collection ?? "tee-collection-72";
    const dir = `${range.toLowerCase()}/${col}`;
    const rec = {
      slug: r.slug,
      title: r.slug.replace(/-/g, " "),
      range,
      collection: col,
      collection_title: col,
      view: r.view ?? "front",
      product: "t-shirt",
      placement: r.collection === "favourites" ? "all-over" : "front-centre",
      print_method: r.collection === "favourites" ? "full-sublimation" : "dtf",
      tee_colour: r.tee ?? "#111111",
      colourway: r.colourway ?? null,
      status: r.status ?? "active",
      status_note: r.status === "superseded" ? "Replaced by the upright set" : null,
      image: `designs/${dir}/${r.slug}.webp`,
      thumb: `thumbs/${dir}/${r.slug}.webp`,
      blob_pathname: `18gtas/designs/${dir}/${r.slug}.webp`,
      blob_thumb_pathname: `18gtas/thumbs/${dir}/${r.slug}.webp`,
      print_master_png: `masters/${r.slug}_300dpi.png`,
      print_master_pdf: null,
      family: r.family,
    };
    for (const [path, size] of [
      [rec.image, 60],
      [rec.thumb, 24],
    ] as const) {
      const file = join(pack(), path);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, over[path] ?? (await webp(colours[r.slug]!, size)));
    }
    designs.push(rec);
  }
  await writeFile(join(pack(), "manifest.json"), JSON.stringify({ designs }));
  return manifestSchema.parse({ designs });
}

const run = async () =>
  applyPack(planPack((await writePack()).designs), {
    db,
    store: localStore(join(root, "public")),
    packDir: pack(),
    retireArchive: true,
    concurrency: 2,
  });

let picked = "";

beforeAll(async () => {
  await sql.unsafe(
    "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;",
  );
  await migrate(db, { migrationsFolder: "drizzle" });
  root = await mkdtemp(join(tmpdir(), "gtas-pack-"));
  // Two designs from the old archive ingest: one a past round used, one nobody touched.
  const [m] = await db
    .insert(schema.member)
    .values({ name: "A", email: "a@example.com" })
    .returning();
  const old = await db
    .insert(schema.design)
    .values([
      { slug: "kasi-halo", familyKey: "tee-collection-72/t01", title: "Kasi Halo", line: "EITEEN" },
      { slug: "speed", familyKey: "tee-collection-72/t02", title: "Speed", line: "EITEEN" },
    ])
    .returning();
  picked = old[0]!.id;
  const [round] = await db.insert(schema.selectionRound).values({ title: "Trial" }).returning();
  await db
    .insert(schema.memberPick)
    .values({ roundId: round!.id, memberId: m!.id, designId: picked, rank: 1 });
}, 60_000);

afterAll(async () => {
  await sql.end();
  await rm(root, { recursive: true, force: true });
});

describe("design pack import", () => {
  it("loads one design per family, with backs attached and superseded hidden", async () => {
    const stats = await run();
    expect(stats.designs.inserted).toBe(4);
    expect(stats.colourways.inserted).toBe(5); // halo A+B, tessellation, logo-old, logo-copy
    expect(stats.duplicates).toEqual(["e-logo-copy uses the same image as e-logo-old (both kept)"]);
    expect(stats.images.uploaded).toBe(12); // 5 colourways + 1 back, full + thumb each

    const designs = await db.select().from(schema.design);
    const byKey = Object.fromEntries(designs.map((x) => [x.familyKey, x]));
    expect(byKey["e-t72-t01-kasi-halo"]).toMatchObject({
      title: "e t72 t01 kasi halo",
      printMethod: "dtf",
      placement: "front-centre",
      hidden: false,
    });
    expect(byKey["e-logo-old"]).toMatchObject({
      hidden: true,
      description: "Replaced by the upright set",
    });

    const tess = await db
      .select()
      .from(schema.colourway)
      .where(eq(schema.colourway.designId, byKey["g-fav-tess"]!.id));
    expect(tess).toHaveLength(1);
    expect(tess[0]!.views).toEqual([
      expect.objectContaining({
        label: "Back",
        imageUrl: expect.stringContaining("g-fav-tess-back"),
      }),
    ]);
    expect(tess[0]).toMatchObject({ teeColour: "Cream", teeHex: "#F3EDE2" });
    expect(tess[0]!.blurDataUrl).toMatch(/^data:image\/webp;base64,/);
    expect(tess[0]!.imageUrl).toBe("/_local/18gtas/designs/g-tas/favourites/g-fav-tess.webp");

    // The deliberate twin keeps its own files at its own pathname.
    const twin = await db
      .select()
      .from(schema.colourway)
      .where(eq(schema.colourway.designId, byKey["e-logo-copy"]!.id));
    expect(twin).toHaveLength(1);
    expect(twin[0]!.imageUrl).toContain("/e-logo-copy.webp");
  });

  it("deletes untouched old archive designs and hides the ones past rounds used", async () => {
    const old = await db.select().from(schema.design).where(eq(schema.design.slug, "kasi-halo"));
    expect(old[0]).toMatchObject({ id: picked, hidden: true });
    expect(await db.select().from(schema.design).where(eq(schema.design.slug, "speed"))).toEqual(
      [],
    );
  });

  it("changes nothing on a second run", async () => {
    const stats = await run();
    expect(stats.designs).toEqual({ inserted: 0, updated: 0, unchanged: 4 });
    expect(stats.colourways).toMatchObject({ inserted: 0, updated: 0, unchanged: 5, removed: 0 });
    expect(stats.images).toEqual({ uploaded: 0, alreadyStored: 0 });
    expect(stats.retired).toEqual({ deleted: [], hidden: [] });
  });

  it("keeps the admin's edits", async () => {
    await db
      .update(schema.design)
      .set({ title: "Kasi Halo", printMethod: "puff-print" })
      .where(eq(schema.design.familyKey, "e-t72-t01-kasi-halo"));
    await run();
    const [halo] = await db
      .select()
      .from(schema.design)
      .where(eq(schema.design.familyKey, "e-t72-t01-kasi-halo"));
    expect(halo).toMatchObject({ title: "Kasi Halo", printMethod: "puff-print" });
  });

  it("replaces a redone image at the same pathname and drops the old colourway", async () => {
    const path = "designs/eiteen/tee-collection-72/e-t72-t01-kasi-halo-a.webp";
    const manifest = await writePack({ [path]: await webp("#303030", 80) });
    const stats = await applyPack(planPack(manifest.designs), {
      db,
      store: localStore(join(root, "public")),
      packDir: pack(),
      concurrency: 2,
    });
    expect(stats.colourways).toMatchObject({ inserted: 1, removed: 1 });
    expect(stats.images.uploaded).toBe(1); // the redone full image; its thumb is unchanged
    const files = await readdir(
      join(root, "public/_local/18gtas/designs/eiteen/tee-collection-72"),
    );
    expect(files).toContain("e-t72-t01-kasi-halo-a.webp");
  });
});
