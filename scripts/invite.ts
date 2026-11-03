// pnpm invite "<name or email>"
//
// Creates a single-use, 24-hour sign-in link for one person, for bootstrapping the first
// admin (everyone else gets theirs from /admin). The link is written to invite-link.txt
// (git-ignored), never printed, so it can't end up in terminal logs. Send it, then delete it.
//
// Against production: put DATABASE_URL in .env.production.local and run
//   node --env-file=.env.production.local --experimental-strip-types scripts/invite.ts "Admin GTAS18"

import { writeFile } from "node:fs/promises";
import { createDb } from "../src/db/client.ts";
import { member } from "../src/db/schema.ts";
import { createInvite } from "../src/lib/auth/store.ts";
import { SITE_URL } from "../src/lib/site.ts";

const query = process.argv[2]?.trim().toLowerCase();
if (!query) {
  console.error('Usage: pnpm invite "<name or email>"');
  process.exit(1);
}

const db = createDb();
const people = await db
  .select({ id: member.id, name: member.name, email: member.email })
  .from(member);
const matches = people.filter((p) => p.email === query || p.name.toLowerCase() === query);
if (matches.length !== 1) {
  console.error(
    `No single team member matches "${query}". Team: ${people.map((p) => p.name).join(", ")}`,
  );
  process.exit(1);
}

const person = matches[0]!;
const { token, expiresAt } = await createInvite(db, {
  memberId: person.id,
  createdBy: null,
  now: new Date(),
});
const base = (process.env.INVITE_BASE_URL || SITE_URL).replace(/\/+$/, "");
await writeFile("invite-link.txt", `${base}/members/join/${token}\n`);
console.log(
  `Sign-in link for ${person.name} written to invite-link.txt (expires ${expiresAt.toISOString()}). Send it, then delete the file.`,
);
process.exit(0);
