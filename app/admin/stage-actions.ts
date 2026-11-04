"use server";

// Admin actions for stages 2–3. Each re-checks the admin session and validates input;
// the rules themselves live in src/lib/stages.ts.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/src/db/server";
import { requireAdmin } from "@/src/lib/auth/session";
import { LINES } from "@/src/lib/design-line";
import {
  advancePublicRound,
  confirmShortlist,
  saveFinalTen,
  setLiveResults,
  StageError,
  updateDesign,
} from "@/src/lib/stages";

/** Pages the public sees that depend on the shortlist and the vote: refresh them at once. */
function revalidatePublicPages() {
  for (const path of ["/", "/collection/eiteen", "/collection/g-tas", "/vote", "/results"]) {
    revalidatePath(path);
  }
}

export type StageResult = { ok: true } | { ok: false; code: string };

async function guarded(fn: (adminId: string) => Promise<void>): Promise<StageResult> {
  const admin = await requireAdmin();
  try {
    await fn(admin.id);
    return { ok: true };
  } catch (error) {
    if (error instanceof StageError) return { ok: false, code: error.code };
    throw error;
  }
}

export async function updateDesignAction(_prev: StageResult | null, form: FormData) {
  const parsed = z
    .object({
      designId: z.uuid(),
      printMethod: z
        .string()
        .max(30)
        .transform((v) => v || null),
      line: z.enum(LINES),
      hidden: z.boolean(),
    })
    .safeParse({
      designId: form.get("designId"),
      printMethod: form.get("printMethod") ?? "",
      line: form.get("line"),
      hidden: form.get("hidden") === "on",
    });
  if (!parsed.success) return { ok: false, code: "bad_design" } as StageResult;
  const result = await guarded((actorId) => updateDesign(getDb()!, { ...parsed.data, actorId }));
  revalidatePath("/admin/designs");
  revalidatePublicPages();
  return result;
}

export async function confirmShortlistAction(_prev: StageResult | null, form: FormData) {
  const parsed = z
    .object({ roundId: z.uuid(), tieChoice: z.array(z.uuid()), note: z.string().max(300) })
    .safeParse({
      roundId: form.get("roundId"),
      tieChoice: form.getAll("tieChoice"),
      note: form.get("note") ?? "",
    });
  if (!parsed.success) return { ok: false, code: "tie_decision_required" } as StageResult;
  const result = await guarded(async (actorId) => {
    await confirmShortlist(getDb()!, {
      roundId: parsed.data.roundId,
      tieChoice: parsed.data.tieChoice,
      note: parsed.data.note.trim() || null,
      actorId,
      now: new Date(),
    });
  });
  if (result.ok) {
    revalidatePath("/admin");
    revalidatePublicPages();
    redirect("/admin");
  }
  return result;
}

export async function advancePublicRoundAction(
  publicRoundId: string,
  to: "open" | "closed" | "published",
) {
  const id = z.uuid().safeParse(publicRoundId);
  const step = z.enum(["open", "closed", "published"]).safeParse(to);
  if (!id.success || !step.success) return;
  await guarded((actorId) =>
    advancePublicRound(getDb()!, {
      publicRoundId: id.data,
      to: step.data,
      actorId,
      now: new Date(),
    }),
  );
  revalidatePath("/admin");
  revalidatePublicPages();
}

export async function setLiveResultsAction(publicRoundId: string, on: boolean) {
  const id = z.uuid().safeParse(publicRoundId);
  if (!id.success) return;
  await guarded((actorId) => setLiveResults(getDb()!, { publicRoundId: id.data, on, actorId }));
  revalidatePath("/admin");
  revalidatePublicPages();
}

export async function saveFinalTenAction(_prev: StageResult | null, form: FormData) {
  const parsed = z
    .object({ publicRoundId: z.uuid(), designIds: z.array(z.uuid()).max(40) })
    .safeParse({ publicRoundId: form.get("publicRoundId"), designIds: form.getAll("designIds") });
  if (!parsed.success) return { ok: false, code: "invalid_final_ten" } as StageResult;
  const result = await guarded((actorId) =>
    saveFinalTen(getDb()!, { ...parsed.data, actorId, now: new Date() }),
  );
  revalidatePath("/admin/final");
  return result;
}
