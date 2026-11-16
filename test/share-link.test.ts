import { describe, expect, it } from "vitest";
import { FORWARD_SCRIPT, previewHtml } from "@/src/lib/share-link";

/** Runs the page's forwarding script against a fake address bar; returns where it sends you. */
function forward(search: string): string {
  let target = "";
  new Function("location", FORWARD_SCRIPT)({
    search,
    replace: (url: string) => (target = url),
  });
  return target;
}

describe("the /s forwarding script", () => {
  it("leads to the landing page or the vote, keeping a valid channel code", () => {
    expect(forward("?ref=wa-share&s=6")).toBe("/?ref=wa-share");
    expect(forward("?to=vote&ref=WA-Umlazi&s=6")).toBe("/vote?ref=wa-umlazi");
    expect(forward("?to=vote")).toBe("/vote");
    expect(forward("")).toBe("/");
  });

  it("never leads anywhere else, and drops a made-up channel", () => {
    expect(forward("?to=https://evil.example&ref=fb")).toBe("/?ref=fb");
    expect(forward("?to=../admin")).toBe("/");
    expect(forward("?ref=<script>")).toBe("/");
    expect(forward("?ref=" + "a".repeat(41))).toBe("/");
  });
});

describe("previewHtml", () => {
  const html = previewHtml({
    title: "18 G-TAS is back",
    description: "Est. 2008 & still here",
    siteName: "18 G-TAS",
    image: { url: "https://x.example/og/card.jpg", width: 1200, height: 630, alt: 'The "18" card' },
  });

  it("is a tiny page holding the card's tags", () => {
    expect(Buffer.byteLength(html)).toBeLessThan(3000);
    expect(html).toContain('<meta property="og:image" content="https://x.example/og/card.jpg">');
    expect(html).toContain('<meta property="og:title" content="18 G-TAS is back">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).not.toContain("og:url");
  });

  it("has no meta refresh for WhatsApp to follow off the card", () => {
    expect(html).not.toMatch(/http-equiv/i);
  });

  it("puts the card's tags before the script, and escapes text", () => {
    expect(html.indexOf("og:image")).toBeLessThan(html.indexOf("<script>"));
    expect(html).toContain(`<script>${FORWARD_SCRIPT}</script>`);
    expect(html).toContain("Est. 2008 &amp; still here");
    expect(html).toContain("The &quot;18&quot; card");
  });
});
