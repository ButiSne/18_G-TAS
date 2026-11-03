import { defineConfig } from "vitest/config";

// Integration tests talk to a real Postgres (DATABASE_URL_TEST, default: the Docker
// gtas_test database from `pnpm db:up`). Kept apart so `pnpm test` stays fast and offline.
export default defineConfig({
  test: {
    include: ["test/**/*.int.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 60_000,
  },
  resolve: { alias: { "@": new URL("./", import.meta.url).pathname } },
});
