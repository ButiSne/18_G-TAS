import Link from "next/link";
import { getMessages } from "@/src/lib/messages";

const t = getMessages();

// Shared frame for the legal pages: a way home, the review warning (brief §6) and the date.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-4 pb-14">
      <Link
        href="/"
        className="font-numerals inline-flex min-h-11 items-center gap-2 text-sm tracking-[0.3em] text-[var(--accent)]"
      >
        <span aria-hidden>←</span> {t.legal.home}
      </Link>
      <p role="note" className="border-coral mt-4 rounded border-2 p-3 font-mono text-sm font-bold">
        {t.legal.toBeReviewed}
      </p>
      <article className="legal mt-8">{children}</article>
      <p className="mt-12 font-mono text-xs text-[var(--muted)]">{t.legal.lastUpdated}</p>
    </div>
  );
}
