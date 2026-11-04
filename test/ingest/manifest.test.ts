import { describe, expect, it } from "vitest";
import {
  familyTitle,
  isArchiveFamilyKey,
  manifestRecordSchema,
  planPack,
  type ManifestRecord,
} from "@/src/ingest/manifest";
import { normaliseHex, teeColourFromHex } from "@/src/ingest/tee-colour";
import { slotFor } from "@/src/lib/print-methods";

// Real records from the Blob-ready pack's manifest.json (Nov 2026), trimmed to what matters.
const rec = (over: Partial<ManifestRecord>): ManifestRecord => {
  const slug = over.slug ?? "eiteen-tee-collection-72-t01-kasi-halo-a";
  const dir = `${(over.range ?? "EITEEN").toLowerCase()}/${over.collection ?? "tee-collection-72"}`;
  return manifestRecordSchema.parse({
    slug,
    title: "Kasi Halo A",
    range: "EITEEN",
    collection: "tee-collection-72",
    collection_title: "T-Shirt Collection 72",
    view: "front",
    product: "t-shirt",
    placement: "front-centre",
    print_method: "dtf",
    tee_colour: "#111111",
    colourway: null,
    status: "active",
    status_note: null,
    image: `designs/${dir}/${slug}.webp`,
    thumb: `thumbs/${dir}/${slug}.webp`,
    blob_pathname: `18gtas/designs/${dir}/${slug}.webp`,
    blob_thumb_pathname: `18gtas/thumbs/${dir}/${slug}.webp`,
    print_master_png: `18GTAS-Tee-Collection-72/${slug}_300dpi.png`,
    print_master_pdf: null,
    family: "eiteen-tee-collection-72-t01-kasi-halo",
    ...over,
  });
};

describe("planPack (one design per family, one colourway per front)", () => {
  it("groups A/B colourways and names them by tee colour", () => {
    const plan = planPack([
      rec({ slug: "k-a", title: "Kasi Halo A", colourway: "A", tee_colour: "#111111" }),
      rec({ slug: "k-b", title: "Kasi Halo B", colourway: "B", tee_colour: "#F4F3EF" }),
    ]);
    expect(plan.families).toHaveLength(1);
    const f = plan.families[0]!;
    expect(f).toMatchObject({
      title: "Kasi Halo",
      line: "EITEEN",
      printMethod: "dtf",
      hidden: false,
    });
    expect(f.colourways.map((c) => [c.name, c.teeHex])).toEqual([
      ["Black", "#111111"],
      ["White", "#F4F3EF"],
    ]);
  });

  it("keeps the letter when both colourways share a tee colour", () => {
    const plan = planPack([
      rec({ slug: "k-a", colourway: "A", tee_colour: "#111111" }),
      rec({ slug: "k-b", colourway: "B", tee_colour: "#0d0d0d" }),
    ]);
    expect(plan.families[0]!.colourways.map((c) => c.name)).toEqual(["Black (A)", "Black (B)"]);
  });

  it("attaches a back view to its front, with the back's print files", () => {
    const family = "g-tas-favourites-teec-tessellation";
    const plan = planPack(
      [
        rec({
          slug: `${family}-back-panel`,
          family,
          view: "back",
          title: "TeeC Tessellation",
          print_master_pdf: "fav/back.pdf",
        }),
        rec({
          slug: family,
          family,
          title: "TeeC Tessellation",
          range: "G-TAS",
          collection: "favourites",
          placement: "all-over",
        }),
      ].map((r) => ({
        ...r,
        range: "G-TAS" as const,
        collection: "favourites",
        placement: "all-over",
      })),
    );
    const f = plan.families[0]!;
    expect(f.colourways).toHaveLength(1);
    expect(f.colourways[0]!.label).toBe("Front");
    expect(f.colourways[0]!.views).toEqual([
      expect.objectContaining({
        label: "Back",
        blobPathname: expect.stringContaining("back-panel"),
      }),
    ]);
    expect(f.colourways[0]!.printFiles).toContain("fav/back.pdf");
    expect(f.placement).toBe("all-over");
  });

  it("shows the back when a family was only shot from the back", () => {
    const family = "g-tas-pinstripes-velvet-pinvelvet-2-sand-gold-back";
    const plan = planPack([
      rec({ slug: family, family, view: "back", title: "PinVelvet 2 Sand Gold" }),
    ]);
    expect(plan.families[0]!.colourways).toEqual([
      expect.objectContaining({ label: "Back", views: [] }),
    ]);
  });

  it("hides a family whose records are all superseded, and says why", () => {
    const plan = planPack([
      rec({
        slug: "eiteen-logo-exploration-01",
        family: "eiteen-logo-exploration-01",
        status: "superseded",
        status_note: "Triangles pointed down — replaced by Logo Exploration · Upright",
      }),
    ]);
    expect(plan.families[0]).toMatchObject({
      hidden: true,
      statusNote: expect.stringContaining("Upright"),
    });
  });

  it("flags unknown print methods and placements instead of guessing", () => {
    const plan = planPack([rec({ print_method: "screen-print", placement: "sleeve" })]);
    expect(plan.families[0]).toMatchObject({ printMethod: null, placement: null });
    expect(plan.issues.join("\n")).toMatch(/screen-print[\s\S]*sleeve/);
  });

  it("orders collections as they first appear", () => {
    const plan = planPack([
      rec({ slug: "a", family: "a", collection: "round-10", collection_title: "Round 10" }),
      rec({ slug: "b", family: "b", collection: "atelier", collection_title: "Atelier" }),
      rec({ slug: "c", family: "c", collection: "round-10", collection_title: "Round 10" }),
    ]);
    expect(plan.collections.map((c) => [c.slug, c.sortOrder])).toEqual([
      ["round-10", 0],
      ["atelier", 1],
    ]);
  });

  it("flags brand names in titles (CLAUDE.md §6)", () => {
    const plan = planPack([rec({ title: "Pirates Stripe" })]);
    expect(plan.issues.some((i) => i.includes("Pirates"))).toBe(true);
  });

  it("rejects paths that climb out of the pack folder", () => {
    expect(() => rec({ image: "../secrets.webp" })).toThrow();
  });
});

