import Image from "next/image";
import Link from "next/link";
import { getDb } from "@/src/db/server";
import { fill, getMessages } from "@/src/lib/messages";
import { currentPublicRound, publicResults } from "@/src/lib/stages";

const t = getMessages();
const v = t.vote;

export const metadata = { title: v.resultsTitle };

// Rendered on every request: results must appear the moment the admin publishes. (Static
// prerendering would freeze the page as it looked at build time, before any vote existed.)
export const dynamic = "force-dynamic";

/** Public results (brief §2): hidden while voting is open unless the admin shows them live. */
export default async function Results() {
  const db = getDb();
  const pr = db ? await currentPublicRound(db) : null;
  const visible = pr && (pr.status === "published" || pr.showLiveResults);
  const res = visible ? await publicResults(db!, pr!.id) : null;

  return (
    <section className="surface-dark min-h-[80svh] px-4 pt-6 pb-12">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="font-numerals text-sm tracking-[0.3em] text-[var(--accent)]">
          18 G-TAS
        </Link>
        <h1 className="font-youth mt-10 text-5xl leading-none">{v.resultsTitle}</h1>
        {!res ? (
          <p className="mt-4 text-lg text-ivory/85">{v.resultsHidden}</p>
        ) : (
          <>
            <p className="mt-4 text-ivory/85">{v.resultsLead}</p>
            <ol className="mt-8 space-y-3">
              {res.ranked
                .filter((r) => r.swipes > 0)
                .map((r) => (
                  <li
                    key={r.entryId}
                    className="flex items-center gap-3 rounded-2xl p-2 ring-1 ring-white/15"
                  >
                    <span className="font-numerals w-8 text-center text-2xl text-[var(--accent)]">
                      {r.position}
                    </span>
                    <span className="relative size-16 shrink-0 overflow-hidden rounded-xl">
                      <Image
                        src={r.card.thumbUrl}
                        alt={r.card.title}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{r.card.title}</span>
                      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-white/10">
                        <span
                          className="bg-lime block h-full"
                          style={{ width: `${Math.round(r.likeRate * 100)}%` }}
                        />
                      </span>
                    </span>
                    <span className="text-lime font-mono text-sm font-bold">
                      {fill(v.yeboShare, { pct: `${Math.round(r.likeRate * 100)}%` })}
                    </span>
                  </li>
                ))}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}
