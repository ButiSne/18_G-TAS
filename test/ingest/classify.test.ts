import { describe, expect, it } from "vitest";
import { classify, toArchivePath } from "@/src/ingest/classify";
import { LISTING } from "./fixture";

describe("classify", () => {
  it("treats mockups as display images and _detail shots as details", () => {
    expect(classify("18GTAS-Tee-Collection-72/mockups/18GTAS_T07_Varsity_Eiteen_A.jpg")).toBe(
      "display",
    );
    expect(
      classify("18GTAS-Round-10/mockups/09_Pocket_Jewel_Onyx_with_Gold_Piping_detail.jpg"),
    ).toBe("detail");
  });

  it("recognises display images outside mockups/ by name (brief §4.2)", () => {
    expect(classify("X/Summer_Lookbook_01.jpg")).toBe("display");
    expect(classify("X/Hero_Pinstripe.png")).toBe("display");
    expect(classify("X/front_view.webp")).toBe("display");
  });

  it("treats PDFs, _300dpi PNGs and anything in print/ as print masters", () => {
    expect(classify("18GTAS-Round-10/print/18GTAS_01_FourSquares_BW_on_Black.pdf")).toBe(
      "print_master",
    );
    expect(classify("18GTAS-Round-10/print/18GTAS_01_FourSquares_BW_on_Black_300dpi.png")).toBe(
      "print_master",
    );
    expect(classify("18GTAS-Round-10/print/18GTAS_07_ArchiveLabel_Velvet_Black_visual.png")).toBe(
      "print_master",
    );
    expect(classify("Elsewhere/flyer.pdf")).toBe("print_master");
  });

  it("separates contact sheets, ignores working folders, and reports the rest", () => {
    expect(classify("18GTAS-Round-10/18GTAS_Round10_Board.jpg")).toBe("sheet");
    expect(classify("18GTAS-Tee-Collection-72/18GTAS_Tee_Collection_Sheet_1.jpg")).toBe("sheet");
    expect(classify("18GTAS-Round-10/code/evolution_edition_preview.png")).toBe("ignore");
    expect(classify("_zips/18GTAS_Round10_All_Files.zip")).toBe("ignore");
    expect(classify("Some-Round/random_photo.jpg")).toBe("unknown");
    expect(classify("Some-Round/notes.txt")).toBe("unknown");
  });

  it("normalises Windows paths to archive-relative / paths", () => {
    expect(toArchivePath("18GTAS-Round-10\\mockups\\02_Map_Letters_Black.jpg")).toBe(
      "18GTAS-Round-10/mockups/02_Map_Letters_Black.jpg",
    );
    expect(classify("18GTAS-Round-10\\print\\x.pdf")).toBe("print_master");
  });

  it("classifies every file in the real archive, leaving nothing unknown", () => {
    const counts: Record<string, number> = {};
    for (const p of LISTING) counts[classify(p)] = (counts[classify(p)] ?? 0) + 1;
    expect(counts).toEqual({ display: 106, detail: 3, print_master: 213, sheet: 3, ignore: 4 });
  });
});
