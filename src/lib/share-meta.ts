// The one link preview (owner, 15 Nov 2026): every link anyone shares, on WhatsApp,
// Facebook or X, shows the same card. The 18 G-TAS share image, "18 G-TAS is back", and the
// "Est. 2008…" line. That covers the landing page, the vote links (?ref=, "share my style",
// the admin's channel links), the line pages, results, legal pages and team invite links.
//
// No og:url on purpose: each preview then opens the link that was actually shared, so a
// Facebook click on /vote?ref=fb lands on the vote with its channel, not on the home page.

import type { Metadata } from "next";
import { getMessages } from "./messages.ts";
import { SHARE_IMAGE } from "./site.ts";

const t = getMessages();

export const SHARE_TITLE = t.site.title;
export const SHARE_DESCRIPTION = t.site.tagline;

export const SHARE_OPEN_GRAPH: NonNullable<Metadata["openGraph"]> = {
  title: SHARE_TITLE,
  description: SHARE_DESCRIPTION,
  siteName: t.site.name,
  locale: "en_ZA",
  type: "website",
  images: [
    {
      url: SHARE_IMAGE.path,
      width: SHARE_IMAGE.width,
      height: SHARE_IMAGE.height,
      type: "image/jpeg",
      alt: SHARE_IMAGE.alt,
    },
  ],
};

export const SHARE_TWITTER: NonNullable<Metadata["twitter"]> = {
  card: "summary_large_image",
  title: SHARE_TITLE,
  description: SHARE_DESCRIPTION,
  images: [{ url: SHARE_IMAGE.path, alt: SHARE_IMAGE.alt }],
};
