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

test("link previews and the browser tab use the 18 G-TAS logo", async ({ page, request }) => {
  await page.goto("/");
  const og = await page.locator('meta[property="og:image"]').first().getAttribute("content");
  expect(og).toMatch(/\/opengraph-image\.jpg/);
  await expect(page.locator('meta[property="og:image:width"]').first()).toHaveAttribute(
    "content",
    "1200",
  );
  await expect(page.locator('meta[name="twitter:image"]').first()).toHaveAttribute(
    "content",
    /\/twitter-image\.jpg/,
  );
  await expect(page.locator('link[rel="icon"][href*="icon.png"]').first()).toBeAttached();
  await expect(page.locator('link[rel="apple-touch-icon"]').first()).toBeAttached();

  const card = await request.get(new URL(og!).pathname);
  expect(card.status()).toBe(200);
  expect(card.headers()["content-type"]).toContain("image/jpeg");
  expect((await card.body()).length).toBeLessThan(300 * 1024); // WhatsApp skips heavier images
  const ico = await request.get("/favicon.ico");
  expect(ico.status()).toBe(200);
});
