import { defineConfig } from "drizzle-kit";
import { normaliseDatabaseUrl } from "./src/db/url.ts";

// Local runs read .env.local (works the same in PowerShell and bash). On Vercel there is
// no such file and DATABASE_URL comes from the Neon integration.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local: rely on the environment.
}

const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: url ? normaliseDatabaseUrl(url) : "" },
});
