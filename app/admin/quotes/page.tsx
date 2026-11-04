import Link from "next/link";
import { QuoteEstimator } from "@/src/components/quote-estimator";
import { TeamHeader } from "@/src/components/team-ui";
import { getDb } from "@/src/db/server";
import { requireAdmin } from "@/src/lib/auth/session";
import { getMessages } from "@/src/lib/messages";
import { isPrintMethod, PRINT_METHOD_LABELS } from "@/src/lib/print-methods";
import { formatRand, MASUMPA } from "@/src/lib/printers";
import { currentPublicRound, productionHandoff } from "@/src/lib/stages";

const t = getMessages();

export const metadata = { title: "Print quotes" };

/**
 * The print partner and its prices (Stage 3: the final ten go to print). Once the final ten
 * are saved, the estimate starts from their sublimation designs; before that it is a plain
 * calculator.
 */
export default async function Quotes() {
  await requireAdmin();
  const db = getDb()!;
  const pr = await currentPublicRound(db);
  const finalTen = pr ? await productionHandoff(db, pr.id) : [];
  const label = (m: string | null) => (isPrintMethod(m) ? PRINT_METHOD_LABELS[m] : (m ?? "?"));
  const sublimation = finalTen.filter((h) => h.slot === "sublimation");
  const others = finalTen
    .filter((h) => h.slot !== "sublimation")
    .map((h) => ({ label: h.title, method: label(h.printMethod) }));

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-14">
      <TeamHeader />
      <Link
        href="/admin"
        className="mt-4 inline-flex min-h-11 items-center text-sm text-[var(--muted)]"
      >
        ← {t.auth.adminTitle}
      </Link>
      <h1 className="font-luxe mt-2 text-4xl">Print quotes</h1>

      <section className="mt-6 rounded-3xl border border-[var(--line)] bg-[var(--card)] p-5">
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--accent)] uppercase">
          Print partner · {MASUMPA.method}
        </p>
        <h2 className="font-youth mt-1 text-2xl">{MASUMPA.name}</h2>
        <ul className="mt-3 space-y-1 text-sm">
          <li>
            WhatsApp or call:{" "}
            <a
              href={`https://wa.me/${MASUMPA.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {MASUMPA.phone}
            </a>
          </li>
          <li>
            Email:{" "}
            <a href={`mailto:${MASUMPA.email}`} className="underline">
              {MASUMPA.email}
            </a>
          </li>
          <li>
            Website:{" "}
            <a
              href={MASUMPA.website}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              masumpa.co.za
            </a>
          </li>
        </ul>
      </section>

      <h2 className="font-youth mt-10 text-2xl">
        {sublimation.length ? "Quote the final ten" : "Estimate a print run"}
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {sublimation.length
          ? `The ${sublimation.length} sublimation designs from the final ten. Masumpa's flyers price sublimation only; the other ${others.length} go in the WhatsApp request as "please also quote".`
          : "The final ten aren't chosen yet. Set how many designs and pieces to see a ballpark; once the final ten are saved, this lists them."}
      </p>
      <div className="mt-4">
        <QuoteEstimator designs={sublimation.map((h) => ({ label: h.title }))} others={others} />
      </div>

      <h2 className="font-youth mt-10 text-2xl">Price list</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {MASUMPA.source}. Once-off set-up: {formatRand(45_000)} per design.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {MASUMPA.priceLists.map((list) => (
          <table
            key={list.product}
            className="w-full overflow-hidden rounded-2xl border border-[var(--line)] text-sm"
          >
            <caption className="bg-[var(--card)] p-2 text-left font-bold">{list.label}</caption>
            <thead>
              <tr className="text-left text-[var(--muted)]">
                <th className="px-3 py-1 font-normal">Quantity</th>
                <th className="px-3 py-1 text-right font-normal">Each</th>
              </tr>
            </thead>
            <tbody>
              {list.tiers.map((tier) => (
                <tr key={tier.min} className="border-t border-[var(--line)]">
                  <td className="px-3 py-1.5">
                    {tier.max === null
                      ? `${tier.min.toLocaleString("en-ZA")}+`
                      : `${tier.min.toLocaleString("en-ZA")}–${tier.max.toLocaleString("en-ZA")}`}
                    {tier.check && <span className="text-coral block text-xs">{tier.check}</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">{formatRand(tier.cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
        {MASUMPA.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}
