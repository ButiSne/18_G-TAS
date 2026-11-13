import Image from "next/image";
import Link from "next/link";
import { ActionForm } from "@/src/components/action-form";
import { buttonPrimary, TeamHeader } from "@/src/components/team-ui";
import { getDb } from "@/src/db/server";
import { requireAdmin } from "@/src/lib/auth/session";
import { getMessages } from "@/src/lib/messages";
import { PRINT_METHOD_LABELS, isPrintMethod } from "@/src/lib/print-methods";
import {
  currentPublicRound,
  finalCandidates,
  productionHandoff,
  type FinalCandidateRow,
} from "@/src/lib/stages";
import { saveFinalTenAction } from "../stage-actions";

const t = getMessages();
const a = t.admin;

export const metadata = { title: a.finalTitle };

export default async function FinalTen() {
  await requireAdmin();
  const db = getDb()!;
  const pr = await currentPublicRound(db);
  if (!pr) {
    return (
      <Shell>
        <p className="mt-4 text-[var(--muted)]">{a.publicNone}</p>
      </Shell>
    );
  }
  const candidates = await finalCandidates(db, pr.id);
  const handoff = await productionHandoff(db, pr.id);
  const chosen = new Set(handoff.map((h) => h.designId));
  const groups: [string, FinalCandidateRow[]][] = [
    [a.sublimation, candidates.filter((c) => c.slot === "sublimation")],
    [a.other, candidates.filter((c) => c.slot === "other")],
    [a.finalNoMethod, candidates.filter((c) => c.slot === null)],
  ];

  return (
    <Shell>
      <p className="mt-2 text-sm text-[var(--muted)]">{a.finalLead}</p>
      <ActionForm
        action={saveFinalTenAction}
        submit={a.saveFinal}
        okLabel={`✓ ${a.saved}`}
        buttonClassName={`${buttonPrimary} mt-6`}
        className="mt-4"
      >
        <input type="hidden" name="publicRoundId" value={pr.id} />
        {groups.map(([title, rows]) =>
          rows.length ? (
            <fieldset key={title} className="mt-5">
              <legend className="font-youth text-xl">{title}</legend>
              <div className="mt-2 space-y-2">
                {rows.map((c) => (
                  <label
                    key={c.designId}
                    className={`flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-2 ${c.slot ? "" : "opacity-50"}`}
                  >
                    <input
                      type="checkbox"
                      name="designIds"
                      value={c.designId}
                      defaultChecked={chosen.has(c.designId)}
                      disabled={!c.slot}
                      className="size-5 shrink-0"
                    />
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-xl">
                      <Image
                        src={c.thumbUrl}
                        alt={c.title}
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold">{c.title}</span>
                        {c.adminChoice && (
                          <span className="bg-gold text-onyx shrink-0 rounded-full px-1.5 py-px font-mono text-[9px] font-bold uppercase">
                            {t.round.adminChoice}
                          </span>
                        )}
                      </span>
                      <span className="block font-mono text-[11px] text-[var(--muted)]">
                        #{c.teamPosition} · {c.teamPoints} {a.teamPoints} · {a.yeboRate}{" "}
                        {c.swipes ? `${Math.round(c.likeRate * 100)}% (#${c.publicPosition})` : "–"}
                        {isPrintMethod(c.printMethod)
                          ? ` · ${PRINT_METHOD_LABELS[c.printMethod]}`
                          : ""}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null,
        )}
      </ActionForm>

      {handoff.length > 0 && (
        <section className="mt-10">
          <h2 className="font-youth text-2xl">{a.handoffTitle}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{a.handoffBody}</p>
          <Link
            href="/admin/quotes"
            className="mt-2 inline-flex min-h-11 items-center text-sm font-bold underline"
          >
            {a.nav.quotes} →
          </Link>
          <ol className="mt-4 space-y-3">
            {handoff.map((h) => (
              <li key={h.designId} className="rounded-2xl border border-[var(--line)] p-3">
                <p className="font-bold">
                  {h.position}. {h.title}{" "}
                  <span className="font-mono text-xs text-[var(--muted)]">
                    ·{" "}
                    {isPrintMethod(h.printMethod)
                      ? PRINT_METHOD_LABELS[h.printMethod]
                      : h.printMethod}
                  </span>
                </p>
                <ul className="mt-1 space-y-0.5 font-mono text-[11px] break-all text-[var(--muted)]">
                  {[...h.colourways.flatMap((c) => c.files), ...h.designFiles].map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-14">
      <TeamHeader />
      <Link
        href="/admin"
        className="mt-4 inline-flex min-h-11 items-center text-sm text-[var(--muted)]"
      >
        ← {t.auth.adminTitle}
      </Link>
      <h1 className="font-luxe mt-2 text-4xl">{a.finalTitle}</h1>
      {children}
    </div>
  );
}
