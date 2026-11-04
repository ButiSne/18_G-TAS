// Tee colour for the catalogue filter (CLAUDE.md §8) and for naming lettered colourways:
// "Kasi Halo · Black" says more to a voter than "Kasi Halo · A".
// Ingest samples the mockup's sleeves first, because names can mislead ("Matrix Green" is
// a green print on a black tee). The name is the fallback when the sample matches no
// swatch, and a colourway with neither is reported, not guessed.

export const TEE_COLOURS = [
  "Black",
  "White",
  "Cream",
  "Grey",
  "Navy",
  "Green",
  "Maroon",
  "Purple",
  "Olive",
  "Sand",
  "Blue",
  "Teal",
  "Mint",
  "Red",
  "Coral",
  "Gold",
  "Pink",
] as const;
export type TeeColour = (typeof TEE_COLOURS)[number];

/** Words used in file names → canonical tee colour. Print colours (gold, silver) are absent. */
const NAME_TO_TEE: Record<string, TeeColour> = {
  black: "Black",
  onyx: "Black",
  white: "White",
  cream: "Cream",
  ivory: "Cream",
  grey: "Grey",
  gray: "Grey",
  charcoal: "Grey",
  navy: "Navy",
  midnight: "Navy",
  green: "Green",
  forest: "Green",
  maroon: "Maroon",
  wine: "Maroon",
  purple: "Purple",
  olive: "Olive",
  sand: "Sand",
};

/**
 * Sleeve colours as they render in the archive's mockup template (sRGB), measured on
 * 3 Nov 2026 from mockups whose names state the tee colour. White renders as a shaded
 * (208, 207, 203), so ideal swatches would misread it as cream.
 */
const SWATCHES: Partial<Record<TeeColour, [number, number, number]>> = {
  Black: [14, 14, 14],
  White: [208, 207, 203],
  Cream: [203, 196, 178],
  Grey: [50, 53, 60],
  Navy: [23, 37, 64],
  Green: [16, 50, 36],
  Maroon: [64, 12, 24],
  Purple: [37, 24, 54],
  Olive: [63, 70, 27],
  Sand: [184, 169, 140],
};

/** Beyond this ΔE no swatch is a credible match (e.g. all-over prints cover the sleeves). */
const MAX_DELTA_E = 15;

type Rgb = [number, number, number];

/** sRGB → CIE L*a*b* (D65). Dark tees are close in RGB but far apart in Lab hue. */
export function toLab([r, g, b]: Rgb): Rgb {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export const deltaE = (a: Rgb, b: Rgb) => {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

/** "on Black" → Black; else the first colour word; else the last. Null when the name has none. */
export function teeColourFromName(tokens: string[]): TeeColour | null {
  const lower = tokens.map((t) => t.toLowerCase());
  const on = lower.lastIndexOf("on");
  if (on >= 0 && lower[on + 1] && NAME_TO_TEE[lower[on + 1]!]) return NAME_TO_TEE[lower[on + 1]!]!;
  if (lower[0] && NAME_TO_TEE[lower[0]]) return NAME_TO_TEE[lower[0]]!;
  const last = lower.at(-1);
  if (last && NAME_TO_TEE[last]) return NAME_TO_TEE[last]!;
  return null;
}

/**
 * Nearest swatch by CIE76 ΔE, or null when nothing is close: then the name decides, or
 * the report asks a person.
 */
export function nearestTeeColour(rgb: Rgb): TeeColour | null {
  let best: TeeColour | null = null;
  let bestDistance = MAX_DELTA_E;
  for (const [name, swatch] of Object.entries(SWATCHES) as [TeeColour, Rgb][]) {
    const d = deltaE(rgb, swatch);
    if (d < bestDistance) {
      bestDistance = d;
      best = name;
    }
  }
  return best;
}

/**
 * Lettered colourways (A, B) take their tee colour as the display name. If two share a
 * colour, the letter is kept to tell them apart: "Black (A)", "Black (B)".
 */
export function nameLetteredColourways(
  colourways: { letter: string | null; name: string; teeColour: TeeColour | null }[],
): string[] {
  const counts = new Map<string, number>();
  for (const c of colourways)
    if (c.teeColour) counts.set(c.teeColour, (counts.get(c.teeColour) ?? 0) + 1);
  return colourways.map((c) => {
    if (!c.letter || !c.teeColour) return c.name;
    return (counts.get(c.teeColour) ?? 0) > 1 ? `${c.teeColour} (${c.letter})` : c.teeColour;
  });
}

/**
 * Reference tee colours for the design pack's hex values (true fabric colours, not the
 * shaded mockup renders that SWATCHES measures). Several references per name, so that a
 * charcoal and a light grey both land on Grey.
 */
const HEX_REFERENCES: Record<TeeColour, string[]> = {
  Black: ["#111111", "#0D0D0D"],
  White: ["#F4F3EF", "#FFFFFF", "#E5E5E2"],
  Cream: ["#F3EDE2", "#EFE6D2", "#E9E3D6"],
  Grey: ["#3B3F47", "#666860"],
  Navy: ["#141B2D", "#1C2C4C", "#0C1F3F"],
  Green: ["#0F3D26", "#0B5A3C"],
  Maroon: ["#4A0F1C", "#5A1A22"],
  Purple: ["#2B1C40", "#4B1D7A"],
  Olive: ["#4B5320"],
  Sand: ["#D9C8A6"],
  Blue: ["#2C6E9E", "#1F3A8A", "#1D4FD8", "#002395"],
  Teal: ["#13333D", "#073B4C"],
  Mint: ["#A9D9C3"],
  Red: ["#AF211A", "#DE3831"],
  Coral: ["#EF8A6E", "#FF6B35"],
  Gold: ["#FFB612", "#C9A24A"],
  Pink: ["#FF3EA5"],
};

/** "#0d0d0d" → [13, 13, 13]; null for anything that is not a 6-digit hex colour. */
export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** "#0d0d0d" → "#0D0D0D", so the same colour is stored one way. */
export const normaliseHex = (hex: string) => {
  const rgb = parseHex(hex);
  return rgb
    ? `#${rgb
        .map((c) => c.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()}`
    : null;
};

/**
 * The filter colour for a stated tee hex: always the nearest name, because the pack states
 * the colour outright (unlike a sampled mockup, nothing here can be "printed over").
 */
export function teeColourFromHex(hex: string): TeeColour | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  let best: TeeColour | null = null;
  let bestDistance = Infinity;
  for (const [name, refs] of Object.entries(HEX_REFERENCES) as [TeeColour, string[]][]) {
    for (const ref of refs) {
      const d = deltaE(rgb, parseHex(ref)!);
      if (d < bestDistance) {
        bestDistance = d;
        best = name;
      }
    }
  }
  return best;
}
