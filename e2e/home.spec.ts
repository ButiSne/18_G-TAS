import { expect, test } from "@playwright/test";

test("the landing page announces the comeback", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/18 G-TAS\s*is\s*back\./i);
  await expect(
    page.getByRole("link", { name: /Tell your crew on WhatsApp/ }).first(),
  ).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=.*ref%3Dwa-share/);
  await page.getByRole("link", { name: /How the comeback works/ }).click();
  await expect(page.getByRole("heading", { name: "How the comeback works" })).toBeInViewport();
});

test("never scrolls sideways on a small phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the footer links the legal pages, and no competition rules", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("navigation", { name: "Legal and privacy" });
  for (const name of [
    "Terms of use",
    "Privacy & POPIA",
    "Data we collect",
    "Cookies",
    "Copyright & design rights",
    "Contact us on WhatsApp",
  ]) {
    await expect(footer.getByRole("link", { name })).toBeVisible();
  }
  await expect(footer.getByRole("link", { name: "Contact us on WhatsApp" })).toHaveAttribute(
    "href",
    /^https:\/\/chat\.whatsapp\.com\//,
  );
  // Private matters keep the direct line.
  await expect(page.getByRole("link", { name: "+27 74 673 0051" })).toHaveAttribute(
    "href",
    "https://wa.me/27746730051",
  );
  await expect(page.getByRole("link", { name: "Competition rules" })).toHaveCount(0);

  await footer.getByRole("link", { name: "Data we collect" }).click();
  await expect(page.getByText("TO BE REVIEWED")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Data we collect" })).toBeInViewport();

  await page
    .getByRole("navigation", { name: "Legal and privacy" })
    .getByRole("link", { name: "Terms of use" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Terms of use" })).toBeVisible();
});

test("the line tiles open their collection pages", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "18 G-TAS is back. Pass it on." })).toBeVisible();
  await page.getByRole("link", { name: /For the youth/ }).click();
  await expect(page).toHaveURL(/\/collection\/eiteen$/);
  await expect(page.getByRole("heading", { level: 1, name: "EITEEN" })).toBeVisible();
  await page.getByRole("link", { name: /See the other line/ }).click();
  await expect(page).toHaveURL(/\/collection\/g-tas$/);
  await expect(page.getByRole("heading", { level: 1, name: "XVIII · G-TAS" })).toBeVisible();
});

test("link previews use the share card at a plain address, on every page", async ({
  page,
  request,
}) => {
  // Every link anyone shares carries the one card (owner, 15 Nov 2026): the same image,
  // title and description, and no og:url, so each preview opens the link that was shared.
  const shareable = [
    "/",
    "/?ref=wa-share&s=4",
    "/vote?ref=wa-umlazi&s=4",
    "/collection/eiteen",
    "/collection/g-tas",
    "/results",
    "/privacy",
    "/members/signin",
    `/members/join/${"x".repeat(43)}`, // a team invite link
  ];
  for (const path of shareable) {
    await page.goto(path);
    const meta = (key: string) =>
      page.locator(`meta[property="${key}"], meta[name="${key}"]`).first();
    const og = await meta("og:image").getAttribute("content");
    // A plain, versioned path with no query string: some WhatsApp versions are fussy.
    expect(og, path).toMatch(/^https?:\/\/[^?]+\/og\/18gtas-share-v\d+\.jpg$/);
    await expect(meta("og:title"), path).toHaveAttribute("content", "18 G-TAS is back");
    await expect(meta("og:description"), path).toHaveAttribute(
      "content",
      "Est. 2008. Eighteen years later, 18 G-TAS is back. Help choose the first drop.",
    );
    await expect(meta("og:site_name"), path).toHaveAttribute("content", "18 G-TAS");
    await expect(meta("twitter:card"), path).toHaveAttribute("content", "summary_large_image");
    await expect(page.locator('meta[property="og:url"]'), path).toHaveCount(0);
  }
  await expect(page.locator('link[rel="icon"][href*="icon.png"]').first()).toBeAttached();

  const og = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  const card = await request.get(new URL(og!).pathname);
  expect(card.status()).toBe(200);
  expect(card.headers()["content-type"]).toContain("image/jpeg");
  const bytes = await card.body();
  expect(bytes.length).toBeLessThan(300 * 1024); // WhatsApp skips heavier images
  // Baseline JPEG: no progressive (SOF2) frame marker.
  expect(bytes.includes(Buffer.from([0xff, 0xc2]))).toBe(false);
  expect((await request.get("/favicon.ico")).status()).toBe(200);
});

test("a shared link's channel code is kept for the tab, so the vote can count it", async ({
  page,
}) => {
  await page.goto("/?ref=WA-Test&s=3");
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("gtas_ref"))).toBe("wa-test");
  await page.goto("/privacy?ref=<script>");
  expect(await page.evaluate(() => sessionStorage.getItem("gtas_ref"))).toBe("wa-test");
  // Not a cookie: the vote keeps its single functional cookie.
  expect((await page.context().cookies()).map((c) => c.name)).not.toContain("gtas_ref");
});

test("each line tile shows the same count as the page it opens", async ({ page }) => {
  for (const [tile, path] of [
    [/For the youth/, "/collection/eiteen"],
    [/For the elders/, "/collection/g-tas"],
  ] as const) {
    await page.goto("/");
    const link = page.getByRole("link", { name: tile });
    const n = /(\d+) (?:new designs|on the shortlist)/.exec(await link.innerText())?.[1];
    expect(n, `count on the ${path} tile`).toBeTruthy();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(
      page.getByText(new RegExp(`^${n} (?:new designs in this line|on the shortlist)$`)),
    ).toBeVisible();
  }
});

test("the short share page gives link previewers the card and sends people on", async ({
  page,
  request,
}) => {
  const bot = await request.get("/s?ref=wa-test&s=6", {
    headers: { "user-agent": "WhatsApp/2.24.20.80 A" },
    maxRedirects: 0,
  });
  expect(bot.status()).toBe(200);
  const html = await bot.text();
  expect(html.length).toBeLessThan(3000); // the whole page, so the preview is instant
  expect(html).toContain('<meta property="og:title" content="18 G-TAS is back">');
  expect(html).not.toMatch(/http-equiv/i); // nothing for WhatsApp to follow off the card
  const image = html.match(/property="og:image" content="([^"]+)"/)?.[1];
  expect(image).toMatch(/^https?:\/\/[^?]+\/og\/18gtas-share-v\d+\.jpg$/);
  const card = await request.get(new URL(image!).pathname);
  expect(card.status()).toBe(200);
  expect(card.headers()["content-type"]).toContain("image/jpeg");

  // One static page for everyone: no user-agent sniffing to get wrong.
  const other = await request.get("/s?to=vote&ref=x&s=6", {
    headers: { "user-agent": "SomeNewPreviewer/1.0" },
    maxRedirects: 0,
  });
  expect(await other.text()).toBe(html);

  // A person's browser runs the forwarding script and lands on the vote, channel kept.
  await page.goto("/s?to=vote&ref=WA-Test&s=6");
  await expect(page).toHaveURL(/\/vote\?ref=wa-test$/);
  await page.goto("/s?ref=wa-share&s=6");
  await expect(page).toHaveURL(/\/\?ref=wa-share$/);
});
