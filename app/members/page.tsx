import Link from "next/link";
import { SubmitButton } from "@/src/components/submit-button";
import { buttonGhost, buttonPrimary, TeamHeader } from "@/src/components/team-ui";
import { getDb } from "@/src/db/server";
import { requireMember } from "@/src/lib/auth/session";
import { fill, getMessages } from "@/src/lib/messages";
import {
  adminPicksWindowOpen,
  currentRound,
  myRoundState,
  roundProgress,
} from "@/src/lib/team-round";
import { signOutAction } from "./actions";

const t = getMessages();
const r = t.round;

export const metadata = { title: t.auth.eyebrow };

export default async function MembersHome() {
  const me = await requireMember();
  const db = getDb()!;
  const round = await currentRound(db);
  const mine = round ? await myRoundState(db, round.id, me.id) : null;
  const adminWindow =
    round?.status === "published" &&
    mine?.role === "curator" &&
    !mine.submittedAt &&
    (await adminPicksWindowOpen(db, round.id));
  const progress = round ? await roundProgress(db, round.id) : null;

  return (
    <>
      <TeamHeader />
      <p className="mt-10 font-mono text-xs tracking-[0.3em] text-[var(--accent)] uppercase">
        {t.auth.eyebrow}
      </p>
      <h1 className="font-youth mt-3 text-4xl leading-tight">
        {fill(t.auth.membersHello, { name: me.name })}
      </h1>

      <section className="mt-8 rounded-3xl border border-[var(--line)] bg-[var(--card)] p-5">
        <p className="font-mono text-xs tracking-[0.2em] text-[var(--muted)] uppercase">
          {round?.title ?? r.adminTitle} ·{" "}
          {round ? r.statusLabel[round.status as keyof typeof r.statusLabel] : r.statusLabel.draft}
        </p>
        <RoundCard
          status={adminWindow ? "open" : (round?.status ?? "draft")}
          n={round?.picksPerMember ?? 6}
          mine={mine}
          progress={progress}
        />
      </section>

      <div className="mt-6 flex flex-col gap-3">
        <Link href="/designs" className={`${buttonGhost} w-full`}>
          {r.browse}
        </Link>
        {me.role === "admin" && (
          <Link href="/admin" className={`${buttonGhost} w-full`}>
            {t.auth.toAdmin}
          </Link>
        )}
        <form action={signOutAction}>
          <SubmitButton className={`${buttonGhost} w-full`} pending="…">
            {t.auth.signOut}
          </SubmitButton>
        </form>
      </div>
    </>
  );
}

function RoundCard({
  status,
  n,
  mine,
  progress,
}: {
  status: string;
  n: number;
  mine: Awaited<ReturnType<typeof myRoundState>> | null;
  progress: { invited: number; submitted: number } | null;
}) {
  const p = (text: string) => <p className="mt-2 text-[var(--muted)]">{text}</p>;
  if (status === "draft") return p(r.homeDraft);
  if (status === "closed" || status === "published") {
    return (
      <>
        {p(r.homeClosed)}
        <Link href="/members/results" className={`${buttonPrimary} mt-4`}>
          {r.homeResults}
        </Link>
      </>
    );
  }
  if (!mine?.inRound) return p(r.homeNotInRound);
  if (mine.submittedAt) {
    return (
      <>
        <p className="text-lime-700 dark:text-lime mt-2 font-bold">✓ {r.homeSubmitted}</p>
        {progress && p(fill(r.homeWaiting, progress))}
      </>
    );
  }
  if (mine.role === "curator") {
    return (
      <>
        {p(r.curatorHome)}
        <Link href="/members/picks" className={`${buttonPrimary} mt-4`}>
          {fill(r.curatorCta, { count: mine.designIds.length })}
        </Link>
      </>
    );
  }
  return (
    <>
      {p(fill(r.homeOpen, { n }))}
      <Link href="/members/picks" className={`${buttonPrimary} mt-4`}>
        {mine.designIds.length
          ? fill(r.homeContinue, { count: mine.designIds.length, n })
          : fill(r.homeCta, { n })}
      </Link>
    </>
  );
}
