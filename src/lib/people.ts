import { z } from "zod";

export type Person = { name: string; email: string };

const email = z.email();

/**
 * Parses MEMBER_EMAILS / ADMIN_EMAILS: comma-separated `Name <email>` or bare `email`.
 * People live in env config, never in code (brief §2).
 */
export function parsePeople(raw: string | undefined): Person[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const m = entry.match(/^(.*?)\s*<([^>]+)>$/);
      const address = (m ? m[2]! : entry).trim().toLowerCase();
      if (!email.safeParse(address).success) throw new Error(`Not an email address: ${entry}`);
      const name = m?.[1]?.trim() || address.split("@")[0]!;
      return { name, email: address };
    });
}
