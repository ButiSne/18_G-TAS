import { describe, expect, it } from "vitest";
import { isPreviewBot, previewHtml, shareDestination } from "@/src/lib/share-link";

const q = (s: string) => new URLSearchParams(s);

describe("isPreviewBot", () => {
  it("knows the link previewers of WhatsApp, Facebook, X and Telegram", () => {
    for (const ua of [
      "WhatsApp/2.24.20.80 A",
      "WhatsApp/2.23.20.0 i",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Twitterbot/1.0",
      "TelegramBot (like TwitterBot)",
    ]) {
      expect(isPreviewBot(ua), ua).toBe(true);
    }
  });

  it("treats phones' browsers as people", () => {
    expect(
      isPreviewBot(
        "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe(false);
    expect(isPreviewBot(null)).toBe(false);
  });
});

describe("shareDestination", () => {
  it("leads to the landing page or the vote, keeping a valid channel code", () => {
    expect(shareDestination(q("ref=wa-share&s=5"))).toBe("/?ref=wa-share");
    expect(shareDestination(q("to=vote&ref=WA-Umlazi&s=5"))).toBe("/vote?ref=wa-umlazi");
    expect(shareDestination(q("to=vote"))).toBe("/vote");
  });

  it("never leads anywhere else, and drops a made-up channel", () => {
    expect(shareDestination(q("to=https://evil.example&ref=fb"))).toBe("/?ref=fb");
    expect(shareDestination(q("to=../admin"))).toBe("/");
    expect(shareDestination(q("ref=<script>"))).toBe("/");
  });
});

describe("previewHtml", () => {
  const html = previewHtml({
    title: "18 G-TAS is back",
    description: "Est. 2008 & still here",
    siteName: "18 G-TAS",
    image: { url: "https://x.example/og/card.jpg", width: 1200, height: 630, alt: 'The "18" card' },
    destination: "/vote?ref=fb",
  });

  it("is a tiny page holding the card's tags", () => {
    expect(Buffer.byteLength(html)).toBeLessThan(3000);
    expect(html).toContain('<meta property="og:image" content="https://x.example/og/card.jpg">');
    expect(html).toContain('<meta property="og:title" content="18 G-TAS is back">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).not.toContain("og:url");
  });

  it("escapes text and sends people on with a meta refresh, no script", () => {
    expect(html).toContain("Est. 2008 &amp; still here");
    expect(html).toContain("The &quot;18&quot; card");
    expect(html).toContain('<meta http-equiv="refresh" content="0;url=/vote?ref=fb">');
    expect(html).not.toContain("<script");
  });
});
