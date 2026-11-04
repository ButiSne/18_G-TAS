import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import { fill } from "@/src/lib/messages";
import {
  LEGAL_LINKS,
  SHARE_IMAGE,
  SHARE_VERSION,
  SITE_URL,
  whatsappChatUrl,
  whatsappShareUrl,
  WHATSAPP_GROUP_URL,
} from "@/src/lib/site";
import { normaliseRef } from "@/src/lib/tally";

describe("whatsappShareUrl", () => {
  it("shares the text and a link that carries a valid ?ref=", () => {
    const url = new URL(whatsappShareUrl("18 G-TAS is back!"));
    expect(url.origin).toBe("https://wa.me");
    const text = url.searchParams.get("text")!;
    expect(text).toBe(`18 G-TAS is back! ${SITE_URL}/?ref=wa-share&s=${SHARE_VERSION}`);
    const link = new URL(text.split(" ").at(-1)!);
    expect(normaliseRef(link.searchParams.get("ref"))).toBe("wa-share");
  });

  it("changes the shared address with the share card, so WhatsApp refetches the preview", () => {
    expect(SHARE_IMAGE.path).toBe(`/og/18gtas-share-v${SHARE_VERSION}.jpg`);
    expect(existsSync(`public${SHARE_IMAGE.path}`)).toBe(true);
    const text = new URL(whatsappShareUrl("Vote", "wa-umlazi", "/vote")).searchParams.get("text")!;
    expect(text).toBe(`Vote ${SITE_URL}/vote?ref=wa-umlazi&s=${SHARE_VERSION}`);
  });
});

describe("footer legal links", () => {
  it("point at pages that exist", () => {
    for (const { href } of LEGAL_LINKS.filter((l) => l.href.startsWith("/"))) {
      const path = href.split("#")[0]!.replace(/^\//, "");
      expect(existsSync(new URL(`../app/(legal)/${path}/page.tsx`, import.meta.url))).toBe(true);
    }
  });

  it("open the brand's WhatsApp group for 'Contact us'", () => {
    const href = LEGAL_LINKS.find((l) => l.key === "contact")?.href;
    expect(new URL(href!).origin).toBe("https://chat.whatsapp.com");
    expect(href).toBe(WHATSAPP_GROUP_URL);
  });

  it("have a label each, and leave out competition rules (no prize draw)", () => {
    for (const { key } of LEGAL_LINKS) expect(en.footer.links[key]).toBeTruthy();
    expect(LEGAL_LINKS.map((l) => l.href)).not.toContain("/rules");
  });

  it("cover terms, privacy, data collection, cookies and copyright", () => {
    expect(LEGAL_LINKS.map((l) => l.href)).toEqual(
      expect.arrayContaining([
        "/terms",
        "/privacy",
        "/privacy#data",
        "/privacy#cookies",
        "/copyright",
      ]),
    );
  });
});

describe("whatsappChatUrl", () => {
  it("turns a formatted SA number into a wa.me link", () => {
    expect(whatsappChatUrl("+27 74 673 0051")).toBe("https://wa.me/27746730051");
  });
});

describe("fill", () => {
  it("replaces known placeholders and leaves unknown ones", () => {
    expect(fill("{count} new designs", { count: 44 })).toBe("44 new designs");
    expect(fill("© {year} {who}", { year: 2026 })).toBe("© 2026 {who}");
  });
});
