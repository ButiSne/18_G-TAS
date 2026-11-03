// Small shared pieces for the team and admin screens.
import Link from "next/link";
import { getMessages } from "@/src/lib/messages";

const t = getMessages();

export const buttonPrimary =
  "bg-gold text-onyx inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-6 font-bold transition active:scale-[0.98] disabled:opacity-60";
export const buttonGhost =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--line)] px-5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60";

export function TeamHeader() {
  return (
    <div className="flex items-center justify-between">
      <Link
        href="/"
        className="font-numerals inline-flex min-h-11 items-center text-sm tracking-[0.3em] text-[var(--accent)]"
      >
        18 G-TAS
      </Link>
      <span className="font-mono text-[11px] tracking-[0.25em] text-[var(--muted)] uppercase">
        {t.auth.eyebrow.split("·")[1]?.trim()}
      </span>
    </div>
  );
}
