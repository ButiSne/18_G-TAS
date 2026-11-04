import Image from "next/image";
import Link from "next/link";
import { TeamHeader } from "@/src/components/team-ui";
import { getDb } from "@/src/db/server";
import { requireMember } from "@/src/lib/auth/session";
import { loadCatalogue } from "@/src/lib/catalogue";
import { fill, getMessages } from "@/src/lib/messages";
import { currentRound, roundProgress, roundResults, type NoteKind } from "@/src/lib/team-round";

const t = getMessages();
const r = t.round;

export const metadata = { title: r.resultsTitle };

export default async function Results() {
  await requireMember();
  const db = getDb()!;
  const round = await currentRound(db);
  const results = round ? await roundResults(db, round.id) : null;

  if (!round || !results) {
    const progress = round ? await roundProgress(db, round.id) : null;
    return (
      <>
        <TeamHeader />
        <h1 className="font-luxe mt-10 text-4xl">{r.resultsTitle}</h1>
        <p className="mt-4 text-[var(--muted)]">{r.resultsHidden}</p>
        {progress && progress.invited > 0 && (
          <p className="mt-2 font-mono text-sm">{fill(r.homeWaiting, progress)}</p>
        )}
      </>
    );
  }

  const designs = new Map((await loadCatalogue(db)).map((d) => [d.id, d]));
  const title = (id: string) => designs.get(id)?.title ?? "—";
  // Notes per design, with who wrote them: shown only now that the round is closed.
  const notesFor = (designId: string) =>
    results.byMember.flatMap((m) => {
      const n = m.notes[designId];
      return n ? [{ name: m.name, ...n }] : [];
    });
  const suggestions = results.byMember.filter((m) => m.suggestion);

  return (
    <>
      <TeamHeader />
      <h1 className="font-luxe mt-10 text-4xl">{r.resultsTitle}</h1>
      <p className="mt-2 font-mono text-xs text-[var(--muted)] uppercase">{round.title}</p>

      <ol className="mt-6 space-y-2">
        {results.standings.map((s) => {
          const d = designs.get(s.designId);
          return (
            <li
              key={s.designId}
              className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-2"
            >
              <span className="font-numerals w-8 text-center text-xl text-[var(--accent)]">
                {s.position}
              </span>
              {d && (
                <Link
                  href={`/designs/${d.slug}`}
                  className="relative size-14 shrink-0 overflow-hidden rounded-xl"
                >
                  <Image
                    src={d.colourways[0]!.thumbUrl}
                    alt={d.title}
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </Link>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{title(s.designId)}</p>
                <p className="font-mono text-[11px] text-[var(--muted)]">
                  {s.points} {r.points.toLowerCase()} · {r.pickedBy.toLowerCase()} {s.pickedBy} ·{" "}
                  {s.firstPlaces} {r.firsts.toLowerCase()}
                </p>
                <Notes notes={notesFor(s.designId)} />
              </div>
              {s.consensus && (
                <span className="bg-lime text-onyx shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase">
                  {r.consensus}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <h2 className="font-youth mt-10 text-2xl">{r.whoPicked}</h2>
      <div className="mt-4 space-y-3">
        {results.byMember.map((m) => (
          <section key={m.memberId} className="rounded-2xl border border-[var(--line)] p-4">
            <h3 className="font-bold">{m.name}</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[var(--muted)]">
              {m.designIds.map((id) => (
                <li key={id}>
                  {title(id)}
                  {m.notes[id] && (
                    <span className="mt-0.5 block text-xs text-[var(--fg)]">
                      <Kind kind={m.notes[id].kind} /> {m.notes[id].note}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      {suggestions.length > 0 && (
        <>
          <h2 className="font-youth mt-10 text-2xl">{r.teamSuggestions}</h2>
          <ul className="mt-4 space-y-3">
            {suggestions.map((m) => (
              <li
                key={m.memberId}
                className="rounded-2xl border border-dashed border-[var(--line)] p-4"
              >
                <p className="font-bold">{m.name}</p>
                <p className="mt-1 text-sm break-words whitespace-pre-line">{m.suggestion}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function Kind({ kind }: { kind: NoteKind }) {
  return (
    <span
      className={`mr-1 inline-block rounded-full px-1.5 py-px font-mono text-[9px] font-bold uppercase ${
        kind === "suggestion" ? "bg-teal text-onyx" : "bg-gold text-onyx"
      }`}
    >
      {r.noteKinds[kind]}
    </span>
  );
}

/** The team's notes on one design, folded away so the ranking stays scannable. */
function Notes({ notes }: { notes: { name: string; note: string; kind: NoteKind }[] }) {
  if (notes.length === 0) return null;
  return (
    <details className="mt-1">
      <summary className="min-h-8 cursor-pointer text-xs font-semibold text-[var(--accent)]">
        {fill(r.notesCount, { count: notes.length })}
      </summary>
      <ul className="mt-1 space-y-1.5">
        {notes.map((n) => (
          <li key={n.name} className="text-xs break-words whitespace-pre-line">
            <Kind kind={n.kind} />
            <span className="font-bold">{n.name}:</span> {n.note}
          </li>
        ))}
      </ul>
    </details>
  );
}
