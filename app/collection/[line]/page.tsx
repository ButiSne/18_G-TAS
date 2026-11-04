import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Line } from "@/src/lib/design-line";
import { fill, getMessages } from "@/src/lib/messages";
import { getShowcase, shortlistFor } from "@/src/lib/showcase";

const t = getMessages();
const c = t.collection;
const h = t.home;

// Public line pages (EITEEN for the youth, G-TAS for the elders). Before the team has
// confirmed its shortlist they only tease; afterwards they show the shortlisted designs
// of that line, never the rest of the catalogue.
const LINES: Record<string, { line: Line; copy: typeof c.eiteen; other: string }> = {
  eiteen: { line: "EITEEN", copy: c.eiteen, other: "g-tas" },
  "g-tas": { line: "G-TAS", copy: c.gtas, other: "eiteen" },
};

// Same freshness as the landing page, so a tile's count and this page always agree.
export const revalidate = 300;
const TEASER_TILES = 24;
export const dynamicParams = false;
export const generateStaticParams = () => Object.keys(LINES).map((line) => ({ line }));

type Props = { params: Promise<{ line: string }> };

export async function generateMetadata({ params }: Props) {
  const entry = LINES[(await params).line];
  return entry ? { title: entry.copy.name, description: entry.copy.body } : {};
}

export default async function Collection({ params }: Props) {
  const entry = LINES[(await params).line];
  if (!entry) notFound();
  const { line, copy, other } = entry;
  const eiteen = line === "EITEEN";
  // Every teaser: the grid shows some and counts the rest, so it adds up to the tile's number.
  const show = await getShowcase(1000);
  const revealed = show.shortlist.length > 0;
  const cards = shortlistFor(show, line);
  const teasers = show.teasers.filter((x) => x.line === line);
  const lineTotal = show.byLine[line];
  const shownTeasers = teasers.slice(0, lineTotal > TEASER_TILES ? TEASER_TILES - 1 : TEASER_TILES);
  const moreCount = lineTotal - shownTeasers.length;
  const accent = eiteen ? "text-lime" : "text-gold";

  return (
    <section className="surface-dark min-h-[80svh] px-4 pt-6 pb-14">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="font-numerals inline-flex min-h-11 items-center text-sm tracking-[0.3em] text-[var(--accent)]"
        >
          ← 18 G-TAS
        </Link>
        <div
          aria-hidden
          className={`mt-4 h-1.5 rounded-full bg-linear-to-r ${
            eiteen ? "from-lime via-pink to-teal" : "from-gold-dark via-gold-light to-gold-dark"
          }`}
        />
        <p className={`mt-6 font-mono text-xs tracking-[0.25em] uppercase ${accent}`}>{copy.tag}</p>
        <h1
          className={
            eiteen
              ? "font-youth mt-2 text-6xl leading-none"
              : "font-numerals text-gold mt-2 text-4xl tracking-[0.15em]"
          }
        >
          {copy.name}
        </h1>
        <p className="mt-4 max-w-xl text-lg text-ivory/85">{copy.body}</p>

        {revealed ? (
          <>
            <p className={`mt-6 font-mono text-sm font-bold ${accent}`}>
              {fill(c.shortlisted, { count: cards.length })}
            </p>
            {cards.length === 0 ? (
              <p className="mt-4 text-[var(--muted)]">{c.empty}</p>
            ) : (
              <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                {cards.map((card, i) => (
                  <li
                    key={card.designId}
                    className="overflow-hidden rounded-2xl ring-1 ring-white/10"
                  >
                    <MaybeVoteLink open={show.voting === "open"}>
                      <span className="relative block aspect-[1200/1380] bg-[#ececec]">
                        <Image
                          src={card.thumbUrl}
                          alt={`${card.title}, ${card.colourwayName}`}
                          fill
                          sizes="(min-width: 768px) 25vw, 50vw"
                          priority={i < 4}
                          placeholder={card.blurDataUrl ? "blur" : "empty"}
                          blurDataURL={card.blurDataUrl ?? undefined}
                          className="object-cover"
                        />
                      </span>
                      <span className="block p-3">
                        <span className="block text-sm leading-tight font-bold">{card.title}</span>
                        <span className="block truncate text-xs text-[var(--muted)]">
                          {card.colourwayName}
                        </span>
                      </span>
                    </MaybeVoteLink>
                  </li>
                ))}
              </ul>
            )}
            {show.voting === "open" && (
              <Link
                href="/vote"
                className="bg-gold text-onyx mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-full px-6 font-bold sm:w-auto"
              >
                {h.peek.ctaVote} →
              </Link>
            )}
            {(show.voting === "closed" || show.voting === "published") && (
              <Link
                href="/results"
                className="bg-gold text-onyx mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-full px-6 font-bold sm:w-auto"
              >
                {h.peek.ctaResults} →
              </Link>
            )}
          </>
        ) : (
          <>
            <p className={`mt-6 font-mono text-sm font-bold ${accent}`}>
              {fill(c.teaserTitle, { count: lineTotal })}
            </p>
            <p className="mt-2 max-w-xl text-[var(--muted)]">{c.teaserBody}</p>
            <ul className="mt-6 grid grid-cols-3 gap-2 md:grid-cols-6">
              {shownTeasers.map((x) => (
                <li
                  key={x.id}
                  aria-hidden
                  className="relative aspect-[1200/1380] overflow-hidden rounded-xl ring-1 ring-white/10"
                >
                  <span
                    className="absolute -inset-1/4 bg-cover bg-center blur-md saturate-150"
                    style={{ backgroundImage: `url(${x.blur})` }}
                  />
                </li>
              ))}
              {moreCount > 0 && (
                <li
                  aria-label={fill(c.moreLabel, { count: moreCount })}
                  className={`grid aspect-[1200/1380] place-items-center rounded-xl border border-dashed border-white/25 font-mono text-sm font-bold ${accent}`}
                >
                  {fill(c.more, { count: moreCount })}
                </li>
              )}
            </ul>
          </>
        )}

        <Link
          href={`/collection/${other}`}
          className="mt-10 inline-flex min-h-11 items-center text-sm underline underline-offset-4"
        >
          {c.other} →
        </Link>
      </div>
    </section>
  );
}

/** While the public vote is open, a shortlisted design is a way in to choose. */
function MaybeVoteLink({ open, children }: { open: boolean; children: React.ReactNode }) {
  return open ? (
    <Link href="/vote" className="block transition active:scale-[0.98]">
      {children}
    </Link>
  ) : (
    <>{children}</>
  );
}
