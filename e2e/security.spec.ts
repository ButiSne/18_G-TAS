import { expect, test } from "@playwright/test";

test("every page is served with the security headers", async ({ request }) => {
  for (const path of ["/", "/vote", "/members/signin", "/privacy"]) {
    const res = await request.get(path);
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["permissions-policy"]).toContain("camera=()");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-powered-by"]).toBeUndefined();
  }
});

test("the retention job refuses anyone without the cron secret", async ({ request }) => {
  const res = await request.get("/api/cron/retention");
  expect(res.status()).toBe(401);
  const forged = await request.get("/api/cron/retention", {
    headers: { authorization: "Bearer guess" },
  });
  expect(forged.status()).toBe(401);
});

test("the landing page runs without CSP violations", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy/i.test(m.text()))
      violations.push(m.text());
  });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(violations).toEqual([]);
});
