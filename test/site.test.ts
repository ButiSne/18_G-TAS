import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import { fill } from "@/src/lib/messages";
import { LEGAL_LINKS, SITE_URL, whatsappShareUrl } from "@/src/lib/site";
import { normaliseRef } from "@/src/lib/tally";

describe("whatsappShareUrl", () => {
  it("shares the text and a link that carries a valid ?ref=", () => {
    const url = new URL(whatsappShareUrl("18 G-TAS is back!"));
    expect(url.origin).toBe("https://wa.me");
    const text = url.searchParams.get("text")!;
    expect(text).toBe(`18 G-TAS is back! ${SITE_URL}/?ref=wa-share`);
    const ref = new URL(text.split(" ").at(-1)!).searchParams.get("ref");
    expect(normaliseRef(ref)).toBe("wa-share");
  });
});

describe("footer legal links", () => {
  it("point at pages that exist", () => {
    for (const { href } of LEGAL_LINKS) {
      const path = href.split("#")[0]!.replace(/^\//, "");
      expect(existsSync(new URL(`../app/(legal)/${path}/page.tsx`, import.meta.url))).toBe(true);
    }
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

describe("fill", () => {
  it("replaces known placeholders and leaves unknown ones", () => {
    expect(fill("{count} new designs", { count: 44 })).toBe("44 new designs");
    expect(fill("© {year} {who}", { year: 2026 })).toBe("© 2026 {who}");
  });
});
