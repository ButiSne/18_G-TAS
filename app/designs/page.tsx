import Link from "next/link";
import { DesignCard } from "@/src/components/design-card";
import { buttonGhost, buttonPrimary, TeamHeader } from "@/src/components/team-ui";
import { getDb } from "@/src/db/server";
import { requireMember } from "@/src/lib/auth/session";
import {
  applyFilters,
  catalogueHref,
  loadCatalogue,
  newSeed,
  parseFilters,
  type CatalogueFilters,
} from "@/src/lib/catalogue";
import { LINES } from "@/src/lib/design-line";
import { fill, getMessages } from "@/src/lib/messages";
import {
  PLACEMENT_LABELS,
  PLACEMENTS,
  PRINT_METHOD_LABELS,
  PRINT_METHODS,
  type Placement,
  type PrintMethod,
} from "@/src/lib/print-methods";
import { TEE_COLOURS } from "@/src/ingest/tee-colour";

const t = getMessages();
const c = t.catalogue;

export const metadata = { title: c.title };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Designs({ searchParams }: Props) {
  await requireMember();
  const filters = parseFilters(await searchParams);
  const all = await loadCatalogue(getDb()!);
  const shown = applyFilters(all, filters);
  const collections = [
    ...new Map(
      all.flatMap((d) => (d.collection ? [[d.collection.slug, d.collection]] : [])),
    ).values(),
  ];
  const colours = TEE_COLOURS.filter((col) =>
    all.some((d) => d.colourways.some((cw) => cw.teeColour === col)),
  );
  const prints = PRINT_METHODS.filter((p) => all.some((d) => d.printMethod === p));
  const placements = PLACEMENTS.filter((p) => all.some((d) => d.placement === p));

  return (
    <>
      <TeamHeader />
      <div className="mt-8 flex items-end justify-between gap-4">
        <h1 className="font-luxe text-4xl">{c.title}</h1>
        <p className="font-mono text-xs text-[var(--muted)]">
          {fill(c.count, { count: shown.length })}
        </p>
      </div>

      <nav aria-label={c.line} className="mt-5 flex gap-2 overflow-x-auto">
        <Chip href={catalogueHref(filters, { line: undefined })} active={!filters.line}>
          {c.all}
        </Chip>
        {LINES.map((line) => (
          <Chip key={line} href={catalogueHref(filters, { line })} active={filters.line === line}>
            {line}
          </Chip>
        ))}
        <Chip href={catalogueHref(filters, { seed: newSeed() })} active={false}>
          ⤮ {c.shuffle}
        </Chip>
      </nav>

      <FilterPanel
        filters={filters}
        collections={collections}
        colours={colours}
        prints={prints}
        placements={placements}
      />

      {shown.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--line)] p-8 text-center">
          <p className="text-[var(--muted)]">{c.empty}</p>
          <Link href="/designs" className={`${buttonGhost} mt-4`}>
            {c.reset}
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {shown.map((d, i) => (
            <DesignCard key={d.id} design={d} priority={i < 4} />
          ))}
        </div>
      )}
    </>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-semibold ${
        active ? "border-[var(--fg)] bg-[var(--fg)] text-[var(--bg)]" : "border-[var(--line)]"
      }`}
    >
      {children}
    </Link>
  );
}

/** A plain GET form inside <details>: works before JavaScript loads on a slow phone. */
function FilterPanel({
  filters,
  collections,
  colours,
  prints,
  placements,
}: {
  filters: CatalogueFilters;
  collections: { slug: string; title: string }[];
  colours: readonly string[];
  prints: readonly PrintMethod[];
  placements: readonly Placement[];
}) {
  const open = Boolean(
    filters.collection || filters.colour || filters.print || filters.placement || filters.q,
  );
  const field =
    "mt-1 block min-h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3";
  return (
    <details open={open} className="mt-3 rounded-2xl border border-[var(--line)] p-3">
      <summary className="min-h-8 cursor-pointer font-semibold">{c.filters}</summary>
      <form method="get" action="/designs" className="mt-3 grid gap-3 sm:grid-cols-2">
        {filters.line && <input type="hidden" name="line" value={filters.line} />}
        <label className="text-sm">
          {c.search}
          <input
            name="q"
            defaultValue={filters.q}
            placeholder={c.searchPlaceholder}
            className={field}
          />
        </label>
        <label className="text-sm">
          {c.collection}
          <select name="collection" defaultValue={filters.collection ?? ""} className={field}>
            <option value="">{c.any}</option>
            {collections.map((col) => (
              <option key={col.slug} value={col.slug}>
                {col.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {c.colour}
          <select name="colour" defaultValue={filters.colour ?? ""} className={field}>
            <option value="">{c.any}</option>
            {colours.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </label>
        {prints.length > 0 && (
          <label className="text-sm">
            {c.print}
            <select name="print" defaultValue={filters.print ?? ""} className={field}>
              <option value="">{c.any}</option>
              {prints.map((p) => (
                <option key={p} value={p}>
                  {PRINT_METHOD_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
        )}
        {placements.length > 0 && (
          <label className="text-sm">
            {c.placement}
            <select name="placement" defaultValue={filters.placement ?? ""} className={field}>
              <option value="">{c.any}</option>
              {placements.map((p) => (
                <option key={p} value={p}>
                  {PLACEMENT_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" className={buttonPrimary}>
            {c.apply}
          </button>
          <Link href="/designs" className={buttonGhost}>
            {c.reset}
          </Link>
        </div>
      </form>
    </details>
  );
}
