// ingest-report.md (CLAUDE.md §4, HANDOVER §7 step 3): what the owner reviews before the
// first real upload. Decisions the owner must make come first; the full catalogue last.

import type { IngestStats, Plan } from "./run.ts";

const cell = (s: string | number) => String(s).replace(/\|/g, "\\|");
const row = (...cells: (string | number)[]) => `| ${cells.map(cell).join(" | ")} |`;
const code = (s: string) => `\`${s}\``;

function table(head: string[], rows: (string | number)[][]): string[] {
  if (rows.length === 0) return ["_None._", ""];
  return [row(...head), row(...head.map(() => "---")), ...rows.map((r) => row(...r)), ""];
}

export function renderReport(
  plan: Plan,
  opts: { mode: "dry-run" | "live"; generatedAt: Date; store?: string; stats?: IngestStats },
): string {
  const f = plan.families;
  const undecided = f.filter((x) => x.line.line === null);
  const flagged = f.filter((x) => x.brandFlags.length > 0);
  const noted = f.filter((x) => x.notes.length > 0);
  const colourways = f.reduce((n, x) => n + x.colourways.length, 0);
  const byLine = (l: string) => f.filter((x) => x.line.line === l).length;
  const familyPrints = f.filter((x) => x.familyPrintFiles.length > 0);
  const colourChecks = f.flatMap((x) =>
    x.colourways
      .filter((c) => !c.teeColour || (c.nameColour && c.nameColour !== c.teeColour))
      .map((c) => ({ ...c, family: x })),
  );

  const out: string[] = [
    "# Ingest report",
    "",
    `Generated ${opts.generatedAt.toISOString()} · **${opts.mode === "dry-run" ? "DRY RUN: nothing was uploaded or written" : "LIVE RUN"}**` +
      (opts.store ? ` · images: ${opts.store}` : ""),
    "",
    "## Summary",
    "",
    ...table(
      ["What", "Count"],
      [
        ["Design families", f.length],
        ["Colourways", colourways],
        [
          "EITEEN / G-TAS / undecided",
          `${byLine("EITEEN")} / ${byLine("G-TAS")} / ${undecided.length}`,
        ],
        ["Display images / detail shots", `${plan.counts.display} / ${plan.counts.detail}`],
        ["Print masters (paths recorded, not uploaded)", plan.counts.print_master],
        ["Contact sheets / ignored files", `${plan.counts.sheet} / ${plan.counts.ignore}`],
        ["Duplicates removed", plan.duplicates.length],
        ["Brand-name flags", flagged.length],
        [
          "Unknown or unmatched files",
          plan.unknown.length + plan.unmatchedImages.length + plan.unmatchedPrints.length,
        ],
      ],
    ),
  ];

  if (opts.stats) {
    const s = opts.stats;
    const c = (x: { inserted: number; updated: number; unchanged: number }) =>
      `${x.inserted} new · ${x.updated} updated · ${x.unchanged} unchanged`;
    out.push(
      "### What this run changed",
      "",
      ...table(
        ["Table", "Result"],
        [
          ["collection", c(s.collections)],
          ["design", c(s.designs)],
          ["colourway", c(s.colourways)],
          ["images", `${s.images.uploaded} uploaded · ${s.images.alreadyStored} already stored`],
          ["skipped (no line yet)", s.skippedNoLine.length],
        ],
      ),
      "Designs already in the database keep their title, line and tags, so edits made in " +
        "/admin/designs survive a re-run. Changing `data/line-overrides.json` only affects " +
        "designs imported for the first time.",
      "",
    );
  }

  out.push(
    "## Needs a decision: line",
    "",
    "These families have no override, EITEEN/ELDERS label or brief keyword, so ingest does not guess. " +
      "They are **not imported** until a line is set. Add each one to `data/line-overrides.json` " +
      '(e.g. `"round-10/01": "EITEEN"`) and run ingest again.',
    "",
    ...table(
      ["Family key", "Title", "Colourways", "Why"],
      undecided.map((x) => [
        code(x.key),
        x.title,
        x.colourways.map((c) => c.name).join(", "),
        x.line.line === null ? x.line.reason : "",
      ]),
    ),
    "## Brand-name flags (CLAUDE.md §6)",
    "",
    ...table(
      ["Family key", "Title", "Flagged"],
      flagged.map((x) => [code(x.key), x.title, x.brandFlags.join(", ")]),
    ),
    "## Unknown and unmatched files",
    "",
    ...table(
      ["File", "Problem"],
      [
        ...plan.unknown.map((p) => [code(p), "Unknown file type or location"]),
        ...plan.unmatchedImages.map((p) => [code(p), "Display image name fits no family pattern"]),
        ...plan.unmatchedPrints.map((p) => [code(p), "Print master matches no family"]),
      ],
    ),
    "## Duplicates removed",
    "",
    ...table(
      ["Removed", "Same image as"],
      plan.duplicates.map((d) => [code(d.path), code(d.duplicateOf)]),
    ),
    "## Notes on grouping",
    "",
    ...table(
      ["Family key", "Note"],
      noted.flatMap((x) => x.notes.map((n) => [code(x.key), n])),
    ),
    "## Tee colour checks",
    "",
    "Tee colour comes from the mockup's sleeves; the file name is the fallback. Listed here: " +
      "colourways with no colour (the catalogue filter will not find them), and those where the " +
      "name suggests a different colour. The admin can correct either.",
    "",
    ...table(
      ["Colourway image", "Used", "Name suggests"],
      colourChecks.map((c) => [
        code(c.path.split("/").at(-1)!),
        c.teeColour ?? "**none**",
        c.nameColour ?? "",
      ]),
    ),
    "## Print masters attached to a whole design",
    "",
    ...table(
      ["Family key", "Files"],
      familyPrints.map((x) => [
        code(x.key),
        x.familyPrintFiles.map((p) => p.split("/").at(-1)!).join(", "),
      ]),
    ),
    "## Contact sheets (not imported)",
    "",
    ...plan.sheets.map((s) => `- ${code(s)}`),
    "",
    "## All families",
    "",
    ...table(
      ["Family key", "Title", "Line", "Colourways", "Print files", "Slug"],
      f.map((x) => [
        code(x.key),
        x.title,
        x.line.line
          ? `${x.line.line}${x.line.crossover ? " × crossover" : ""} (${x.line.source})`
          : "**undecided**",
        x.colourways.map((c) => (c.detailPaths.length ? `${c.name} +detail` : c.name)).join(", "),
        x.colourways.reduce((n, c) => n + c.printFiles.length, 0) + x.familyPrintFiles.length,
        code(x.slug),
      ]),
    ),
  );
  return out.join("\n");
}
