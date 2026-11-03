// Links print masters (never uploaded) to the colourway or family they belong to, so the
// production hand-off can list them (CLAUDE.md §4.2, §9).
// Print files are named differently from mockups ("FourSquares" vs "Four_Squares",
// "Column" vs "The_Column"), so matching runs from strict to loose:
//   1. same normalised name as a mockup
//   2. the same after removing a production suffix (_cutfile, _visual, _layer, …)
//   3. same family, and the name ends with a colourway's name (longest wins)
//   4. same family only → attached to the family, not a colourway
// Anything else is reported as unmatched.

import { collectionFor, type FamilyDraft } from "./family.ts";
import { toArchivePath } from "./classify.ts";

export type PrintMatches = {
  /** colourway display-image path → print-master paths */
  byColourway: Map<string, string[]>;
  /** family key → print-master paths that belong to the design as a whole */
  byFamily: Map<string, string[]>;
  unmatched: string[];
};

export const normaliseName = (s: string) =>
  s
    .toLowerCase()
    .replace(/^18\s*g?-?tas[_-]?/, "")
    .replace(/[^a-z0-9]/g, "");

const PRODUCTION_SUFFIX = /_(cutfile|visual|layer|artwork|logo_master|master)$/i;

function printStem(path: string): string {
  const name = path.split("/").at(-1) ?? "";
  return name.replace(/\.[^.]+$/, "").replace(/_300dpi$/i, "");
}

function stripSuffixes(stem: string): string {
  let s = stem;
  while (PRODUCTION_SUFFIX.test(s)) s = s.replace(PRODUCTION_SUFFIX, "");
  return s;
}

function familyNoOf(stem: string): string | null {
  const m = /^(?:18\s*G?-?TAS_)?(T\d{2,3}|\d{2,3})_/i.exec(stem);
  return m ? m[1]!.toLowerCase() : null;
}

const push = (map: Map<string, string[]>, key: string, value: string) =>
  map.set(key, [...(map.get(key) ?? []), value]);

export function matchPrintMasters(families: FamilyDraft[], printPaths: string[]): PrintMatches {
  const byKey = new Map(families.map((f) => [f.key, f]));
  const result: PrintMatches = { byColourway: new Map(), byFamily: new Map(), unmatched: [] };

  for (const raw of [...printPaths].sort()) {
    const path = toArchivePath(raw);
    const stem = printStem(path);
    const familyNo = familyNoOf(stem);
    const family = familyNo ? byKey.get(`${collectionFor(path).slug}/${familyNo}`) : undefined;
    if (!family) {
      result.unmatched.push(path);
      continue;
    }

    const exact = normaliseName(stem);
    const stripped = normaliseName(stripSuffixes(stem));
    const byName =
      family.colourways.find((c) => normaliseName(c.stem) === exact) ??
      family.colourways.find((c) => normaliseName(c.stem) === stripped);
    if (byName) {
      push(result.byColourway, byName.path, path);
      continue;
    }

    const bySuffix = family.colourways
      .filter((c) => !c.letter && normaliseName(c.name).length >= 3)
      .filter((c) => stripped.endsWith(normaliseName(c.name)))
      .sort((a, b) => normaliseName(b.name).length - normaliseName(a.name).length)[0];
    if (bySuffix) {
      push(result.byColourway, bySuffix.path, path);
      continue;
    }

    push(result.byFamily, family.key, path);
  }
  return result;
}
