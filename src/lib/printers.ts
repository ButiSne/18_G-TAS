// The print partner and its price list, for quoting the final ten (CLAUDE.md §0.1.3).
// Source: Masumpa Corporate Solutions' price flyers (archive/Printing company Masumpa
// Pricing/, Nov 2026). The flyers price full-colour sublimation only. Money is in cents,
// so totals never pick up floating-point pennies.

export type Product = "crew-neck" | "golf-shirt";

export type PriceTier = {
  min: number;
  /** Inclusive; null for "and up". */
  max: number | null;
  cents: number;
  /** Set where the flyer is unclear, so the screen can say "confirm this". */
  check?: string;
};

export type PriceList = {
  product: Product;
  label: string;
  tiers: PriceTier[];
  setupCentsPerDesign: number;
};

export const MASUMPA = {
  name: "Masumpa Corporate Solutions",
  whatsapp: "+27 60 747 7884",
  phone: "060 747 7884",
  email: "info@masumpa.co.za",
  website: "https://www.masumpa.co.za",
  source: "Masumpa price flyers, Nov 2026",
  method: "Full-colour sublimation",
  notes: [
    "Pricing is based on standard birdseye fabric. T&Cs apply.",
    "The flyers don’t say whether prices include VAT.",
    "We apply the quantity tiers per design, because the set-up fee is per design. Ask Masumpa whether they count the whole order instead.",
  ],
  priceLists: [
    {
      product: "crew-neck",
      label: "Crew neck (T-shirt)",
      setupCentsPerDesign: 45_000,
      tiers: [
        {
          min: 1,
          max: 10,
          cents: 22_500,
          check:
            "The flyer says 1–19, which overlaps 11–20. Read as 1–10, like the golf shirt list.",
        },
        { min: 11, max: 20, cents: 19_900 },
        { min: 21, max: 30, cents: 18_900 },
        { min: 31, max: 40, cents: 17_900 },
        { min: 41, max: 499, cents: 16_900 },
        { min: 500, max: null, cents: 16_500 },
      ],
    },
    {
      product: "golf-shirt",
      label: "Golf shirt",
      setupCentsPerDesign: 45_000,
      tiers: [
        { min: 1, max: 10, cents: 30_000 },
        { min: 11, max: 20, cents: 29_500 },
        { min: 21, max: 30, cents: 27_935 },
        { min: 31, max: 40, cents: 26_535 },
        { min: 41, max: 499, cents: 25_205 },
        { min: 500, max: 1_999, cents: 24_949 },
        {
          min: 2_000,
          max: 4_999,
          cents: 24_949,
          check: "Not on the flyer: priced at the 500–1,999 rate until Masumpa confirms.",
        },
        { min: 5_000, max: null, cents: 24_699 },
      ],
    },
  ] satisfies PriceList[],
} as const;

export const priceList = (product: Product): PriceList =>
  MASUMPA.priceLists.find((p) => p.product === product)!;

/** The tier a quantity falls in, or null for anything below 1 or not a whole number. */
export function tierFor(list: PriceList, quantity: number): PriceTier | null {
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  return list.tiers.find((t) => quantity >= t.min && (t.max === null || quantity <= t.max)) ?? null;
}

export type QuoteLine = { label: string; product: Product; quantity: number };

export type QuotedLine = QuoteLine & {
  tier: PriceTier | null;
  unitCents: number;
  printCents: number;
  setupCents: number;
  totalCents: number;
};

/** Each line is one design: its pieces at the tier price, plus the once-off set-up fee. */
export function quote(lines: QuoteLine[]) {
  const quoted: QuotedLine[] = lines.map((line) => {
    const list = priceList(line.product);
    const tier = tierFor(list, line.quantity);
    const unitCents = tier?.cents ?? 0;
    const printCents = tier ? unitCents * line.quantity : 0;
    const setupCents = tier ? list.setupCentsPerDesign : 0;
    return {
      ...line,
      tier,
      unitCents,
      printCents,
      setupCents,
      totalCents: printCents + setupCents,
    };
  });
  const sum = (k: "printCents" | "setupCents" | "totalCents" | "quantity") =>
    quoted.reduce((n, l) => n + (l.tier ? l[k] : 0), 0);
  return {
    lines: quoted,
    pieces: sum("quantity"),
    printCents: sum("printCents"),
    setupCents: sum("setupCents"),
    totalCents: sum("totalCents"),
    checks: [...new Set(quoted.flatMap((l) => (l.tier?.check ? [l.tier.check] : [])))],
  };
}

const rand = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" });
/** 27935 → "R 279,35" (South African format). */
export const formatRand = (cents: number) => rand.format(cents / 100);

/** The quote request the admin sends Masumpa on WhatsApp, with the designs and quantities. */
export function quoteRequestUrl(
  lines: QuoteLine[],
  others: { label: string; method: string }[] = [],
): string {
  const label = (p: Product) => (p === "crew-neck" ? "crew necks" : "golf shirts");
  const text = [
    "Hi Masumpa, this is 18 G-TAS (KZN). Please quote full-colour sublimation:",
    ...lines.map((l, i) => `${i + 1}. ${l.label}: ${l.quantity} ${label(l.product)}`),
    `That's ${lines.length} design${lines.length === 1 ? "" : "s"} for the set-up fee.`,
    ...(others.length
      ? [
          "If you also do these, please quote them too:",
          ...others.map((o) => `- ${o.label} (${o.method})`),
        ]
      : []),
    "Print-ready files (300 dpi PNG / PDF) are ready. Please confirm whether the prices include VAT. Thank you!",
  ].join("\n");
  return `https://wa.me/${MASUMPA.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
