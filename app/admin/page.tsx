import Link from "next/link";
import { SubmitButton } from "@/src/components/submit-button";
import { buttonGhost, TeamHeader } from "@/src/components/team-ui";
import { getDb } from "@/src/db/server";
import { requireAdmin } from "@/src/lib/auth/session";
import { teamOverview } from "@/src/lib/auth/store";
import { formatSATime } from "@/src/lib/format";
import { fill, getMessages } from "@/src/lib/messages";
import { adminRoundOverview, currentRound } from "@/src/lib/team-round";
import { closeRoundAction, revokeSessionsAction, unlockMemberAction } from "./actions";
import { InviteButton } from "./invite-button";
import { OpenRoundForm } from "./open-round-form";

const t = getMessages();
const r = t.round;

export const metadata = { title: t.auth.adminTitle, robots: { index: false, follow: false } };

export default async function Admin() {
  const me = await requireAdmin();
  const db = getDb()!;
  const team = await teamOverview(db, new Date());
  const round = await currentRound(db);
  const roster = round && round.status !== "draft" ? await adminRoundOverview(db, round.id) : [];

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-14">
      <TeamHeader />
      <h1 className="font-luxe mt-10 text-4xl">{t.auth.adminTitle}</h1>

      {round && (
        <section className="mt-8 rounded-3xl border border-[var(--line)] bg-[var(--card)] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-youth text-2xl">{r.adminTitle}</h2>
            <span className="rounded-full border border-[var(--line)] px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase">
              {r.statusLabel[round.status]}
            </span>
          </div>
          {round.status === "draft" && (
            <>
              <p className="mt-2 text-sm text-[var(--muted)]">{r.adminDraft}</p>
              <OpenRoundForm
                roundId={round.id}
                picksPerMember={round.picksPerMember}
                shortlistSize={round.shortlistSize}
                people={team.map((p) => ({ id: p.id, name: p.name, role: p.role }))}
              />
            </>
          )}
          {round.status !== "draft" && (
            <ul className="mt-4 space-y-2">
              {roster.map((m) => (
                <li key={m.memberId} className="flex min-h-11 items-center gap-3">
                  <span className="flex-1">{m.name}</span>
                  <span className="font-mono text-xs text-[var(--muted)]">
                    {m.submittedAt
                      ? `✓ ${r.statusSubmitted}`
                      : fill(r.statusPicking, { count: m.picks, n: round.picksPerMember })}
                  </span>
                  {m.submittedAt && round.status === "open" && (
                    <form action={unlockMemberAction.bind(null, round.id, m.memberId)}>
                      <SubmitButton className={buttonGhost} pending="…">
                        {r.unlock}
                      </SubmitButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {round.status === "open" && (
            <form action={closeRoundAction.bind(null, round.id)} className="mt-4">
              <SubmitButton className={`${buttonGhost} w-full`} pending="…">
                {r.closeNow}
              </SubmitButton>
            </form>
          )}
          {(round.status === "closed" || round.status === "published") && (
            <>
              <p className="mt-4 text-sm text-[var(--muted)]">{r.adminClosed}</p>
              <Link href="/members/results" className={`${buttonGhost} mt-3 w-full`}>
                {r.homeResults}
              </Link>
            </>
          )}
        </section>
      )}

      <h2 className="font-youth mt-10 text-2xl">{t.auth.teamTitle}</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">{t.auth.adminLead}</p>
      <ul className="mt-4 space-y-3">
        {team.map((p) => (
          <li key={p.id} className="rounded-3xl border border-[var(--line)] bg-[var(--card)] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold">{p.name}</p>
              <span className="rounded-full border border-[var(--line)] px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase">
                {p.role === "admin" ? t.auth.roleAdmin : t.auth.roleMember}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {p.activeSessions > 0
                ? fill(t.auth.statusSignedIn, { count: p.activeSessions })
                : p.inviteExpiresAt
                  ? fill(t.auth.statusInvited, { time: formatSATime(p.inviteExpiresAt) })
                  : t.auth.statusNone}
            </p>
            {p.id !== me.id && (
              <InviteButton memberId={p.id} hasInvite={Boolean(p.inviteExpiresAt)} />
            )}
            {p.activeSessions > 0 && p.id !== me.id && (
              <form action={revokeSessionsAction.bind(null, p.id)}>
                <SubmitButton className={`${buttonGhost} mt-2 w-full`} pending="…">
                  {t.auth.revoke}
                </SubmitButton>
              </form>
            )}
          </li>
        ))}
      </ul>

      <Link href="/members" className={`${buttonGhost} mt-10 w-full`}>
        ← {t.auth.eyebrow}
      </Link>
    </div>
  );
}
