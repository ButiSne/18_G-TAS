// Daily retention job (vercel.json → crons). Vercel Cron calls it with
// "Authorization: Bearer <CRON_SECRET>"; anyone else gets 401.

import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/src/db/server";
import { runRetention } from "@/src/lib/retention";

export const dynamic = "force-dynamic";

function authorised(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function GET(request: Request) {
  if (!authorised(request.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const db = getDb();
  if (!db) return new Response("No database", { status: 503 });
  return Response.json(await runRetention(db, new Date()));
}
