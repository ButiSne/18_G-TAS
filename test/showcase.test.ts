import { describe, expect, it } from "vitest";
import { shortlistFor, stripSample, summarise, votingState } from "@/src/lib/showcase";

const row = (id: string, line: "EITEEN" | "G-TAS", blur: string | null = `data:${id}`) => ({
  id,
  line,
  blur,
});

describe("summarise (landing page first look)", () => {
  it("counts designs per line", () => {
    const s = summarise([row("a", "EITEEN"), row("b", "EITEEN"), row("c", "G-TAS")], 10);
    expect(s.total).toBe(3);
    expect(s.byLine).toEqual({ EITEEN: 2, "G-TAS": 1 });
  });

  it("alternates the lines so the strip mixes both moods", () => {
    const s = summarise(
      [row("e1", "EITEEN"), row("e2", "EITEEN"), row("e3", "EITEEN"), row("g1", "G-TAS")],
      10,
    );
    expect(s.teasers.map((t) => t.id)).toEqual(["e1", "g1", "e2", "e3"]);
  });

  it("respects the limit and skips designs without a placeholder", () => {
    const s = summarise(
      [row("e1", "EITEEN", null), row("e2", "EITEEN"), row("g1", "G-TAS"), row("g2", "G-TAS")],
      2,
    );
    expect(s.teasers.map((t) => t.id)).toEqual(["e2", "g1"]);
    expect(s.total).toBe(4); // counted even without a placeholder
  });

  it("handles an empty catalogue", () => {
    expect(summarise([], 10)).toEqual({ total: 0, byLine: { EITEEN: 0, "G-TAS": 0 }, teasers: [] });
  });
});

describe("votingState", () => {
  it("maps the public round's status to what the landing page says", () => {
    expect(votingState(null)).toBe("none");
    expect(votingState("draft")).toBe("soon");
    expect(votingState("open")).toBe("open");
    expect(votingState("closed")).toBe("closed");
    expect(votingState("published")).toBe("published");
    expect(votingState("weird")).toBe("none");
  });
});

describe("shortlistFor", () => {
  const card = (slug: string, line: "EITEEN" | "G-TAS", tags: string[] = []) => ({
    designId: slug,
    slug,
    title: slug,
    line,
    tags,
    colourwayName: "Black",
    thumbUrl: `https://x/${slug}.webp`,
    blurDataUrl: null,
  });
  const show = {
    total: 44,
    byLine: { EITEEN: 29, "G-TAS": 15 },
    teasers: [],
    voting: "open" as const,
    shortlist: [card("a", "EITEEN"), card("b", "G-TAS"), card("c", "G-TAS", ["crossover"])],
    strip: [],
  };

  it("shows only the shortlisted designs of a line, crossovers in both", () => {
    expect(shortlistFor(show, "EITEEN").map((c) => c.slug)).toEqual(["a", "c"]);
    expect(shortlistFor(show, "G-TAS").map((c) => c.slug)).toEqual(["b", "c"]);
  });
});

describe("stripSample (the landing strip from a long shortlist)", () => {
  const cards = [
    ...Array.from({ length: 43 }, (_, i) => ({ id: `e${i}`, line: "EITEEN" as const })),
    ...Array.from({ length: 47 }, (_, i) => ({ id: `g${i}`, line: "G-TAS" as const })),
  ];

  it("carries at most 30, half from each line, with no repeats", () => {
    const s = stripSample(cards, 30, "abc");
    expect(s).toHaveLength(30);
    expect(new Set(s.map((c) => c.id)).size).toBe(30);
    expect(s.filter((c) => c.line === "EITEEN")).toHaveLength(15);
  });

  it("is the same for the same seed and different for another", () => {
    const ids = (seed: string) => stripSample(cards, 30, seed).map((c) => c.id);
    expect(ids("abc")).toEqual(ids("abc"));
    expect(ids("abc")).not.toEqual(ids("xyz"));
  });

  it("shows a short shortlist whole, and fills up from the bigger line when one runs out", () => {
    expect(stripSample(cards.slice(0, 20), 30, "abc")).toHaveLength(20);
    const lopsided = [...cards.slice(0, 5), ...cards.slice(43)];
    const s = stripSample(lopsided, 30, "abc");
    expect(s).toHaveLength(30);
    expect(s.filter((c) => c.line === "EITEEN")).toHaveLength(5);
  });
});
