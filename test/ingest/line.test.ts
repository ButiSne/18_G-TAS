import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { groupFamilies } from "@/src/ingest/family";
import { assignLine, parseLineOverrides } from "@/src/ingest/line";
import { ofKind } from "./fixture";

const overrides = parseLineOverrides(
  JSON.parse(readFileSync(new URL("../../data/line-overrides.json", import.meta.url), "utf8")),
);
const fam = (titleTokens: string[], key = "x/01") => ({ key, titleTokens });

describe("assignLine", () => {
  it("uses the override file first", () => {
    expect(assignLine(fam(["Quality", "Stamp"], "tee-collection-72/t14"), overrides)).toMatchObject(
      {
        line: "G-TAS",
        source: "override",
      },
    );
  });

  it("reads upper-case EITEEN / ELDERS labels in the file name", () => {
    expect(assignLine(fam(["EITEEN", "AllOver"]), {})).toMatchObject({
      line: "EITEEN",
      source: "label",
    });
    expect(assignLine(fam(["ELDERS", "Crest"]), {})).toMatchObject({
      line: "G-TAS",
      source: "label",
    });
  });

  it("does not read the title-case words in 'Youth Elders' as a label", () => {
    expect(assignLine(fam(["Youth", "Elders"]), {})).toEqual({
      line: null,
      reason: "No override, label or keyword",
    });
  });

  it("applies the brief's keywords, and refuses to guess when they conflict", () => {
    expect(assignLine(fam(["Square", "Monogram"]), {})).toMatchObject({
      line: "G-TAS",
      source: "keyword",
    });
    expect(assignLine(fam(["Map", "Letters"]), {})).toMatchObject({
      line: "EITEEN",
      source: "keyword",
    });
    expect(assignLine(fam(["XVIII", "Pixel"]), {}).line).toBeNull();
  });

  it("rejects override values other than EITEEN or G-TAS", () => {
    expect(() => parseLineOverrides({ "a/01": "ELDERS" })).toThrow();
  });

  it("decides every tee and exactly the Round 10 designs with a clear signal", () => {
    const { families } = groupFamilies(ofKind("display", "detail"));
    const undecided = families
      .filter((f) => assignLine(f, overrides).line === null)
      .map((f) => f.key);
    expect(undecided).toEqual([
      "round-10/01", // Four Squares
      "round-10/03", // Youth Elders
      "round-10/04", // The Column
      "round-10/07", // Archive Label Velvet
      "round-10/09", // Pocket Jewel
    ]);
    const elders = families
      .filter(
        (f) =>
          f.collection.slug === "tee-collection-72" && assignLine(f, overrides).line === "G-TAS",
      )
      .map((f) => f.familyNo);
    expect(elders).toEqual([
      "t14",
      "t23",
      "t24",
      "t25",
      "t26",
      "t27",
      "t29",
      "t30",
      "t32",
      "t33",
      "t34",
    ]);
  });
});
