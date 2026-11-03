import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamHeader } from "@/src/components/team-ui";
import { getDb } from "@/src/db/server";
import { requireMember } from "@/src/lib/auth/session";
import { loadCatalogue, swatchFor } from "@/src/lib/catalogue";
import { lineBadge } from "@/src/lib/design-line";
import { fill, getMessages } from "@/src/lib/messages";
import { isPrintMethod, PRINT_METHOD_LABELS } from "@/src/lib/print-methods";

const t = getMessages();
const c = t.catalogue;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DesignDetail({ params, searchParams }: Props) {
  await requireMember();
  const { slug } = await params;
  const design = (await loadCatalogue(getDb()!)).find((d) => d.slug === slug);
  if (!design) notFound();

  const requested = Number((await searchParams).c);
  const index = Number.isInteger(requested) && design.colourways[requested] ? requested : 0;
  const cw = design.colourways[index]!;
  const alt = (name: string) => fill(c.colourwayOf, { design: design.title, colourway: name });

  return (
    <>
      <TeamHeader />
      <Link
        href="/designs"
        className="mt-4 inline-flex min-h-11 items-center text-sm text-[var(--muted)]"
      >
        ← {c.back}
      </Link>

      <div className="mt-2 grid gap-6 md:grid-cols-2">
        {/* Tap the image for the full 1600 px file: the phone's own pinch-zoom does the rest. */}
        <a
          href={cw.imageUrl}
          target="_blank"
          rel="noopener"
          aria-label={`${c.zoom}: ${alt(cw.name)}`}
          className="relative block aspect-[1200/1380] overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--card)]"
        >
          <Image
            src={cw.imageUrl}
            alt={alt(cw.name)}
            fill
            priority
            sizes="(min-width: 768px) 50vw, 100vw"
            placeholder={cw.blurDataUrl ? "blur" : "empty"}
            blurDataURL={cw.blurDataUrl ?? undefined}
            className="object-cover"
          />
          <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-3 py-1 font-mono text-[10px] tracking-widest text-white uppercase">
            ⤢ {c.zoom}
          </span>
        </a>

        <div>
          <p className="font-mono text-xs tracking-[0.25em] text-[var(--accent)] uppercase">
            {lineBadge(design)}
            {design.collection ? ` · ${design.collection.title}` : ""}
          </p>
          <h1 className="font-youth mt-2 text-4xl leading-tight">{design.title}</h1>
          <p className="mt-1 text-[var(--muted)]">{cw.name}</p>

          {design.colourways.length > 1 && (
            <>
              <h2 className="mt-6 text-sm font-bold">{c.colourways}</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {design.colourways.map((x, i) => (
                  <li key={x.id}>
                    <Link
                      href={`/designs/${design.slug}?c=${i}`}
                      aria-current={i === index ? "true" : undefined}
                      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm ${
                        i === index ? "border-[var(--fg)] font-bold" : "border-[var(--line)]"
                      }`}
                    >
                      <span
                        className="size-4 rounded-full ring-1 ring-black/20"
                        style={{ background: swatchFor(x.teeColour) }}
                      />
                      {x.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl border border-[var(--line)] p-3">
              <dt className="text-[var(--muted)]">{c.print}</dt>
              <dd className="mt-1 font-bold">
                {isPrintMethod(design.printMethod)
                  ? PRINT_METHOD_LABELS[design.printMethod]
                  : c.printNotSet}
              </dd>
            </div>
            <div className="rounded-2xl border border-[var(--line)] p-3">
              <dt className="text-[var(--muted)]">{c.colour}</dt>
              <dd className="mt-1 font-bold">{cw.teeColour ?? "—"}</dd>
            </div>
          </dl>

          {cw.views.length > 0 && (
            <>
              <h2 className="mt-6 text-sm font-bold">{c.details}</h2>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {cw.views.map((v, i) => (
                  <a
                    key={v.imageUrl}
                    href={v.imageUrl}
                    target="_blank"
                    rel="noopener"
                    className="relative block aspect-[1200/1380] overflow-hidden rounded-2xl border border-[var(--line)]"
                  >
                    <Image
                      src={v.thumbUrl}
                      alt={`${alt(cw.name)} (${c.details} ${i + 1})`}
                      fill
                      sizes="50vw"
                      className="object-cover"
                    />
                  </a>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
