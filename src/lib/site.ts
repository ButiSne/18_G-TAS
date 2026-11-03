// Site-wide facts used by pages, the footer and share links.

/** Registered business name, and the name it trades under. */
export const LEGAL_NAME = "18 G-TAS Custom Clothing & Design";
export const TRADING_NAME = "18 G-TAS";
export const LEGAL_NAME_FULL = `${LEGAL_NAME}, trading as ${TRADING_NAME}`;

/** POPIA information officer (section 55), named on the privacy page. */
export const INFORMATION_OFFICER = "Snethemba Hlongwane";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://18g-tas.vercel.app").replace(
  /\/+$/,
  "",
);

/** Public contact: the brand's WhatsApp line. An email can be added via NEXT_PUBLIC_CONTACT_EMAIL. */
export const CONTACT_WHATSAPP = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || "+27 74 673 0051";
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || null;

/** wa.me wants the number in international format with digits only: +27 74… → 2774… */
export function whatsappChatUrl(number = CONTACT_WHATSAPP): string {
  return `https://wa.me/${number.replace(/\D/g, "")}`;
}

/**
 * A WhatsApp share link. The shared URL carries ?ref= so the results can show which
 * channel brought votes (CLAUDE.md §0.1). wa.me works in the app and on the web.
 */
export function whatsappShareUrl(text: string, ref = "wa-share"): string {
  const link = `${SITE_URL}/?ref=${encodeURIComponent(ref)}`;
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`;
}

/**
 * Footer links, in display order. Competition rules are deliberately absent: there is no
 * prize draw, and /rules is linked only if the admin turns the competition flag on.
 * "Contact us" opens a WhatsApp chat with the brand.
 */
export const LEGAL_LINKS = [
  { key: "terms", href: "/terms" },
  { key: "privacy", href: "/privacy" },
  { key: "data", href: "/privacy#data" },
  { key: "cookies", href: "/privacy#cookies" },
  { key: "copyright", href: "/copyright" },
  { key: "contact", href: whatsappChatUrl() },
] as const;
