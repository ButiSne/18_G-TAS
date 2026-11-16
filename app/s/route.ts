import { NextResponse, type NextRequest } from "next/server";
import { SHARE_DESCRIPTION, SHARE_TITLE } from "@/src/lib/share-meta";
import { isPreviewBot, previewHtml, shareDestination } from "@/src/lib/share-link";
import { SHARE_IMAGE } from "@/src/lib/site";
import { getMessages } from "@/src/lib/messages";

// /s?ref=wa-share&s=5 (landing) and /s?to=vote&ref=fb&s=5 (the vote): see src/lib/share-link.ts.
// Never cached: the answer depends on who is asking.
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store", vary: "User-Agent" };

export function GET(request: NextRequest) {
  const destination = shareDestination(request.nextUrl.searchParams);
  if (!isPreviewBot(request.headers.get("user-agent"))) {
    const res = NextResponse.redirect(new URL(destination, request.url), 307);
    for (const [k, v] of Object.entries(NO_STORE)) res.headers.set(k, v);
    return res;
  }
  const html = previewHtml({
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    siteName: getMessages().site.name,
    image: {
      url: new URL(SHARE_IMAGE.path, request.url).toString(),
      width: SHARE_IMAGE.width,
      height: SHARE_IMAGE.height,
      alt: SHARE_IMAGE.alt,
    },
    destination,
  });
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8", ...NO_STORE },
  });
}
