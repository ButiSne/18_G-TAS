// Groups display images into design families (CLAUDE.md §4.3).
// Two naming schemes exist in the archive:
//   Tee Collection 72:  18GTAS_T07_Varsity_Eiteen_A.jpg   → family T07, colourway A
//   Round 10:           01_Four_Squares_BW_on_Black.jpg   → family 01, colourway "BW on Black"
// In the second scheme the colourway is whatever follows the tokens all members share.

import { toArchivePath } from "./classify.ts";

export type Collection = { folder: string; slug: string; title: string; code: string };

export type ColourwayDraft = {
  /** Archive path of the display image. */
  path: string;
  /** File name without extension, used to match print masters. */
  stem: string;
  /** Name taken from the file name: "A", "BW on Black", … */
  name: string;
  /** Single-letter colourway (A, B…) from the tee scheme, else null. */
  letter: string | null;
  /** Tokens after the title, used to read the tee colour from the name. */
  tokens: string[];
  detailPaths: string[];
};

export type FamilyDraft = {
  key: string; // "<collection slug>/<family no>", stable across re-runs
  collection: Collection;
  familyNo: string;
  title: string;
  slug: string;
  titleTokens: string[];
  colourways: ColourwayDraft[];
  notes: string[];
};

export type ParsedMockup = {
  familyNo: string;
  tokens: string[];
  letter: string | null;
  isDetail: boolean;
  stem: string;
};

const COLOUR_WORDS = new Set([
  "black",
  "white",
  "maroon",
  "navy",
  "olive",
  "sand",
  "cream",
  "wine",
  "forest",
  "midnight",
  "onyx",
  "ivory",
  "gold",
  "silver",
  "green",
  "red",
  "blue",
  "pink",
  "teal",
  "coral",
  "lime",
  "purple",
  "grey",
  "gray",
  "charcoal",
  "bw",
  "colour",
  "color",
  "mixed",
]);

export const isColourWord = (token: string) => COLOUR_WORDS.has(token.toLowerCase());

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "18GTAS-Tee-Collection-72" → slug tee-collection-72, title "Tee Collection 72", code tc72. */
export function collectionFor(path: string): Collection {
  const folder = toArchivePath(path).split("/")[0] ?? "";
  const bare = folder.replace(/^18\s*G?-?TAS[-_ ]*/i, "") || folder;
  const words = bare.split(/[-_ ]+/).filter(Boolean);
  return {
    folder,
    slug: slugify(bare),
    title: words.join(" "),
    code: words.map((w) => (/^\d+$/.test(w) ? w : w[0]!.toLowerCase())).join(""),
  };
}

export function parseMockupName(fileName: string): ParsedMockup | null {
  const stem = fileName.replace(/\.[^.]+$/, "");
  const isDetail = /_detail$/i.test(stem);
  const base = stem.replace(/_detail$/i, "").replace(/^18\s*G?-?TAS_/i, "");

  const tee = /^T(\d{2,3})_(.+)$/i.exec(base);
  const numbered = /^(\d{2,3})_(.+)$/.exec(base);
  const match = tee ?? numbered;
  if (!match) return null;

  const tokens = match[2]!.split("_").filter(Boolean);
  let letter: string | null = null;
  if (tee && tokens.length > 1 && /^[A-Z]$/.test(tokens.at(-1)!)) letter = tokens.pop()!;

  return {
    familyNo: tee ? `t${match[1]}` : match[1]!,
    tokens,
    letter,
    isDetail,
    stem,
  };
}

function commonPrefix(lists: string[][]): string[] {
  const first = lists[0] ?? [];
  let n = first.length;
  for (const list of lists.slice(1)) {
    let i = 0;
    while (i < n && i < list.length && list[i]!.toLowerCase() === first[i]!.toLowerCase()) i++;
    n = i;
  }
  return first.slice(0, n);
}

/** Cut a title before its first colour word, but never down to nothing. */
function cutAtColour(tokens: string[]): string[] {
  const i = tokens.findIndex((t, idx) => idx > 0 && isColourWord(t));
  return i > 0 ? tokens.slice(0, i) : tokens;
}

export function groupFamilies(paths: string[]): { families: FamilyDraft[]; unmatched: string[] } {
  const unmatched: string[] = [];
  const groups = new Map<
    string,
    { collection: Collection; familyNo: string; files: { path: string; parsed: ParsedMockup }[] }
  >();

  for (const raw of [...paths].sort()) {
    const path = toArchivePath(raw);
    const name = path.split("/").at(-1) ?? "";
    const parsed = parseMockupName(name);
    if (!parsed) {
      unmatched.push(path);
      continue;
    }
    const collection = collectionFor(path);
    const key = `${collection.slug}/${parsed.familyNo}`;
    const group = groups.get(key) ?? { collection, familyNo: parsed.familyNo, files: [] };
    group.files.push({ path, parsed });
    groups.set(key, group);
  }

  const families: FamilyDraft[] = [];
  for (const [key, group] of groups) {
    const notes: string[] = [];
    const mains = group.files.filter((f) => !f.parsed.isDetail);
    const details = group.files.filter((f) => f.parsed.isDetail);
    if (mains.length === 0) {
      unmatched.push(...details.map((d) => d.path));
      continue;
    }

    let titleTokens: string[];
    const lettered = mains.every((m) => m.parsed.letter);
    if (lettered) {
      titleTokens = mains[0]!.parsed.tokens;
      const differ = mains.some((m) => m.parsed.tokens.join("_") !== titleTokens.join("_"));
      if (differ)
        notes.push("Colourways have different names; the first one is used as the title.");
    } else if (mains.length === 1) {
      titleTokens = cutAtColour(mains[0]!.parsed.tokens);
      if (titleTokens.length === mains[0]!.parsed.tokens.length) {
        notes.push("Single image with no colour in its name; colourway called “Original”.");
      }
    } else {
      titleTokens = cutAtColour(commonPrefix(mains.map((m) => m.parsed.tokens)));
      if (titleTokens.length === 0) {
        titleTokens = mains[0]!.parsed.tokens;
        notes.push("Colourways share no common name; the first file name is used as the title.");
      }
    }

    const colourways: ColourwayDraft[] = mains.map((m) => {
      const tokens = m.parsed.letter ? [] : m.parsed.tokens.slice(titleTokens.length);
      return {
        path: m.path,
        stem: m.parsed.stem,
        name: m.parsed.letter ?? (tokens.join(" ") || "Original"),
        letter: m.parsed.letter,
        tokens,
        detailPaths: [],
      };
    });

    for (const d of details) {
      const owner = colourways.find(
        (c) => c.stem.toLowerCase() === d.parsed.stem.replace(/_detail$/i, "").toLowerCase(),
      );
      if (owner) owner.detailPaths.push(d.path);
      else {
        unmatched.push(d.path);
        notes.push(`Detail image has no matching colourway: ${d.path}`);
      }
    }

    const title = titleTokens.join(" ");
    families.push({
      key,
      collection: group.collection,
      familyNo: group.familyNo,
      title,
      slug: slugify(`${title} ${group.collection.code} ${group.familyNo}`),
      titleTokens,
      colourways,
      notes,
    });
  }

  families.sort((a, b) => a.key.localeCompare(b.key));
  return { families, unmatched };
}
