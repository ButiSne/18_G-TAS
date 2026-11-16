// The short share address, /s (owner, 16 Nov 2026: a shared link must always show the
// card). When a message with a link sits in WhatsApp's composer, the sender's phone builds
// the preview by fetching that link; the full landing page is ~400 KB, and a quick Send
// on mobile data went out with no card. /s answers link previewers (WhatsApp, Facebook, X,
// Telegram…) with a page of about 2 KB holding only the card, and sends people straight
// on to the page the link is for, its ?ref= channel kept.

import { normaliseRef } from "./tally.ts";

/** Link-preview fetchers. Anything else is treated as a person and redirected. */
const PREVIEW_BOTS =
  /WhatsApp|facebookexternalhit|Facebot|meta-externalagent|Twitterbot|TelegramBot|Slackbot|LinkedInBot|Discordbot|SkypeUriPreview|Pinterest|redditbot|Applebot|Viber|Snapchat|Google-PageRenderer|vkShare|Iframely|Embedly/i;

export function isPreviewBot(userAgent: string | null): boolean {
  return Boolean(userAgent && PREVIEW_BOTS.test(userAgent));
}

/** Where a share link leads: the landing page or the vote, with its channel code. */
export function shareDestination(params: URLSearchParams): string {
  const path = params.get("to") === "vote" ? "/vote" : "/";
  const ref = normaliseRef(params.get("ref"));
  return ref ? `${path}?ref=${encodeURIComponent(ref)}` : path;
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/**
 * The whole page a previewer sees: the card's tags, and a meta refresh (no script, so the
 * content security policy is untouched) in case a person's browser looks like a bot.
 */
export function previewHtml(p: {
  title: string;
  description: string;
  siteName: string;
  image: { url: string; width: number; height: number; alt: string };
  destination: string;
}): string {
  const e = {
    title: escapeHtml(p.title),
    description: escapeHtml(p.description),
    siteName: escapeHtml(p.siteName),
    image: escapeHtml(p.image.url),
    alt: escapeHtml(p.image.alt),
    destination: escapeHtml(p.destination),
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e.title}</title>
<meta name="description" content="${e.description}">
<meta property="og:title" content="${e.title}">
<meta property="og:description" content="${e.description}">
<meta property="og:site_name" content="${e.siteName}">
<meta property="og:type" content="website">
<meta property="og:locale" content="en_ZA">
<meta property="og:image" content="${e.image}">
<meta property="og:image:width" content="${p.image.width}">
<meta property="og:image:height" content="${p.image.height}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:alt" content="${e.alt}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e.title}">
<meta name="twitter:description" content="${e.description}">
<meta name="twitter:image" content="${e.image}">
<meta http-equiv="refresh" content="0;url=${e.destination}">
</head>
<body><a href="${e.destination}">${e.title}</a></body>
</html>
`;
}
