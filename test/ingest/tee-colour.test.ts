import { describe, expect, it } from "vitest";
import {
  nameLetteredColourways,
  nearestTeeColour,
  teeColourFromName,
} from "@/src/ingest/tee-colour";
import { findDuplicates } from "@/src/ingest/duplicates";

describe("teeColourFromName", () => {
  it("reads the tee after 'on' (the print colour comes first)", () => {
    expect(teeColourFromName(["Gold", "on", "Wine"])).toBe("Maroon");
    expect(teeColourFromName(["Coral", "and", "Navy", "on", "White"])).toBe("White");
  });

  it("falls back to the first, then the last colour word", () => {
    expect(teeColourFromName(["Ivory", "with", "Gold", "Piping"])).toBe("Cream");
    expect(teeColourFromName(["101", "Dalmatians", "Black"])).toBe("Black");
    expect(teeColourFromName(["Velvet", "Black"])).toBe("Black");
  });

  it("returns null when only print colours are named", () => {
    expect(teeColourFromName(["Matrix", "Gold"])).toBeNull();
    expect(teeColourFromName(["Diagonal", "LARGE"])).toBeNull();
  });
});

describe("nearestTeeColour (values measured from the archive's mockups)", () => {
  it("maps sampled sleeve colours to the nearest tee colour", () => {
    expect(nearestTeeColour([16, 50, 36])).toBe("Green"); // T07 B
    expect(nearestTeeColour([10, 75, 51])).toBe("Green"); // T15 A, a brighter green
    expect(nearestTeeColour([63, 12, 24])).toBe("Maroon"); // The Column, Gold on Wine
    expect(nearestTeeColour([14, 14, 14])).toBe("Black");
    expect(nearestTeeColour([38, 39, 44])).toBe("Grey"); // T12 B, charcoal
    expect(nearestTeeColour([37, 24, 54])).toBe("Purple"); // T19 B
    expect(nearestTeeColour([17, 23, 39])).toBe("Navy"); // Pocket Jewel, Midnight
  });

  it("tells shaded white from cream", () => {
    expect(nearestTeeColour([208, 207, 203])).toBe("White");
    expect(nearestTeeColour([203, 196, 178])).toBe("Cream"); // The Column, Black on Cream
    expect(nearestTeeColour([203, 199, 188])).toBe("Cream"); // Pocket Jewel, Ivory
  });

  it("returns null when the sleeve is printed (all-over designs)", () => {
    expect(nearestTeeColour([106, 90, 53])).toBeNull(); // EITEEN AllOver, Diagonal LARGE
  });
});

describe("nameLetteredColourways", () => {
  it("names A/B by tee colour, keeping the letter only when colours repeat", () => {
    expect(
      nameLetteredColourways([
        { letter: "A", name: "A", teeColour: "Black" },
        { letter: "B", name: "B", teeColour: "White" },
      ]),
    ).toEqual(["Black", "White"]);
    expect(
      nameLetteredColourways([
        { letter: "A", name: "A", teeColour: "Black" },
        { letter: "B", name: "B", teeColour: "Black" },
      ]),
    ).toEqual(["Black (A)", "Black (B)"]);
  });

  it("leaves named colourways alone", () => {
    expect(
      nameLetteredColourways([{ letter: null, name: "BW on Black", teeColour: "Black" }]),
    ).toEqual(["BW on Black"]);
  });
});

describe("findDuplicates (brief §4.6)", () => {
  it("keeps the first path by sort order and reports the rest", () => {
    const r = findDuplicates([
      { path: "b/x.jpg", hash: "h1" },
      { path: "a/x.jpg", hash: "h1" },
      { path: "c/y.jpg", hash: "h2" },
    ]);
    expect(r.keep.map((f) => f.path)).toEqual(["a/x.jpg", "c/y.jpg"]);
    expect(r.duplicates).toEqual([{ path: "b/x.jpg", duplicateOf: "a/x.jpg" }]);
  });
});
