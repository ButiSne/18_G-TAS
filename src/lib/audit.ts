// Every admin action writes the audit log (CLAUDE.md §9). One helper, so it can't be
// forgotten or written differently in two places. Accepts the database or a transaction,
// so the log entry commits or rolls back with the change it records.

import type { createDb } from "../db/client.ts";
import { auditLog } from "../db/schema.ts";

type Db = ReturnType<typeof createDb>;
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export async function audit(
  db: DbOrTx,
  actorMemberId: string | null,
  action: string,
  payload: Record<string, unknown> = {},
) {
  await db.insert(auditLog).values({ actorMemberId, action, payload });
}
