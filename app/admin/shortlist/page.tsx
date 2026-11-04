import Link from "next/link";
import { ActionForm } from "@/src/components/action-form";
import { buttonPrimary, TeamHeader } from "@/src/components/team-ui";
import { getDb } from "@/src/db/server";
import { requireAdmin } from "@/src/lib/auth/session";
import { loadCatalogue } from "@/src/lib/catalogue";
import { fill, getMessages } from "@/src/lib/messages";
import { shortlistPlan } from "@/src/lib/stages";
import { currentRound } from "@/src/lib/team-round";
import { confirmShortlistAction } from "../stage-actions";

const t = getMessages();
const a = t.admin;

export const metadata = { title: a.shortlistTitle };

export default async function Shortlist() {
  await requireAdmin();
  const db = getDb()!;
  const round = await currentRound(db);
  const plan = round && round.status === "closed" ? await shortlistPlan(db, round.id) : null;
  const titles = new Map((await loadCatalogue(db)).map((d) => [d.id, d.title]));
  const name = (id: string) => titles.get(id) ?? "—";

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-14">
      <TeamHeader />
      <Link
        href="/admin"
        className="mt-4 inline-flex min-h-11 items-center text-sm text-[var(--muted)]"
      >
        ← {t.auth.adminTitle}
      </Link>
      <h1 className="font-luxe mt-2 text-4xl">{a.shortlistTitle}</h1>

      {!plan ? (
        <p className="mt-4 text-[var(--muted)]">
          {round?.status === "published" ? a.shortlistDone : a.shortlistNotReady}
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {fill(a.shortlistLead, { size: plan.size })}
          </p>
          {(!plan.coverage.enoughSublimation || !plan.coverage.enoughOther) && (
            <p role="note" className="border-coral mt-4 rounded-2xl border-2 p-3 text-sm">
              {fill(a.coverageWarning, {
                sub: plan.coverage.sublimation,
                other: plan.coverage.other,
              })}{" "}
              <Link href="/admin/designs" className="underline">
                {a.nav.designs}
              </Link>
            </p>
          )}
          <ol className="mt-4 space-y-1">
            {plan.cut.included.map((s, i) => (
              <li
                key={s.designId}
                className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--line)] px-3"
              >
                <span className="font-numerals w-6 text-[var(--accent)]">{i + 1}</span>
                <span className="flex-1 truncate font-semibold">{name(s.designId)}</span>
                <span className="font-mono text-xs text-[var(--muted)]">{s.points} pts</span>
              </li>
            ))}
          </ol>

          <ActionForm
            action={confirmShortlistAction}
            submit={a.confirm}
            buttonClassName={`${buttonPrimary} mt-6`}
            className="mt-6"
          >
            <input type="hidden" name="roundId" value={plan.roundId} />
            {plan.cut.needsDecision && (
              <fieldset className="rounded-2xl border-2 border-[var(--accent)] p-3">
                <legend className="px-1 font-bold">{a.tieTitle}</legend>
                <p className="text-sm text-[var(--muted)]">
                  {fill(a.tieBody, { seats: plan.cut.needsDecision.seatsLeft })}
                </p>
                <div className="mt-2 space-y-1">
                  {plan.cut.needsDecision.candidates.map((s) => (
                    <label
                      key={s.designId}
                      className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--line)] px-3"
                    >
                      <input
                        type="checkbox"
                        name="tieChoice"
                        value={s.designId}
                        className="size-5"
                      />
                      <span className="flex-1">{name(s.designId)}</span>
                      <span className="font-mono text-xs text-[var(--muted)]">
                        {s.points} pts · {s.pickedBy}×
                      </span>
                    </label>
                  ))}
                </div>
                <label className="mt-3 block text-sm">
                  {a.tieNote}
                  <input
                    name="note"
                    required
                    maxLength={300}
                    className="mt-1 block min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3"
                  />
                </label>
              </fieldset>
            )}
          </ActionForm>
        </>
      )}
    </div>
  );
}
