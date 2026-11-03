import { defineConfig } from "drizzle-kit";
import { normaliseDatabaseUrl } from "./src/db/url.ts";

const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: url ? normaliseDatabaseUrl(url) : "" },
});
