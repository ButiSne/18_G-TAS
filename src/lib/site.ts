// Site-wide facts used by pages, the footer and share links.

/** Registered business name, and the name it trades under. */
export const LEGAL_NAME = "18 G-TAS Custom Clothing & Design";
export const TRADING_NAME = "18 G-TAS";
export const LEGAL_NAME_FULL = `${LEGAL_NAME}, trading as ${TRADING_NAME}`;

/**
 * The link-preview card for WhatsApp, Facebook and X, written by `pnpm brand-assets`.
 * A plain path with no query string, as a baseline JPEG: some WhatsApp versions are
 * fussy about both. WhatsApp caches previews per URL, so after changing the card,
 * bump SHARE_VERSION and run `pnpm brand-assets` again: the image and every shared link
 * get a new address, so WhatsApp fetches a fresh preview instead of showing the old card.
 */
export const SHARE_VERSION = 4;

export const SHARE_IMAGE = {
  path: `/og/18gtas-share-v${SHARE_VERSION}.jpg`,
  width: 1200,
  height: 630,
  alt: "18 G-TAS is back: the 18 G-TAS triangle logo in gold, Est. 2008, back 2026. Help choose the first drop.",
} as const;

/** POPIA information officer (section 55), named on the privacy page. */
export const INFORMATION_OFFICER = "Snethemba Hlongwane";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://18g-tas.vercel.app").replace(
  /\/+$/,
  "",
);

/** Public contact: the brand's WhatsApp line. An email can be added via NEXT_PUBLIC_CONTACT_EMAIL. */
export const CONTACT_WHATSAPP = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || "+27 74 673 0051";
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || null;

/**
 * The 18 G-TAS WhatsApp group: "Contact us" in the footer opens it. A group is public to its
 * members, so private matters (privacy requests, team sign-in help) use the direct line
 * above instead. Kept exactly as WhatsApp issued it.
 */
export const WHATSAPP_GROUP_URL =
  process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL ||
  "https://chat.whatsapp.com/EqzlCXawVetEgIpqxjFG6c?s=cl&p=a&mlu=4&ilr=4&iam=2";

/** wa.me wants the number in international format with digits only: +27 74… → 2774… */
export function whatsappChatUrl(number = CONTACT_WHATSAPP): string {
  return `https://wa.me/${number.replace(/\D/g, "")}`;
}

/**
 * A WhatsApp share link. The shared URL carries ?ref= so the results can show which
 * channel brought votes (CLAUDE.md §0.1). wa.me works in the app and on the web.
 */
export function whatsappShareUrl(text: string, ref = "wa-share", path = "/"): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${shareLink(path, ref)}`)}`;
}

/**
 * The address people pass on: ?ref= for the channel, and ?s= for the share-card version,
 * so a new card means a new address and WhatsApp drops its cached preview.
 */
export function shareLink(path: string, ref: string): string {
  return `${SITE_URL}${path}?ref=${encodeURIComponent(ref)}&s=${SHARE_VERSION}`;
}

/**
 * Footer links, in display order. Competition rules are deliberately absent: there is no
 * prize draw, and /rules is linked only if the admin turns the competition flag on.
 * "Contact us" opens the brand's WhatsApp group.
 */
export const LEGAL_LINKS = [
  { key: "terms", href: "/terms" },
  { key: "privacy", href: "/privacy" },
  { key: "data", href: "/privacy#data" },
  { key: "cookies", href: "/privacy#cookies" },
  { key: "copyright", href: "/copyright" },
  { key: "contact", href: WHATSAPP_GROUP_URL },
] as const;
