import { SHARE_DESCRIPTION, SHARE_TITLE } from "@/src/lib/share-meta";
import { previewHtml } from "@/src/lib/share-link";
import { SHARE_IMAGE, SITE_URL } from "@/src/lib/site";
import { getMessages } from "@/src/lib/messages";

// /s?ref=wa-share&s=6 (landing) and /s?to=vote&ref=fb&s=6 (the vote): see src/lib/share-link.ts.
// Built once at deploy and served as a static file from the CDN: no function to wake up.
export const dynamic = "force-static";

const html = previewHtml({
  title: SHARE_TITLE,
  description: SHARE_DESCRIPTION,
  siteName: getMessages().site.name,
  image: {
    url: `${SITE_URL}${SHARE_IMAGE.path}`,
    width: SHARE_IMAGE.width,
    height: SHARE_IMAGE.height,
    alt: SHARE_IMAGE.alt,
  },
});

export function GET() {
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
