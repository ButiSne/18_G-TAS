// Site-wide facts used by pages, the footer and share links.

export const LEGAL_NAME = "18 G-TAS Custom Clothing & Design";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://18g-tas.vercel.app").replace(
  /\/+$/,
  "",
);

/** Public contact address for privacy and copyright requests. Null until the owner sets it. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || null;

/**
 * Footer links, in display order. Competition rules are deliberately absent: there is no
 * prize draw, and /rules is linked only if the admin turns the competition flag on.
 */
export const LEGAL_LINKS = [
  { key: "terms", href: "/terms" },
  { key: "privacy", href: "/privacy" },
  { key: "data", href: "/privacy#data" },
  { key: "cookies", href: "/privacy#cookies" },
  { key: "copyright", href: "/copyright" },
  { key: "contact", href: "/privacy#contact" },
] as const;

/**
 * A WhatsApp share link. The shared URL carries ?ref= so the results can show which
 * channel brought votes (CLAUDE.md §0.1). wa.me works in the app and on the web.
 */
export function whatsappShareUrl(text: string, ref = "wa-share"): string {
  const link = `${SITE_URL}/?ref=${encodeURIComponent(ref)}`;
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`;
}
