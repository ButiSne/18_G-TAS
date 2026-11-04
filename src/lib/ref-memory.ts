// The share-link code a visitor arrived with (?ref=fb, ?ref=wa-umlazi), kept for this
// browser tab so a vote still counts towards that link after they browse the site first:
// a WhatsApp link opens the landing page, and the vote is a tap or two later.
// Session storage, not a cookie (the vote keeps its single functional cookie). It holds a
// channel code only, is cleared when the tab closes, and is read only by the vote.

import { normaliseRef } from "./tally.ts";

const KEY = "gtas_ref";

/** Keeps a valid code from the address bar; anything else is ignored. */
export function rememberRef(raw: string | null | undefined) {
  const ref = normaliseRef(raw);
  if (!ref) return;
  try {
    sessionStorage.setItem(KEY, ref);
  } catch {
    // Private mode or blocked storage: the vote simply counts without a channel.
  }
}

export function rememberedRef(): string | null {
  try {
    return normaliseRef(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}
