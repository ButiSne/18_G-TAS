import { getMessages } from "@/src/lib/messages";

const t = getMessages();

export const metadata = { title: "Privacy · 18 G-TAS" };

export default function Privacy() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-12">
      <p className="rounded border-2 border-coral p-3 font-mono text-sm font-bold">
        {t.legal.toBeReviewed}
      </p>
      <h1 className="font-luxe mt-8 text-4xl">Privacy notice</h1>
      <div className="mt-6 space-y-4 text-[var(--muted)]">
        <p>
          <strong className="text-[var(--fg)]">What we collect.</strong> To keep voting fair we
          store a scrambled (hashed) code for your device and network. We cannot turn it back into
          your IP address or device. If you choose to, you can tell us your age bracket, province
          and school or area. All of these are optional, and voting works without them.
        </p>
        <p>
          <strong className="text-[var(--fg)]">What we never collect from under-18s.</strong> Names,
          email addresses or phone numbers.
        </p>
        <p>
          <strong className="text-[var(--fg)]">Why.</strong> So each device votes once per round,
          and so we can see which designs different age groups and areas like.
        </p>
        <p>
          <strong className="text-[var(--fg)]">How long.</strong> Individual votes are deleted 90
          days after the results are published. We keep only the totals.
        </p>
        <p>
          <strong className="text-[var(--fg)]">Cookies.</strong> One functional cookie that
          remembers you have voted. No advertising trackers.
        </p>
        <p>
          <strong className="text-[var(--fg)]">Contact.</strong> privacy@[TO BE CONFIRMED]
        </p>
      </div>
    </article>
  );
}
