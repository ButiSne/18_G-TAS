import { fill, getMessages } from "@/src/lib/messages";
import { getShowcase, type Showcase, type Teaser } from "@/src/lib/showcase";
import { whatsappShareUrl } from "@/src/lib/site";

// Design counts come from the database; refresh them hourly.
export const revalidate = 3600;

const t = getMessages();
const h = t.home;

export default async function Home() {
  const show = await getShowcase();
  const share = whatsappShareUrl(h.shareText);
  return (
    <>
      <Hero share={share} />
      <Peek show={show} />
      <TwoLines show={show} />
      <How />
      <Closing share={share} />
    </>
  );
}

function ChatIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0" fill="currentColor">
      <path d="M12 3C6.48 3 2 6.92 2 11.75c0 2.43 1.14 4.63 2.98 6.21L4.2 21.5l3.86-1.73c1.21.4 2.53.61 3.94.61 5.52 0 10-3.91 10-8.63S17.52 3 12 3Z" />
    </svg>
  );
}

const BIG = "block font-youth uppercase leading-[0.82] text-[clamp(4rem,24vw,13rem)]";

function Hero({ share }: { share: string }) {
  return (
    <section className="surface-dark relative isolate flex min-h-[100svh] flex-col overflow-hidden px-4 pt-5 pb-8">
      {/* Decorative: a gold glow and a giant outlined 18 behind the headline. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(201,162,74,0.22),transparent_60%)]"
      />
      <span
        aria-hidden
        className="font-youth pointer-events-none absolute top-[5svh] -right-[10vw] -z-10 text-[88vw] leading-none text-transparent select-none [-webkit-text-stroke:2px_rgba(201,162,74,0.2)] sm:top-[4svh] sm:text-[34vw]"
      >
        18
      </span>

      <div className="flex items-center justify-between font-mono text-[11px] tracking-[0.25em] uppercase">
        <span className="font-numerals text-sm tracking-[0.3em] text-[var(--accent)]">
          {h.brand}
        </span>
        <span className="text-[var(--muted)]">{h.lines}</span>
      </div>

      <div className="mx-auto mt-auto w-full max-w-5xl">
        <p className="animate-rise font-mono text-xs tracking-[0.3em] text-[var(--accent)] uppercase">
          {h.eyebrow}
        </p>
        <h1 className="mt-4">
          <span className="animate-rise font-numerals block text-2xl tracking-[0.35em] [animation-delay:80ms] sm:text-4xl">
            {h.headlineTop}
          </span>
          <span className={`animate-rise ${BIG} [animation-delay:160ms]`}>{h.headlineIs}</span>
          <span className={`animate-rise ${BIG} [animation-delay:240ms]`}>
            <span className="text-gold-shimmer">{h.headlineBack}</span>
          </span>
        </h1>

        {h.foundedYear && (
          <div className="animate-rise mt-6 flex items-center gap-3 font-mono text-xs tracking-[0.2em] uppercase [animation-delay:300ms]">
            <span className="text-[var(--muted)]">
              {h.timelineEst} {h.foundedYear}
            </span>
            <span
              aria-hidden
              className="animate-draw h-px flex-1 bg-linear-to-r from-gold/20 to-gold"
            />
            <span className="text-[var(--accent)]">
              {h.timelineBack} {h.returnYear}
            </span>
          </div>
        )}

        <p className="animate-rise font-luxe mt-6 max-w-md text-lg leading-snug text-ivory/85 [animation-delay:320ms] sm:text-xl">
          {h.lead}
        </p>

        <div className="animate-rise mt-8 flex flex-col gap-3 [animation-delay:400ms] sm:flex-row">
          <a
            href={share}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gold text-onyx inline-flex h-14 items-center justify-center gap-2 rounded-full px-6 font-bold transition active:scale-[0.98]"
          >
            <ChatIcon />
            {h.ctaShare}
          </a>
          <a
            href="#how"
            className="inline-flex h-14 items-center justify-center gap-2 rounded-full border border-ivory/25 px-6"
          >
            {h.ctaHow} <span aria-hidden>↓</span>
          </a>
        </div>
      </div>
    </section>
  );
}

function Peek({ show }: { show: Showcase }) {
  return (
    <section
      aria-labelledby="peek-title"
      className="surface-dark overflow-hidden border-t border-[var(--line)] py-14"
    >
      <div className="mx-auto max-w-5xl px-4">
        <p className="text-lime font-mono text-xs tracking-[0.3em] uppercase">{h.peek.eyebrow}</p>
        <h2 id="peek-title" className="font-youth mt-3 max-w-xl text-3xl leading-tight sm:text-5xl">
          {show.total ? fill(h.peek.title, { count: show.total }) : h.peek.titleFallback}
        </h2>
      </div>
      {show.teasers.length > 0 && <TeaserStrip teasers={show.teasers} />}
      <p className="mx-auto mt-8 max-w-5xl px-4 text-[var(--muted)]">{h.peek.body}</p>
    </section>
  );
}

/** Two rows of heavily blurred previews drifting in opposite directions. Decorative only. */
function TeaserStrip({ teasers }: { teasers: Teaser[] }) {
  const half = Math.ceil(teasers.length / 2);
  const rows = [teasers.slice(0, half), teasers.slice(half)].filter((r) => r.length);
  return (
    <div aria-hidden className="mt-8 space-y-3">
      {rows.map((row, i) => (
        <div
          key={i}
          className="marquee flex w-max gap-3"
          style={{ animationDirection: i % 2 ? "reverse" : "normal" }}
        >
          {[...row, ...row].map((teaser, j) => (
            <div
              key={`${teaser.id}-${j}`}
              className="relative h-40 w-32 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10"
            >
              <div
                className="absolute -inset-1/4 bg-cover bg-center blur-md saturate-150"
                style={{ backgroundImage: `url(${teaser.blur})` }}
              />
              <span
                className={`text-onyx absolute top-2 left-2 rounded-full px-2 py-0.5 font-mono text-[9px] tracking-widest uppercase ${
                  teaser.line === "EITEEN" ? "bg-lime" : "bg-gold"
                }`}
              >
                {teaser.line}
              </span>
              <span className="absolute inset-x-0 bottom-3 text-center font-mono text-[10px] tracking-[0.3em] text-ivory/85 uppercase">
                {h.peek.stamp}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TwoLines({ show }: { show: Showcase }) {
  const l = h.twoLines;
  const count = (n: number) =>
    n > 0 ? (
      <p className="mt-5 inline-block rounded-full px-3 py-1 font-mono text-xs font-bold">
        {fill(l.count, { count: n })}
      </p>
    ) : null;
  return (
    <section aria-labelledby="lines-title" className="mx-auto max-w-5xl px-4 py-14">
      <h2 id="lines-title" className="font-luxe text-3xl sm:text-5xl">
        {l.title}
      </h2>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <article className="surface-dark relative overflow-hidden rounded-3xl p-6 ring-1 ring-white/10">
          <div
            aria-hidden
            className="from-lime via-pink to-teal absolute inset-x-0 top-0 h-1.5 bg-linear-to-r"
          />
          <p className="text-lime font-mono text-xs tracking-[0.25em] uppercase">{l.eiteen.tag}</p>
          <h3 className="font-youth mt-2 text-5xl">{l.eiteen.name}</h3>
          <p className="mt-3 text-[var(--muted)]">{l.eiteen.body}</p>
          <div className="[&>p]:bg-lime [&>p]:text-onyx">{count(show.byLine.EITEEN)}</div>
        </article>
        <article className="surface-dark ring-gold/40 relative overflow-hidden rounded-3xl bg-[linear-gradient(160deg,var(--color-midnight),var(--color-onyx))] p-6 ring-1">
          <div
            aria-hidden
            className="from-gold-dark via-gold-light to-gold-dark absolute inset-x-0 top-0 h-1.5 bg-linear-to-r"
          />
          <p className="text-gold font-mono text-xs tracking-[0.25em] uppercase">{l.gtas.tag}</p>
          <h3 className="font-numerals text-gold mt-2 text-3xl tracking-[0.15em]">{l.gtas.name}</h3>
          <p className="mt-3 text-[var(--muted)]">{l.gtas.body}</p>
          <div className="[&>p]:bg-gold [&>p]:text-onyx">{count(show.byLine["G-TAS"])}</div>
        </article>
      </div>
    </section>
  );
}

function How() {
  const steps = [h.how.steps.team, h.how.steps.public, h.how.steps.final];
  return (
    <section
      id="how"
      aria-labelledby="how-title"
      className="mx-auto max-w-5xl scroll-mt-4 border-t border-[var(--line)] px-4 py-14"
    >
      <h2 id="how-title" className="font-luxe text-3xl sm:text-5xl">
        {h.how.title}
      </h2>
      <ol className="mt-8 grid gap-6 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4 sm:flex-col sm:gap-2">
            <span className="font-numerals text-4xl leading-none text-[var(--accent)]">
              0{i + 1}
            </span>
            <div>
              <h3 className="font-youth text-xl">{s.title}</h3>
              <p className="mt-1 text-[var(--muted)]">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Closing({ share }: { share: string }) {
  return (
    <section
      aria-labelledby="closing-title"
      className="bg-gold text-onyx px-4 py-14 [--accent:var(--color-onyx)]"
    >
      <div className="mx-auto max-w-5xl">
        <h2 id="closing-title" className="font-youth text-4xl leading-none sm:text-6xl">
          {h.closing.title}
        </h2>
        <p className="mt-4 max-w-md text-lg">{h.closing.body}</p>
        <a
          href={share}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-onyx text-ivory mt-8 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full px-6 font-bold transition active:scale-[0.98] sm:w-auto"
        >
          <ChatIcon />
          {h.ctaShare}
        </a>
        <p className="mt-4 font-mono text-xs">{h.closing.note}</p>
      </div>
    </section>
  );
}
