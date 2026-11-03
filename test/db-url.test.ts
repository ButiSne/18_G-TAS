import { describe, expect, it } from "vitest";
import { normaliseDatabaseUrl } from "@/src/db/url";

describe("normaliseDatabaseUrl", () => {
  it("drops channel_binding, which postgres.js would send to the server as a setting", () => {
    const out = normaliseDatabaseUrl(
      "postgresql://u:p@ep-x-pooler.neon.tech/neondb?sslmode=require&channel_binding=require",
    );
    expect(out).toBe("postgresql://u:p@ep-x-pooler.neon.tech/neondb?sslmode=require");
  });

  it("leaves a URL without it unchanged", () => {
    expect(normaliseDatabaseUrl("postgres://app@localhost:5432/gtas")).toBe(
      "postgres://app@localhost:5432/gtas",
    );
  });
});
