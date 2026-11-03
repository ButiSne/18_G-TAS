/**
 * Neon's connection strings carry `channel_binding=require`. That is a libpq option;
 * the postgres.js driver does not implement it and forwards unknown query parameters
 * to the server as settings, which Postgres rejects ("unrecognized configuration
 * parameter"). Strip it here. `sslmode=require` stays, so the link is still encrypted.
 */
export function normaliseDatabaseUrl(raw: string): string {
  const url = new URL(raw);
  url.searchParams.delete("channel_binding");
  return url.toString();
}
