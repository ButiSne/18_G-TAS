import { describe, expect, it } from "vitest";
import {
  applyFilters,
  catalogueHref,
  parseFilters,
  seededShuffle,
  type CatalogueDesign,
} from "@/src/lib/catalogue";

const cw = (teeColour: string | null) => ({
  id: `cw-${teeColour}`,
  name: teeColour ?? "Original",
  imageUrl: "x",
  thumbUrl: "x",
  blurDataUrl: null,
  teeColour,
  views: [],
});

const d = (over: Partial<CatalogueDesign>): CatalogueDesign => ({
  id: over.slug ?? "x",
  slug: "x",
  title: "X",
  line: "EITEEN",
  tags: [],
  printMethod: null,
  collection: { slug: "round-10", title: "Round 10" },
  colourways: [cw("Black")],
  ...over,
});

const designs = [
  d({ slug: "kasi-halo", title: "Kasi Halo", colourways: [cw("Black"), cw("White")] }),
  d({ slug: "xviii-chest", title: "XVIII Chest", line: "G-TAS", printMethod: "dtf" }),
  d({
    slug: "youth-elders",
    title: "Youth Elders",
    tags: ["crossover"],
    colourways: [cw("White")],
  }),
  d({
    slug: "square-monogram",
    title: "Square Monogram",
    line: "G-TAS",
    tags: ["crossover"],
    collection: { slug: "tee-collection-72", title: "Tee Collection 72" },
  }),
];
const slugs = (list: CatalogueDesign[]) => list.map((x) => x.slug);

describe("parseFilters", () => {
  it("keeps valid params and drops anything else", () => {
    expect(
      parseFilters({
        line: "G-TAS",
        colour: "Black",
        q: "  kasi ",
        seed: "ab12",
        collection: "round-10",
      }),
    ).toEqual({ line: "G-TAS", colour: "Black", q: "kasi", seed: "ab12", collection: "round-10" });
    expect(
      parseFilters({
        line: "ELDERS",
        colour: "Pink",
        collection: "../etc",
        seed: "<script>",
        q: "",
      }),
    ).toEqual({});
  });
});

describe("applyFilters", () => {
  it("shows crossovers under both lines", () => {
    expect(slugs(applyFilters(designs, { line: "EITEEN" }))).toEqual([
      "kasi-halo",
      "youth-elders",
      "square-monogram",
    ]);
    expect(slugs(applyFilters(designs, { line: "G-TAS" }))).toEqual([
      "xviii-chest",
      "youth-elders",
      "square-monogram",
    ]);
  });

  it("filters by tee colour across colourways, collection, print method and search", () => {
    expect(slugs(applyFilters(designs, { colour: "White" }))).toEqual([
      "kasi-halo",
      "youth-elders",
    ]);
    expect(slugs(applyFilters(designs, { collection: "tee-collection-72" }))).toEqual([
      "square-monogram",
    ]);
    expect(slugs(applyFilters(designs, { print: "dtf" }))).toEqual(["xviii-chest"]);
    expect(slugs(applyFilters(designs, { q: "xviii" }))).toEqual(["xviii-chest"]);
    expect(slugs(applyFilters(designs, { q: "crossover" }))).toEqual([
      "youth-elders",
      "square-monogram",
    ]);
  });

  it("shuffles the same way for the same seed, and differently for another", () => {
    const a = slugs(applyFilters(designs, { seed: "abc" }));
    expect(slugs(applyFilters(designs, { seed: "abc" }))).toEqual(a);
    expect([...a].sort()).toEqual(slugs(designs).sort());
    const many = Array.from({ length: 30 }, (_, i) => i);
    expect(seededShuffle(many, "one")).not.toEqual(seededShuffle(many, "two"));
  });
});

describe("catalogueHref", () => {
  it("keeps other filters when one changes, and drops empty ones", () => {
    expect(catalogueHref({ line: "EITEEN", colour: "Black" }, { line: undefined })).toBe(
      "/designs?colour=Black",
    );
    expect(catalogueHref({}, {})).toBe("/designs");
  });
});
