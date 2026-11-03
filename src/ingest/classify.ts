// Decides what a file in ./archive is (CLAUDE.md §4.2). Paths are relative to archive/
// with "/" separators, so a path recorded on Windows matches on any machine.
// Anything that fits no rule is "unknown" and goes in the report: never guessed.

export type FileKind =
  | "display" // a mockup, lookbook or hero image: converted and uploaded
  | "detail" // a close-up of a display image (…_detail): a second view of that colourway
  | "print_master" // .pdf, _300dpi.png, or anything in print/: path recorded, never uploaded
  | "sheet" // a contact sheet or board showing many designs at once
  | "ignore" // working folders (code/, _zips/, _local-backup/) and system files
  | "unknown";

const IMAGE = /\.(jpe?g|png|webp)$/i;
const DISPLAY_NAME = /(mockup|lookbook|_view|hero_)/i;
const SHEET_NAME = /(_board|collection_sheet|contact_sheet)/i;

export function toArchivePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.?\/+/, "");
}

export function classify(rawPath: string): FileKind {
  const path = toArchivePath(rawPath);
  const segments = path.split("/");
  const name = segments.at(-1) ?? "";
  const folders = segments.slice(0, -1).map((s) => s.toLowerCase());

  if (segments[0]?.startsWith("_") || name.startsWith(".") || name === "Thumbs.db") return "ignore";
  if (folders.includes("code")) return "ignore";

  if (/\.pdf$/i.test(name) || /_300dpi\.png$/i.test(name)) return "print_master";
  if (folders.includes("print")) return "print_master";

  if (!IMAGE.test(name)) return "unknown";
  if (SHEET_NAME.test(name)) return "sheet";

  const isDisplay = folders.includes("mockups") || DISPLAY_NAME.test(name);
  if (!isDisplay) return "unknown";
  return /_detail\.[a-z]+$/i.test(name) ? "detail" : "display";
}
