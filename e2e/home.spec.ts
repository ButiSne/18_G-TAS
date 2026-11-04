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
