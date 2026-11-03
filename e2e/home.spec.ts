import { expect, test } from "@playwright/test";

test("home shows the three stages and links the privacy notice", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(3);
  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByText("TO BE REVIEWED")).toBeVisible();
});
