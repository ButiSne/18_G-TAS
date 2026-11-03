import { getMessages } from "@/src/lib/messages";

const t = getMessages();
const stages = [t.home.stages.team, t.home.stages.public, t.home.stages.final];

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-20">
      <p className="font-numerals text-sm tracking-[0.3em] text-[var(--accent)]">
        {t.home.eyebrow}
      </p>
      <h1 className="font-luxe mt-4 text-4xl leading-tight sm:text-6xl">{t.home.title}</h1>
      <p className="mt-6 max-w-xl text-lg text-[var(--muted)]">{t.home.lead}</p>

      <ol className="mt-12 grid gap-4 sm:grid-cols-3">
        {stages.map((s, i) => (
          <li key={s.title} className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-5">
            <span className="font-mono text-xs text-[var(--accent)]">0{i + 1}</span>
            <h2 className="font-youth mt-2 text-lg">{s.title}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{s.body}</p>
          </li>
        ))}
      </ol>

      <p className="mt-12 font-mono text-sm text-[var(--muted)]">{t.home.comingSoon}</p>
    </div>
  );
}
