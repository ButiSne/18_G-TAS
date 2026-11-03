import en from "@/messages/en.json";

// Strings live in /messages so isiZulu (zu.json) can be added without touching pages.
export type Messages = typeof en;

export function getMessages(): Messages {
  return en;
}

/** Fills {name} placeholders: fill("{count} designs", { count: 44 }) → "44 designs". */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
