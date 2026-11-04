// The final ten splits on one question: is it sublimation or not? (CLAUDE.md §0.1.3)
// The list is the owner's, from the Blob-ready design pack (Nov 2026). Everything that is
// not sublimation shares the "other" five, so adding a method later changes no rule.
export const PRINT_METHODS = [
  "full-sublimation",
  "cotton-sublimation",
  "dtf",
  "dtf-gold-foil",
  "velvet-flock",
  "puff-print",
  "rhinestone",
  "embroidery-or-dtf",
] as const;

export type PrintMethod = (typeof PRINT_METHODS)[number];

export const PRINT_METHOD_LABELS: Record<PrintMethod, string> = {
  "full-sublimation": "Full sublimation",
  "cotton-sublimation": "Cotton sublimation",
  dtf: "DTF",
  "dtf-gold-foil": "DTF + gold foil",
  "velvet-flock": "Velvet flock",
  "puff-print": "Puff print",
  rhinestone: "Rhinestone",
  "embroidery-or-dtf": "Embroidery or DTF",
};

export function isPrintMethod(value: unknown): value is PrintMethod {
  return typeof value === "string" && (PRINT_METHODS as readonly string[]).includes(value);
}

export type FinalSlot = "sublimation" | "other";

const SUBLIMATION: readonly PrintMethod[] = ["full-sublimation", "cotton-sublimation"];

export function slotFor(method: PrintMethod): FinalSlot {
  return SUBLIMATION.includes(method) ? "sublimation" : "other";
}

// Where the print sits on the garment (from the design pack).
export const PLACEMENTS = [
  "all-over",
  "front-centre",
  "left-chest",
  "chest-pocket",
  "back",
] as const;
export type Placement = (typeof PLACEMENTS)[number];

export const PLACEMENT_LABELS: Record<Placement, string> = {
  "all-over": "All-over",
  "front-centre": "Front centre",
  "left-chest": "Left chest",
  "chest-pocket": "Chest pocket",
  back: "Back",
};

export function isPlacement(value: unknown): value is Placement {
  return typeof value === "string" && (PLACEMENTS as readonly string[]).includes(value);
}

/** Short labels for a card: "DTF", "Left chest". Skips what is unknown. */
export function designMeta(d: { printMethod: string | null; placement: string | null }): string[] {
  return [
    isPrintMethod(d.printMethod) ? PRINT_METHOD_LABELS[d.printMethod] : null,
    isPlacement(d.placement) ? PLACEMENT_LABELS[d.placement] : null,
  ].filter((x): x is string => Boolean(x));
}
