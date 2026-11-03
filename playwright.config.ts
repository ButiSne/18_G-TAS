import { defineConfig, devices } from "@playwright/test";

// Mobile first: most voters arrive from Facebook and WhatsApp on a phone.
export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: "http://localhost:3000",
    // Lets a machine with a pre-installed Chromium use it instead of downloading one.
    launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined },
  },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
});
