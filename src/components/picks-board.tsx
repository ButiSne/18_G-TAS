"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { savePicksAction, submitPicksAction, type PickResult } from "@/app/members/actions";
import { DesignCard } from "@/src/components/design-card";
import { buttonGhost, buttonPrimary } from "@/src/components/team-ui";
import type { CatalogueDesign } from "@/src/lib/catalogue";
import { inLine, LINES, type Line } from "@/src/lib/design-line";
import { fill, getMessages } from "@/src/lib/messages";

const t = getMessages();
const r = t.round;
const errorText = (res: PickResult) =>
  res.ok ? "" : ((r.errors as Record<string, string>)[res.code] ?? r.saveError);

/**
 * Pick and rank N designs (brief §8): add from the grid, a sticky tray of N slots at the
 * bottom, and a review sheet to reorder (arrow buttons work on touch and keyboard alike),
 * remove and submit. Every change saves to the server, so nothing is lost on a dropped tab.
 */
export function PicksBoard({
  designs,
  roundId,
  picksPerMember,
  initial,
  locked,
}: {
  designs: CatalogueDesign[];
  roundId: string;
  picksPerMember: number;
  initial: string[];
  locked: boolean;
}) {
  const router = useRouter();
  const [ids, setIds] = useState(initial);
  const [line, setLine] = useState<Line | null>(null);
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState("");
  const [pulse, setPulse] = useState<number | null>(null);
  const [saving, start] = useTransition();
  const byId = useMemo(() => new Map(designs.map((d) => [d.id, d])), [designs]);
  const shown = line ? designs.filter((d) => inLine(d, line)) : designs;
  const full = ids.length >= picksPerMember;

  const commit = (next: string[]) => {
    const previous = ids;
    setIds(next);
    setError("");
    start(async () => {
      const res = await savePicksAction(roundId, next);
      if (!res.ok) {
        setIds(previous);
        setError(errorText(res));
      }
    });
  };

  const toggle = (id: string) => {
    if (ids.includes(id)) return commit(ids.filter((x) => x !== id));
    if (full) return;
    commit([...ids, id]);
    setPulse(ids.length);
    navigator.vibrate?.(12); // a small tap on Android when a slot fills
    setTimeout(() => setPulse(null), 600);
  };

  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j]!, next[i]!];
    commit(next);
  };

  const submit = () => {
    if (!window.confirm(fill(r.submitConfirm, { n: picksPerMember }))) return;
    start(async () => {
      const res = await submitPicksAction(roundId);
      if (!res.ok) return setError(errorText(res));
      setSheet(false);
      router.push("/members");
    });
  };

  return (
    <>
      <nav className="mt-5 flex gap-2 overflow-x-auto" aria-label="Line">
        {[null, ...LINES].map((l) => (
          <button
            key={l ?? "all"}
            type="button"
            onClick={() => setLine(l)}
            aria-pressed={line === l}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${
              line === l
                ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]"
                : "border-[var(--line)]"
            }`}
          >
            {l ?? r.all}
          </button>
        ))}
      </nav>

      <div className="mt-4 grid grid-cols-2 gap-3 pb-40 md:grid-cols-4">
        {shown.map((d, i) => {
          const rank = ids.indexOf(d.id) + 1;
          return (
            <DesignCard
              key={d.id}
              design={d}
              priority={i < 4}
              action={
                locked ? null : (
                  <button
                    type="button"
                    onClick={() => toggle(d.id)}
                    disabled={!rank && full}
                    aria-pressed={rank > 0}
                    className={`mt-2 min-h-11 w-full rounded-full text-sm font-bold transition active:scale-[0.98] disabled:opacity-40 ${
                      rank ? "bg-gold text-onyx" : "border border-[var(--line)]"
                    }`}
                  >
                    {rank ? fill(r.ranked, { rank }) : full ? r.full : `+ ${r.add}`}
                  </button>
                )
              }
            />
          );
        })}
      </div>

      {/* The sticky tray: N slots, the count, and the way to review and submit. */}
      <div className="surface-dark fixed inset-x-0 bottom-0 z-20 border-t border-[var(--line)] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <ol className="flex flex-1 gap-1.5" aria-label={r.trayLabel}>
            {Array.from({ length: picksPerMember }, (_, i) => {
              const d = ids[i] ? byId.get(ids[i]!) : undefined;
              return (
                <li
                  key={i}
                  className={`relative aspect-square w-full max-w-12 overflow-hidden rounded-lg border ${
                    d ? "border-gold" : "border-dashed border-[var(--line)]"
                  } ${pulse === i ? "animate-pulse ring-2 ring-[var(--accent)]" : ""}`}
                >
                  {d ? (
                    <Image
                      src={d.colourways[0]!.thumbUrl}
                      alt={`${i + 1}. ${d.title}`}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="grid h-full place-items-center font-mono text-xs text-[var(--muted)]">
                      {i + 1}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="shrink-0 text-right">
            <p className="font-mono text-xs text-[var(--muted)]">
              {locked ? "✓" : fill(r.trayCount, { count: ids.length, n: picksPerMember })}
            </p>
            {!locked && (
              <button
                type="button"
                onClick={() => setSheet(true)}
                disabled={ids.length === 0}
                className={`mt-1 min-h-11 rounded-full px-4 text-sm font-bold disabled:opacity-40 ${
                  full ? "bg-gold text-onyx" : "border border-[var(--line)]"
                }`}
              >
                {full ? r.reviewSubmit : r.review}
              </button>
            )}
          </div>
        </div>
        {(error || locked) && (
          <p
            role={error ? "alert" : "status"}
            className={`mx-auto mt-2 max-w-5xl text-sm ${error ? "text-coral" : "text-lime"}`}
          >
            {error || r.locked}
          </p>
        )}
      </div>

      {sheet && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sheet-title"
          className="fixed inset-0 z-30 flex items-end bg-black/60"
          onClick={() => setSheet(false)}
        >
          <div
            className="mx-auto max-h-[85svh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-[var(--bg)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 id="sheet-title" className="font-youth text-2xl">
                {r.sheetTitle}
              </h2>
              <button type="button" onClick={() => setSheet(false)} className={buttonGhost}>
                {r.close}
              </button>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">{r.sheetHint}</p>
            <ol className="mt-4 space-y-2">
              {ids.map((id, i) => {
                const d = byId.get(id);
                if (!d) return null;
                return (
                  <li
                    key={id}
                    className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-2"
                  >
                    <span className="font-numerals w-6 text-center text-xl text-[var(--accent)]">
                      {i + 1}
                    </span>
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-xl">
                      <Image
                        src={d.colourways[0]!.thumbUrl}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    </span>
                    {/* Title gets the room on a 360 px phone; Remove is a text button under it. */}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm leading-tight font-bold">
                        {d.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggle(id)}
                        aria-label={`${r.remove}: ${d.title}`}
                        className="-ml-1 min-h-8 px-1 text-xs text-[var(--muted)] underline underline-offset-2"
                      >
                        {r.remove}
                      </button>
                    </span>
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label={`${r.up}: ${d.title}`}
                      className="grid size-11 place-items-center rounded-full border border-[var(--line)] disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === ids.length - 1}
                      aria-label={`${r.down}: ${d.title}`}
                      className="grid size-11 place-items-center rounded-full border border-[var(--line)] disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </li>
                );
              })}
            </ol>
            <button
              type="button"
              onClick={submit}
              disabled={!full || saving}
              className={`${buttonPrimary} mt-4`}
            >
              {saving ? r.submitting : fill(r.submit, { n: picksPerMember })}
            </button>
            {!full && (
              <p className="mt-2 text-center text-sm text-[var(--muted)]">
                {fill(r.needMore, { left: picksPerMember - ids.length })}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
