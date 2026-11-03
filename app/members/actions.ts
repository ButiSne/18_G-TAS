"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/src/db/server";
import { SESSION_COOKIE } from "@/src/lib/auth/cookie";
import { endSession } from "@/src/lib/auth/store";

export async function signOutAction() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const db = getDb();
  if (token && db) await endSession(db, token, new Date());
  jar.delete(SESSION_COOKIE);
  redirect("/");
}
