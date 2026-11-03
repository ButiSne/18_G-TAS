// Assigns each family a line (CLAUDE.md §4.4), most reliable source first:
//   1. data/line-overrides.json (read from the collection sheets, reviewed by the owner)
//   2. an upper-case EITEEN / ELDERS label in the file name
//   3. the brief's keywords: XVIII, Luxe, Atelier, monogram → G-TAS; pixel, street, map,
//      football (and "Eiteen") → EITEEN
// When none decides, or the signals disagree, the answer is null and the family goes in the
// report. The code never picks a line on its own.
//
// An override may mark a design as a crossover: it keeps one primary line but is tagged
// "crossover" so it also shows under the other line (src/lib/design-line.ts).

import { CROSSOVER_TAG, type Line } from "../lib/design-line.ts";

export type { Line };

export type LineDecision =
  | { line: Line; crossover: boolean; source: "override" | "label" | "keyword"; detail: string }
  | { line: null; reason: string };

export type LineOverride = { line: Line; crossover: boolean };
export type LineOverrides = Record<string, LineOverride>;

const G_TAS_KEYWORDS = ["xviii", "luxe", "atelier", "monogram"];
const EITEEN_KEYWORDS = ["pixel", "street", "map", "football", "eiteen"];

const isLine = (v: unknown): v is Line => v === "EITEEN" || v === "G-TAS";

/**
 * Accepts `"EITEEN"`, `"G-TAS"`, or `{ "line": "G-TAS", "crossover": true }` per family key.
 * Keys starting with "_" are comments.
 */
export function parseLineOverrides(json: unknown): LineOverrides {
  const out: LineOverrides = {};
  if (typeof json !== "object" || json === null) return out;
  for (const [key, value] of Object.entries(json)) {
    if (key.startsWith("_")) continue;
    if (isLine(value)) out[key] = { line: value, crossover: false };
    else if (
      typeof value === "object" &&
      value !== null &&
      isLine((value as { line?: unknown }).line)
    ) {
      const v = value as { line: Line; crossover?: unknown };
      out[key] = { line: v.line, crossover: v.crossover === true };
    } else {
      throw new Error(
        `line-overrides.json: "${key}" must be "EITEEN", "G-TAS" or { "line": …, "crossover": true }`,
      );
    }
  }
  return out;
}

export function assignLine(
  family: { key: string; titleTokens: string[] },
  overrides: LineOverrides,
): LineDecision {
  const override = overrides[family.key];
  if (override) {
    return {
      ...override,
      source: "override",
      detail: override.crossover ? `line-overrides.json, ${CROSSOVER_TAG}` : "line-overrides.json",
    };
  }

  const labels = new Set(family.titleTokens.filter((t) => t === "EITEEN" || t === "ELDERS"));
  if (labels.size === 2) return { line: null, reason: "File name carries both EITEEN and ELDERS" };
  if (labels.has("EITEEN")) {
    return { line: "EITEEN", crossover: false, source: "label", detail: "EITEEN label" };
  }
  if (labels.has("ELDERS")) {
    return { line: "G-TAS", crossover: false, source: "label", detail: "ELDERS label" };
  }

  const words = family.titleTokens.map((t) => t.toLowerCase());
  const gtas = G_TAS_KEYWORDS.filter((k) => words.includes(k));
  const eiteen = EITEEN_KEYWORDS.filter((k) => words.includes(k));
  if (gtas.length && eiteen.length) {
    return { line: null, reason: `Conflicting keywords: ${[...gtas, ...eiteen].join(", ")}` };
  }
  if (gtas.length) {
    return { line: "G-TAS", crossover: false, source: "keyword", detail: gtas.join(", ") };
  }
  if (eiteen.length) {
    return { line: "EITEEN", crossover: false, source: "keyword", detail: eiteen.join(", ") };
  }
  return { line: null, reason: "No override, label or keyword" };
}
