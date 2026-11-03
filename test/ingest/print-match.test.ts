import { describe, expect, it } from "vitest";
import { groupFamilies } from "@/src/ingest/family";
import { matchPrintMasters, normaliseName } from "@/src/ingest/print-match";
import { ofKind } from "./fixture";

const { families } = groupFamilies(ofKind("display", "detail"));
const prints = ofKind("print_master");
const result = matchPrintMasters(families, prints);
const forColourway = (mockup: string) => result.byColourway.get(mockup) ?? [];

describe("matchPrintMasters on the real archive", () => {
  it("places every print master; nothing is left unmatched", () => {
    expect(result.unmatched).toEqual([]);
    const placed =
      [...result.byColourway.values()].flat().length + [...result.byFamily.values()].flat().length;
    expect(placed).toBe(prints.length);
  });

  it("matches across different spellings (FourSquares vs Four_Squares)", () => {
    expect(forColourway("18GTAS-Round-10/mockups/01_Four_Squares_BW_on_Black.jpg")).toEqual([
      "18GTAS-Round-10/print/18GTAS_01_FourSquares_BW_on_Black.pdf",
      "18GTAS-Round-10/print/18GTAS_01_FourSquares_BW_on_Black_300dpi.png",
    ]);
  });

  it("matches by colourway when the title differs (Column vs The_Column)", () => {
    expect(forColourway("18GTAS-Round-10/mockups/04_The_Column_Gold_on_Wine.jpg")).toHaveLength(2);
  });

  it("keeps the longest colourway match (Black with Red Tick, not Black)", () => {
    expect(
      forColourway("18GTAS-Round-10/mockups/07_Archive_Label_Velvet_Black_with_Red_Tick.jpg"),
    ).toEqual([
      "18GTAS-Round-10/print/18GTAS_07_ArchiveLabel_Velvet_Black_with_Red_Tick_cutfile.pdf",
      "18GTAS-Round-10/print/18GTAS_07_ArchiveLabel_Velvet_Black_with_Red_Tick_cutfile_300dpi.png",
      "18GTAS-Round-10/print/18GTAS_07_ArchiveLabel_Velvet_Black_with_Red_Tick_visual.png",
    ]);
  });

  it("attaches shared artwork to the family, not a colourway", () => {
    expect(result.byFamily.get("round-10/09")?.some((p) => p.includes("JewelClover_artwork"))).toBe(
      true,
    );
    expect(result.byFamily.get("round-10/10")?.some((p) => p.includes("LOGO_master"))).toBe(true);
    expect(result.byFamily.get("round-10/07")?.some((p) => p.includes("RedTick_layer"))).toBe(true);
  });

  it("gives each tee colourway its PDF and 300 dpi PNG", () => {
    expect(forColourway("18GTAS-Tee-Collection-72/mockups/18GTAS_T01_Kasi_Halo_A.jpg")).toEqual([
      "18GTAS-Tee-Collection-72/print/18GTAS_T01_Kasi_Halo_A.pdf",
      "18GTAS-Tee-Collection-72/print/18GTAS_T01_Kasi_Halo_A_300dpi.png",
    ]);
  });

  it("reports prints whose family does not exist", () => {
    const r = matchPrintMasters(families, ["18GTAS-Round-10/print/18GTAS_05_Missing_Black.pdf"]);
    expect(r.unmatched).toEqual(["18GTAS-Round-10/print/18GTAS_05_Missing_Black.pdf"]);
  });
});

describe("normaliseName", () => {
  it("ignores the 18GTAS prefix, case and separators", () => {
    expect(normaliseName("18GTAS_01_FourSquares_BW_on_Black")).toBe(
      normaliseName("01_Four_Squares_BW_on_Black"),
    );
  });
});
