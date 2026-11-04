import Link from "next/link";
import { SwipeDeck } from "@/src/components/swipe-deck";
import { getDb } from "@/src/db/server";
import { seededShuffle } from "@/src/lib/catalogue";
import { getMessages } from "@/src/lib/messages";
import { currentPublicRound, publicEntries } from "@/src/lib/stages";
import { normaliseRef } from "@/src/lib/tally";
import { readVoterCookie, voteSecrets } from "@/src/lib/vote-session";
import { isVerified, saltedHash } from "@/src/lib/voter";
import { voterState } from "@/src/lib/voting";
import { SHARE_IMAGE, whatsappShareUrl } from "@/src/lib/site";

const t = getMessages();
const v = t.vote;

// A page's openGraph replaces the layout's whole object, so the share card is repeated
// here: /vote?ref=… is the link shared most on WhatsApp.
export const metadata = {
  title: "Vote",
  description: t.site.tagline,
  openGraph: {
    title: `${t.site.title}: vote YEBO or CHA`,
    description: v.introBody,
    siteName: t.site.name,
    locale: "en_ZA",
    type: "website",
    images: [
      {
        url: SHARE_IMAGE.path,
        width: SHARE_IMAGE.width,
        height: SHARE_IMAGE.height,
        type: "image/jpeg",
        alt: SHARE_IMAGE.alt,
      },
    ],
  },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Vote({ searchParams }: Props) {
  const params = await searchParams;
  const refCode = normaliseRef(Array.isArray(params.ref) ? params.ref[0] : params.ref);
  const db = getDb();
  const pr = db ? await currentPublicRound(db) : null;

  if (!pr || pr.status === "draft") {
    return (
      <Notice title={v.soonTitle} body={v.soonBody} share={whatsappShareUrl(t.home.shareText)} />
    );
  }
  if (pr.status !== "open") {
    const showResults = pr.status === "published" || pr.showLiveResults;
    return <Notice title={v.closedTitle} body={v.closedBody} results={showResults} />;
  }

  const cards = await publicEntries(db!, pr.id);
  const secrets = voteSecrets();
  const voter = secrets ? await readVoterCookie(secrets.secret) : null;
  let initial = {
    started: false,
    order: [] as string[],
    swipes: [] as { entryId: string; liked: boolean }[],
    numberOne: null as string | null,
  };
  if (secrets && voter && isVerified(voter, new Date())) {
    // A returning phone resumes where it left off, in the same order.
    const deviceHash = saltedHash(voter.d, secrets.salt);
    const state = await voterState(db!, { publicRoundId: pr.id, deviceHash });
    const order = seededShuffle(
      cards.map((c) => c.entryId),
      deviceHash.slice(0, 12),
    );
    initial = { started: true, order, ...state };
  }

  return (
    <SwipeDeck
      cards={cards}
      siteKey={process.env.TURNSTILE_SITE_KEY ?? null}
      refCode={refCode}
      initial={initial}
    />
  );
}

function Notice({
  title,
  body,
  share,
  results,
}: {
  title: string;
  body: string;
  share?: string;
  results?: boolean;
}) {
  return (
    <section className="surface-dark flex min-h-[80svh] flex-col px-4 pt-6 pb-10">
      <Link href="/" className="font-numerals text-sm tracking-[0.3em] text-[var(--accent)]">
        18 G-TAS
      </Link>
      <div className="mx-auto mt-auto w-full max-w-md">
        <h1 className="font-youth text-5xl leading-[0.95]">{title}</h1>
        <p className="mt-4 text-lg text-ivory/85">{body}</p>
        {share && (
          <a
            href={share}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gold text-onyx mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-full px-6 font-bold"
          >
            {t.home.ctaShare}
          </a>
        )}
        {results && (
          <Link
            href="/results"
            className="bg-gold text-onyx mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-full px-6 font-bold"
          >
            {v.seeResults}
          </Link>
        )}
      </div>
    </section>
  );
}
