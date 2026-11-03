import Link from "next/link";
import { fill, getMessages } from "@/src/lib/messages";
import { LEGAL_LINKS } from "@/src/lib/site";

const t = getMessages();

export function SiteFooter() {
  const f = t.footer;
  return (
    <footer className="surface-dark border-t border-[var(--line)] px-4 pt-10 pb-[calc(2rem+env(safe-area-inset-bottom))] text-sm">
      <div className="mx-auto max-w-5xl">
        <p className="font-numerals text-lg tracking-[0.3em] text-[var(--accent)]">{t.site.name}</p>
        <p className="mt-1 text-[var(--muted)]">{f.tagline}</p>

        <nav aria-label={f.navLabel} className="mt-8">
          <ul className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
            {LEGAL_LINKS.map((l) => (
              <li key={l.key}>
                <Link
                  href={l.href}
                  {...(l.href.startsWith("http")
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                >
                  {f.links[l.key]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-8 space-y-2 border-t border-[var(--line)] pt-6 text-xs leading-relaxed text-[var(--muted)]">
          <p>{fill(f.copyright, { year: new Date().getFullYear() })}</p>
          <p>{f.ip}</p>
          <p>{f.affiliation}</p>
        </div>
      </div>
    </footer>
  );
}
