// Seeds the admin(s), the team and one draft team round from env config.
// Safe to run twice: people are upserted by email, and the draft round is only
// created when no round exists yet.
import { createDb } from "../src/db/client.ts";
import { member, selectionRound } from "../src/db/schema.ts";
import { parsePeople } from "../src/lib/people.ts";

const db = createDb();
const admins = parsePeople(process.env.ADMIN_EMAILS);
const members = parsePeople(process.env.MEMBER_EMAILS);

if (admins.length === 0) {
  console.error("ADMIN_EMAILS is empty: nobody could run the rounds. Set it in .env.local.");
  process.exit(1);
}

for (const [people, role] of [
  [admins, "admin"],
  [members, "member"],
] as const) {
  for (const p of people) {
    await db
      .insert(member)
      .values({ ...p, role })
      .onConflictDoUpdate({ target: member.email, set: { name: p.name, role } });
  }
}

const existing = await db.select({ id: selectionRound.id }).from(selectionRound).limit(1);
if (existing.length === 0) {
  await db.insert(selectionRound).values({ title: "Team round 1" });
}

console.log(`Seeded ${admins.length} admin(s), ${members.length} member(s).`);
process.exit(0);