describe("familyTitle", () => {
  it("drops the colourway letter only when it is the record's colourway", () => {
    expect(familyTitle("Kasi Halo A", "A")).toBe("Kasi Halo");
    expect(familyTitle("Plan B", null)).toBe("Plan B");
  });
});

describe("tee colours from the pack's hex values", () => {
  it("maps hex to the filter colour", () => {
    expect(teeColourFromHex("#0d0d0d")).toBe("Black");
    expect(teeColourFromHex("#222222")).toBe("Black");
    expect(teeColourFromHex("#3b3f47")).toBe("Grey");
    expect(teeColourFromHex("#F3EDE2")).toBe("Cream");
    expect(teeColourFromHex("#141B2D")).toBe("Navy");
    expect(teeColourFromHex("#4A0F1C")).toBe("Maroon");
    expect(teeColourFromHex("#ffb612")).toBe("Gold");
    expect(teeColourFromHex("#a9d9c3")).toBe("Mint");
    expect(teeColourFromHex("#F3E8FF")).toBe("White");
    expect(teeColourFromHex("not a colour")).toBeNull();
  });

  it("stores one spelling per colour", () => {
    expect(normaliseHex("#0d0d0d")).toBe("#0D0D0D");
    expect(normaliseHex("red")).toBeNull();
  });
});

describe("print methods", () => {
  it("counts both kinds of sublimation in the sublimation five", () => {
    expect(slotFor("full-sublimation")).toBe("sublimation");
    expect(slotFor("cotton-sublimation")).toBe("sublimation");
    expect(slotFor("dtf-gold-foil")).toBe("other");
  });
});

describe("isArchiveFamilyKey", () => {
  it("tells old archive keys from pack keys", () => {
    expect(isArchiveFamilyKey("tee-collection-72/t07")).toBe(true);
    expect(isArchiveFamilyKey("eiteen-tee-collection-72-t07-varsity-eiteen")).toBe(false);
    expect(isArchiveFamilyKey(null)).toBe(false);
  });
});
