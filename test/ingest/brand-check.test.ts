import { describe, expect, it } from "vitest";
import { brandFlags } from "@/src/ingest/brand-check";

describe("brandFlags (brief §6)", () => {
  it("flags club, federation and kit-maker names, whatever the case", () => {
    expect(brandFlags("Buccaneer Pirates Away")).toEqual(["Pirates"]);
    expect(brandFlags("bafana_retro_96")).toEqual(["Bafana"]);
    expect(brandFlags("Three Stripes ADIDAS Homage")).toEqual(["adidas"]);
    expect(brandFlags("LV Monogram")).toEqual(["LV"]);
  });

  it("matches whole words only: SILVER is not LV, Pumalanga is not Puma", () => {
    expect(brandFlags("SILVER Crest")).toEqual([]);
    expect(brandFlags("Pumalanga Sunrise")).toEqual([]);
    expect(brandFlags("Chiefsland")).toEqual([]);
  });

  it("finds several names at once", () => {
    expect(brandFlags("Chiefs vs Pirates Derby")).toEqual(["Pirates", "Chiefs"]);
  });

  it("passes our own design names", () => {
    expect(brandFlags("Buccaneer Granite")).toEqual([]);
    expect(brandFlags("Twelve Voices")).toEqual([]);
  });
});
