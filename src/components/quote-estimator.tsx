"use client";

import { useState } from "react";
import {
  formatRand,
  MASUMPA,
  quote,
  quoteRequestUrl,
  type Product,
  type QuoteLine,
} from "@/src/lib/printers";

const PRODUCTS: Product[] = ["crew-neck", "golf-shirt"];
const productLabel = (p: Product) => MASUMPA.priceLists.find((l) => l.product === p)!.label;
const field = "min-h-11 rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 text-base";

/**
 * Estimates Masumpa's price for the designs going to print, and opens a WhatsApp quote
 * request with the same list. With no final ten yet, it starts from a plain "how many
 * designs, how many each" calculator.
 */
export function QuoteEstimator({
  designs,
  others,
}: {
  /** The final ten's sublimation designs (Masumpa's flyers price sublimation only). */
  designs: { label: string }[];
  /** The rest of the final ten, listed in the request as "please also quote". */
  others: { label: string; method: string }[];
}) {
  const start: QuoteLine[] = designs.length
    ? designs.map((d) => ({ label: d.label, product: "crew-neck", quantity: 20 }))
    : Array.from({ length: 5 }, (_, i) => ({
        label: `Design ${i + 1}`,
        product: "crew-neck" as Product,
        quantity: 20,
      }));
  const [lines, setLines] = useState<QuoteLine[]>(start);
  const q = quote(lines);
  const set = (i: number, change: Partial<QuoteLine>) =>
    setLines((all) => all.map((l, j) => (j === i ? { ...l, ...change } : l)));
  const sameForAll = (change: Partial<QuoteLine>) =>
    setLines((all) => all.map((l) => ({ ...l, ...change })));

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          Product for all
          <select
            className={`${field} mt-1 block`}
            onChange={(e) => sameForAll({ product: e.target.value as Product })}
            defaultValue="crew-neck"
          >
            {PRODUCTS.map((p) => (
              <option key={p} value={p}>
                {productLabel(p)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Pieces each
          <input
            type="number"
            inputMode="numeric"
            min={1}
            defaultValue={20}
            onChange={(e) => sameForAll({ quantity: Number(e.target.value) })}
            className={`${field} mt-1 block w-28`}
          />
        </label>
        {!designs.length && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setLines((all) => [
                  ...all,
                  { label: `Design ${all.length + 1}`, product: "crew-neck", quantity: 20 },
                ])
              }
              className="min-h-11 rounded-full border border-[var(--line)] px-4 text-sm font-bold"
            >
              + Design
            </button>
            <button
              type="button"
              onClick={() => setLines((all) => all.slice(0, -1))}
              disabled={lines.length <= 1}
              className="min-h-11 rounded-full border border-[var(--line)] px-4 text-sm disabled:opacity-40"
            >
              − Design
            </button>
          </div>
        )}
      </div>

      <ul className="mt-4 space-y-2">
        {q.lines.map((l, i) => (
          <li key={i} className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-3">
            <p className="text-sm font-bold">{l.label}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                aria-label={`Product: ${l.label}`}
                value={l.product}
                onChange={(e) => set(i, { product: e.target.value as Product })}
                className={field}
              >
                {PRODUCTS.map((p) => (
                  <option key={p} value={p}>
                    {productLabel(p)}
                  </option>
                ))}
              </select>
              <input
                aria-label={`Pieces: ${l.label}`}
                type="number"
                inputMode="numeric"
                min={1}
                value={Number.isFinite(l.quantity) ? l.quantity : ""}
                onChange={(e) => set(i, { quantity: Number(e.target.value) })}
                className={`${field} w-24`}
              />
            </div>
            <p className="mt-2 font-mono text-xs text-[var(--muted)]">
              {l.tier
                ? `${l.quantity} × ${formatRand(l.unitCents)} + ${formatRand(l.setupCents)} set-up = `
                : "Enter at least 1 piece"}
              {l.tier && <strong className="text-[var(--fg)]">{formatRand(l.totalCents)}</strong>}
            </p>
          </li>
        ))}
      </ul>

      <dl className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-[var(--line)] p-3 text-sm">
        <dt className="text-[var(--muted)]">Pieces</dt>
        <dd className="text-right font-mono">{q.pieces}</dd>
        <dt className="text-[var(--muted)]">Printing</dt>
        <dd className="text-right font-mono">{formatRand(q.printCents)}</dd>
        <dt className="text-[var(--muted)]">
          Set-up ({q.lines.filter((l) => l.tier).length} × R450)
        </dt>
        <dd className="text-right font-mono">{formatRand(q.setupCents)}</dd>
        <dt className="font-bold">Estimate</dt>
        <dd className="text-right font-mono text-lg font-bold">{formatRand(q.totalCents)}</dd>
      </dl>

      {q.checks.length > 0 && (
        <ul role="note" className="border-coral mt-3 space-y-1 rounded-2xl border-2 p-3 text-sm">
          {q.checks.map((c) => (
            <li key={c}>Confirm with Masumpa: {c}</li>
          ))}
        </ul>
      )}

      <a
        href={quoteRequestUrl(
          q.lines.filter((l) => l.tier),
          others,
        )}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-gold text-onyx mt-4 inline-flex min-h-14 w-full items-center justify-center rounded-full px-6 text-center font-bold"
      >
        Request this quote from Masumpa on WhatsApp
      </a>
      <p className="mt-2 text-xs text-[var(--muted)]">
        An estimate from the {MASUMPA.source}. Masumpa&rsquo;s own quote is the real price.
      </p>
    </div>
  );
}
