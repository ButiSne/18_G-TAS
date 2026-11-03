import { getMessages } from "@/src/lib/messages";

const t = getMessages();

export const metadata = { title: "Competition rules · 18 G-TAS" };

export default function Rules() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12">
      <p className="rounded border-2 border-coral p-3 font-mono text-sm font-bold">
        {t.legal.toBeReviewed}
      </p>
      <h1 className="font-luxe mt-8 text-4xl">Competition rules</h1>
      <p className="mt-6 text-[var(--muted)]">
        There is no prize draw at present, so voting is not a promotional competition. If 18 G-TAS
        adds a prize, it becomes a promotional competition under the Consumer Protection Act, and
        the rules here must be written and checked before launch.
      </p>
    </article>
  );
}
