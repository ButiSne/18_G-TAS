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
    "Contact us",
  ]) {
    await expect(footer.getByRole("link", { name })).toBeVisible();
  }
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
  for (const path of ["/", "/vote?ref=wa-test", "/collection/eiteen", "/privacy"]) {
    await page.goto(path);
    const og = await page.locator('meta[property="og:image"]').first().getAttribute("content");
    // A plain, versioned path with no query string: some WhatsApp versions are fussy.
    expect(og, path).toMatch(/^https?:\/\/[^?]+\/og\/18gtas-share-v\d+\.jpg$/);
    await expect(page.locator('meta[property="og:title"]').first()).toHaveAttribute(
      "content",
      /18 G-TAS/,
    );
    await expect(page.locator('meta[name="twitter:card"]').first()).toHaveAttribute(
      "content",
      "summary_large_image",
    );
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
