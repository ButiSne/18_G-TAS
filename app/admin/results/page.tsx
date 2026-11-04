import Image from "next/image";
import Link from "next/link";
import { TeamHeader } from "@/src/components/team-ui";
import { getDb } from "@/src/db/server";
import { requireAdmin } from "@/src/lib/auth/session";
import { fill, getMessages } from "@/src/lib/messages";
import { currentPublicRound, publicResults } from "@/src/lib/stages";

const t = getMessages();
const a = t.admin;

export const metadata = { title: a.resultsTitle };

export default async function AdminResults() {
  await requireAdmin();
  const db = getDb()!;
  const pr = await currentPublicRound(db);
  const res = pr ? await publicResults(db, pr.id) : null;
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-14">
      <TeamHeader />
      <Link
        href="/admin"
        className="mt-4 inline-flex min-h-11 items-center text-sm text-[var(--muted)]"
      >
        ← {t.auth.adminTitle}
      </Link>
      <h1 className="font-luxe mt-2 text-4xl">{a.resultsTitle}</h1>
      {!res ? (
        <p className="mt-4 text-[var(--muted)]">{a.publicNone}</p>
      ) : (
        <>
          <p className="mt-2 font-mono text-sm">{fill(a.devices, { count: res.devices })}</p>
          <ol className="mt-4 space-y-2">
            {res.ranked.map((r) => (
              <li
                key={r.entryId}
                className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-2"
              >
                <span className="font-numerals w-8 text-center text-xl text-[var(--accent)]">
                  {r.swipes ? r.position : "–"}
                </span>
                <span className="relative size-12 shrink-0 overflow-hidden rounded-xl">
                  <Image
                    src={r.card.thumbUrl}
                    alt={r.card.title}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{r.card.title}</p>
                  <p className="font-mono text-[11px] text-[var(--muted)]">
                    {a.yeboRate} {pct(r.likeRate)} · {r.swipes} {a.swipes} · {r.numberOne}{" "}
                    {a.numberOne}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <section className="rounded-2xl border border-[var(--line)] p-4">
              <h2 className="font-bold">{a.byChannel}</h2>
              <ul className="mt-2 space-y-1 font-mono text-sm">
                {res.byRef.map((x) => (
                  <li key={x.ref} className="flex justify-between">
                    <span>{x.ref}</span>
                    <span>{x.devices}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-2xl border border-[var(--line)] p-4">
              <h2 className="font-bold">{a.byAge}</h2>
              <ul className="mt-2 space-y-1 font-mono text-sm">
                {res.byAge.map((x) => (
                  <li key={x.ageBracket} className="flex justify-between">
                    <span>{x.ageBracket}</span>
                    <span>{x.devices}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
