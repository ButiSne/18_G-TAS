import { describe, expect, it } from "vitest";
import { collectionFor, groupFamilies, parseMockupName, slugify } from "@/src/ingest/family";
import { ofKind } from "./fixture";

const { families, unmatched } = groupFamilies(ofKind("display", "detail"));
const family = (key: string) => families.find((f) => f.key === key)!;

describe("collectionFor", () => {
  it("derives slug, title and a short code from the top folder", () => {
    expect(collectionFor("18GTAS-Tee-Collection-72/mockups/x.jpg")).toEqual({
      folder: "18GTAS-Tee-Collection-72",
      slug: "tee-collection-72",
      title: "Tee Collection 72",
      code: "tc72",
    });
    expect(collectionFor("18GTAS-Round-10/mockups/x.jpg").code).toBe("r10");
  });
});

describe("parseMockupName", () => {
  it("reads the tee scheme: number, title tokens, colourway letter", () => {
    expect(parseMockupName("18GTAS_T07_Varsity_Eiteen_A.jpg")).toMatchObject({
      familyNo: "t07",
      tokens: ["Varsity", "Eiteen"],
      letter: "A",
      isDetail: false,
    });
  });

  it("reads the numbered scheme and the _detail suffix", () => {
    expect(parseMockupName("09_Pocket_Jewel_Onyx_with_Gold_Piping_detail.jpg")).toMatchObject({
      familyNo: "09",
      tokens: ["Pocket", "Jewel", "Onyx", "with", "Gold", "Piping"],
      letter: null,
      isDetail: true,
    });
  });

  it("returns null for names that fit neither scheme", () => {
    expect(parseMockupName("random_photo.jpg")).toBeNull();
  });
});

describe("groupFamilies on the real archive", () => {
  it("finds 36 tee families and 8 Round 10 families, with nothing unmatched", () => {
    expect(unmatched).toEqual([]);
    expect(families.filter((f) => f.collection.slug === "tee-collection-72")).toHaveLength(36);
    expect(families.filter((f) => f.collection.slug === "round-10").map((f) => f.familyNo)).toEqual(
      ["01", "02", "03", "04", "06", "07", "09", "10"],
    );
  });

  it("groups _A/_B into one family and drops the suffix from the title (brief §14)", () => {
    const t07 = family("tee-collection-72/t07");
    expect(t07.title).toBe("Varsity Eiteen");
    expect(t07.colourways.map((c) => c.name)).toEqual(["A", "B"]);
    expect(t07.slug).toBe("varsity-eiteen-tc72-t07");
  });

  it("splits Round 10 names into the shared title and the colourway", () => {
    const fourSquares = family("round-10/01");
    expect(fourSquares.title).toBe("Four Squares");
    expect(fourSquares.colourways.map((c) => c.name)).toEqual([
      "101 Dalmatians Black",
      "101 Dalmatians White",
      "BW on Black",
      "BW on White",
      "Colour on Black",
      "Colour on White",
    ]);
    expect(family("round-10/04").title).toBe("The Column");
    expect(family("round-10/06").title).toBe("EITEEN AllOver");
  });

  it("stops the title before a colour word when one colourway's name is a prefix of another", () => {
    const archiveLabel = family("round-10/07");
    expect(archiveLabel.title).toBe("Archive Label Velvet");
    expect(archiveLabel.colourways.map((c) => c.name)).toEqual(["Black", "Black with Red Tick"]);
  });

  it("attaches each detail shot to its colourway", () => {
    const jewel = family("round-10/09");
    expect(jewel.title).toBe("Pocket Jewel");
    expect(jewel.colourways.every((c) => c.detailPaths.length === 1)).toBe(true);
  });

  it("gives every family a unique slug, even when titles repeat across collections", () => {
    const slugs = families.map((f) => f.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(family("tee-collection-72/t10").slug).toBe("map-letters-tc72-t10");
    expect(family("round-10/02").slug).toBe("map-letters-r10-02");
  });

  it("is order independent: shuffled input gives the same families", () => {
    const shuffled = [...ofKind("display", "detail")].reverse();
    expect(groupFamilies(shuffled).families).toEqual(families);
  });
});

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("EITEEN AllOver r10 06")).toBe("eiteen-allover-r10-06");
    expect(slugify("Café · XVIII")).toBe("cafe-xviii");
  });
});
