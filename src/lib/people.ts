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
      if (!email.safeParse(address).success) {
        // Name the person, never the address: these errors end up in terminals and logs.
        const who = entry.split("<")[0]!.trim() || "an entry";
        const hint = entry.includes("<") && !entry.endsWith(">") ? " (missing the closing >)" : "";
        throw new Error(`Not a valid "Name <email>" entry for ${who}${hint}`);
      }
      const name = m?.[1]?.trim() || address.split("@")[0]!;
      return { name, email: address };
    });
}

export type Role = "admin" | "member";

/**
 * Combines ADMIN_EMAILS and MEMBER_EMAILS into one list, one row per email.
 * Someone in both lists is an admin: being on the team never takes admin rights away.
 */
export function withRoles(admins: Person[], members: Person[]): (Person & { role: Role })[] {
  const byEmail = new Map<string, Person & { role: Role }>();
  for (const p of members) byEmail.set(p.email, { ...p, role: "member" });
  for (const p of admins) byEmail.set(p.email, { ...p, role: "admin" });
  return [...byEmail.values()];
}
