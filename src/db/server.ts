// One database connection for server components and server actions.
// Returns null when DATABASE_URL is not set (CI builds, a fresh clone), so pages can
// render a version without live data instead of failing the build.
import { createDb } from "./client";

let db: ReturnType<typeof createDb> | null | undefined;

export function getDb() {
  if (db === undefined) db = process.env.DATABASE_URL ? createDb() : null;
  return db;
}
