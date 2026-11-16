// The short share address, /s (owner, 16 Nov 2026: a shared link must always show the
// card). WhatsApp builds a link's preview on the sender's phone while the message waits in
// the composer, so the page behind the link has to be tiny and quick.
//
// /s is one static page of about 1.5 KB, built at deploy and served from the CDN nearest the
// phone, with no function to wake up. It holds the card's tags for link previewers (WhatsApp,
// Facebook, X, Telegram…) and a one-line script that sends people on to the landing page or
// the vote, keeping their ?ref= channel. Previewers don't run scripts; browsers do.
//
// - No meta refresh: WhatsApp follows one. The logs on 16 Nov show it going on to the full
//   landing page, and the preview was lost.
// - No user-agent sniffing: everyone gets the same page, so a previewer with an unexpected
//   name still gets the card.

import { REF_PATTERN } from "./tally.ts";

/**
 * Sends a person on: /vote when the link says to=vote, otherwise /, plus ?ref= when the code
 * is a valid channel slug (the same rule as normaliseRef). The path is fixed, never taken from
 * the link, so /s can't be used to send anyone off-site.
 */
export const FORWARD_SCRIPT =
  "(function(l){var q=new URLSearchParams(l.search),r=(q.get('ref')||'').trim().toLowerCase();" +
  `l.replace((q.get('to')==='vote'?'/vote':'/')+(${REF_PATTERN}.test(r)?'?ref='+r:''))})(location)`;

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/** The whole /s page: the card's tags first, then the forwarding script, on onyx. */
export function previewHtml(p: {
  title: string;
  description: string;
  siteName: string;
  image: { url: string; width: number; height: number; alt: string };
}): string {
  const e = {
    title: escapeHtml(p.title),
    description: escapeHtml(p.description),
    siteName: escapeHtml(p.siteName),
    image: escapeHtml(p.image.url),
    alt: escapeHtml(p.image.alt),
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${e.title}</title>
<meta name="description" content="${e.description}">
<meta property="og:title" content="${e.title}">
<meta property="og:description" content="${e.description}">
<meta property="og:site_name" content="${e.siteName}">
<meta property="og:type" content="website">
<meta property="og:locale" content="en_ZA">
<meta property="og:image" content="${e.image}">
<meta property="og:image:secure_url" content="${e.image}">
<meta property="og:image:width" content="${p.image.width}">
<meta property="og:image:height" content="${p.image.height}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:alt" content="${e.alt}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e.title}">
<meta name="twitter:description" content="${e.description}">
<meta name="twitter:image" content="${e.image}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0D0D0D">
<script>${FORWARD_SCRIPT}</script>
</head>
<body style="margin:0;background:#0D0D0D;color:#F3EDE2;font:16px system-ui,sans-serif">
<p style="padding:24px"><a href="/" style="color:#C9A24A">${e.title}</a></p>
</body>
</html>
`;
}
