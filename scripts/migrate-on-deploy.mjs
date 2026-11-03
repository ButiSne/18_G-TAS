// Runs database migrations during a Vercel build (CLAUDE.md §11.4).
// Production only by default: a preview build of an unmerged branch must not change
// the production schema. Set MIGRATE_ON_BUILD=1 on Preview once Neon gives each
// preview its own database branch.
import { execFileSync } from "node:child_process";

const env = process.env.VERCEL_ENV;
const wanted = env === "production" || process.env.MIGRATE_ON_BUILD === "1";

if (!wanted) {
  console.log(`[migrate] skipped (VERCEL_ENV=${env ?? "unset"})`);
} else if (!process.env.DATABASE_URL) {
  // Fail the deploy rather than ship code against a schema nobody migrated.
  console.error("[migrate] DATABASE_URL is not set for this environment.");
  process.exit(1);
} else {
  execFileSync("pnpm", ["exec", "drizzle-kit", "migrate"], { stdio: "inherit" });
}
