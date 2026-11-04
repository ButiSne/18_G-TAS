import { describe, expect, it } from "vitest";
import { formatRand, priceList, quote, quoteRequestUrl, tierFor } from "@/src/lib/printers";

const crew = priceList("crew-neck");
const golf = priceList("golf-shirt");
const cents = (qty: number, list = crew) => tierFor(list, qty)?.cents;

describe("Masumpa price tiers (from the Nov 2026 flyers)", () => {
  it("prices crew necks at each tier boundary", () => {
    expect([1, 10, 11, 20, 21, 30, 31, 40, 41, 499, 500, 10_000].map((q) => cents(q))).toEqual([
      22_500, 22_500, 19_900, 19_900, 18_900, 18_900, 17_900, 17_900, 16_900, 16_900, 16_500,
      16_500,
    ]);
  });

  it("prices golf shirts, covering the gap the flyer leaves at 2,000–4,999", () => {
    expect(
      [10, 11, 30, 40, 41, 500, 1_999, 2_000, 4_999, 5_000].map((q) => cents(q, golf)),
    ).toEqual([30_000, 29_500, 27_935, 26_535, 25_205, 24_949, 24_949, 24_949, 24_949, 24_699]);
    expect(tierFor(golf, 3_000)?.check).toMatch(/Not on the flyer/);
  });

  it("flags the crew-neck tier the flyer prints as 1–19", () => {
    expect(tierFor(crew, 5)?.check).toMatch(/1–19/);
    expect(tierFor(crew, 15)?.check).toBeUndefined();
  });

  it("has no tier for zero, negatives or fractions", () => {
    expect([0, -3, 2.5].map((q) => tierFor(crew, q))).toEqual([null, null, null]);
  });

  it("leaves no quantity from 1 to 6,000 without a price", () => {
    for (const list of [crew, golf])
      for (let q = 1; q <= 6_000; q++)
        expect(tierFor(list, q), `${list.product} ${q}`).not.toBeNull();
  });
});

describe("quote", () => {
  it("adds the R450 set-up fee once per design, and prices each design's own quantity", () => {
    const q = quote([
      { label: "Kasi Halo", product: "crew-neck", quantity: 20 },
      { label: "XVIII Chest", product: "golf-shirt", quantity: 41 },
    ]);
    expect(q.lines.map((l) => [l.unitCents, l.printCents, l.setupCents])).toEqual([
      [19_900, 398_000, 45_000],
      [25_205, 1_033_405, 45_000],
    ]);
    expect(q).toMatchObject({ pieces: 61, setupCents: 90_000, totalCents: 1_521_405 });
    expect(q.checks).toEqual([]);
  });

  it("skips lines with no valid quantity, and collects what to confirm", () => {
    const q = quote([
      { label: "A", product: "crew-neck", quantity: 0 },
      { label: "B", product: "crew-neck", quantity: 5 },
    ]);
    expect(q).toMatchObject({ pieces: 5, totalCents: 5 * 22_500 + 45_000 });
    expect(q.checks).toHaveLength(1);
  });
});

describe("formatRand", () => {
  it("formats cents as South African rand", () => {
    expect(formatRand(27_935).replace(/\s/g, " ")).toBe("R 279,35");
  });
});

describe("quoteRequestUrl", () => {
  it("opens a WhatsApp chat with Masumpa, listing designs, quantities and other methods", () => {
    const url = new URL(
      quoteRequestUrl(
        [{ label: "Kasi Halo", product: "crew-neck", quantity: 20 }],
        [{ label: "XVIII Chest", method: "DTF + gold foil" }],
      ),
    );
    expect(url.origin + url.pathname).toBe("https://wa.me/27607477884");
    const text = url.searchParams.get("text")!;
    expect(text).toContain("1. Kasi Halo: 20 crew necks");
    expect(text).toContain("That's 1 design for the set-up fee.");
    expect(text).toContain("- XVIII Chest (DTF + gold foil)");
    expect(text).toContain("VAT");
  });
});
