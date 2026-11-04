import { expect, test } from "@playwright/test";

test("team areas send visitors to sign-in", async ({ page }) => {
  for (const path of ["/members", "/admin", "/designs"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/members\/signin$/);
    await expect(page.getByRole("heading", { level: 1, name: "Team sign-in" })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Message the admin on WhatsApp" })).toHaveAttribute(
    "href",
    "https://wa.me/27746730051",
  );
});

test("a dead or made-up invite link explains itself", async ({ page }) => {
  await page.goto(`/members/join/${"x".repeat(43)}`);
  await expect(page.getByRole("heading", { name: "This link isn’t valid" })).toBeVisible();
  await page.goto("/members/join/not-a-token");
  await expect(page.getByRole("heading", { name: "This link isn’t valid" })).toBeVisible();
});

test("a fake session cookie gets no further than sign-in", async ({ page, context }) => {
  await context.addCookies([
    { name: "gtas_session", value: "x".repeat(43), url: "http://localhost:3000" },
  ]);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/members\/signin$/);
});
