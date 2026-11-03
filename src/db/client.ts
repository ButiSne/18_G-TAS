import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  return drizzle(postgres(url, { prepare: false }), { schema });
}
