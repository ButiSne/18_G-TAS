import { describe, expect, it } from "vitest";
import { normaliseRef, tallyByRef, tallyFavourites } from "@/src/lib/tally";

const v = (entryId: string, ref: string | null = null) => ({ entryId, ref, ageBracket: null });

describe("tallyFavourites", () => {
  it("counts votes and gives a percentage of all votes", () => {
    const r = tallyFavourites([v("a"), v("a"), v("a"), v("b")]);
    expect(r).toEqual([
      { entryId: "a", votes: 3, percent: 75 },
      { entryId: "b", votes: 1, percent: 25 },
    ]);
  });

  it("returns nothing for no votes", () => {
    expect(tallyFavourites([])).toEqual([]);
  });
});

describe("tallyByRef", () => {
  it("splits by share channel and keeps ref-less votes as direct", () => {
    const r = tallyByRef([v("a", "fb"), v("b", "wa-umlazi"), v("a", null)]);
    expect(Object.keys(r).sort()).toEqual(["direct", "fb", "wa-umlazi"]);
    expect(r.direct?.[0]).toMatchObject({ entryId: "a", votes: 1 });
  });
});

describe("normaliseRef", () => {
  it("keeps short slugs and lower-cases them", () => {
    expect(normaliseRef("FB")).toBe("fb");
    expect(normaliseRef("wa-umlazi-youth")).toBe("wa-umlazi-youth");
  });

  it("drops anything that is not a slug, so no free text is stored from a URL", () => {
    expect(normaliseRef("Sipho 082 555 1234")).toBeNull();
    expect(normaliseRef("<script>")).toBeNull();
    expect(normaliseRef("")).toBeNull();
    expect(normaliseRef("x".repeat(41))).toBeNull();
  });
});
