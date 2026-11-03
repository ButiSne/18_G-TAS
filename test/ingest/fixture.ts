import { readFileSync } from "node:fs";
import { classify } from "@/src/ingest/classify";

// Every file in the two archive zips (names only), exported on 3 Nov 2026:
// 18GTAS_Round10_All_Files.zip and 18GTAS_Tee_Collection_72_All_Files.zip.
export const LISTING = readFileSync(
  new URL("../fixtures/archive-listing.txt", import.meta.url),
  "utf8",
)
  .split(/\r?\n/)
  .filter(Boolean);

export const ofKind = (...kinds: string[]) => LISTING.filter((p) => kinds.includes(classify(p)));
