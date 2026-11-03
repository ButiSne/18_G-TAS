// The final ten splits on one question: is it sublimation or not? (CLAUDE.md §0.1.3)
// Everything else on this list shares the "other" five, so adding a method later
// changes no rule. The list itself is still TO BE CONFIRMED by the owner.
export const PRINT_METHODS = [
  "sublimation",
  "dtf",
  "screen_print",
  "vinyl",
  "embroidery",
  "puff",
] as const;

export type PrintMethod = (typeof PRINT_METHODS)[number];

export const PRINT_METHOD_LABELS: Record<PrintMethod, string> = {
  sublimation: "Sublimation",
  dtf: "DTF",
  screen_print: "Screen print",
  vinyl: "Vinyl",
  embroidery: "Embroidery",
  puff: "Puff print",
};

export function isPrintMethod(value: unknown): value is PrintMethod {
  return typeof value === "string" && (PRINT_METHODS as readonly string[]).includes(value);
}

export type FinalSlot = "sublimation" | "other";

export function slotFor(method: PrintMethod): FinalSlot {
  return method === "sublimation" ? "sublimation" : "other";
}
