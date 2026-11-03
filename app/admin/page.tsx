import Link from "next/link";
import { SubmitButton } from "@/src/components/submit-button";
import { buttonGhost, TeamHeader } from "@/src/components/team-ui";
import { getDb } from "@/src/db/server";
import { requireAdmin } from "@/src/lib/auth/session";
import { teamOverview } from "@/src/lib/auth/store";
import { formatSATime } from "@/src/lib/format";
import { fill, getMessages } from "@/src/lib/messages";
import { revokeSessionsAction } from "./actions";
import { InviteButton } from "./invite-button";

const t = getMessages();

export const metadata = { title: t.auth.adminTitle, robots: { index: false, follow: false } };

export default async function Admin() {
  const me = await requireAdmin();
  const team = await teamOverview(getDb()!, new Date());

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-14">
      <TeamHeader />
      <h1 className="font-luxe mt-10 text-4xl">{t.auth.adminTitle}</h1>
      <p className="mt-3 text-[var(--muted)]">{t.auth.adminLead}</p>

      <h2 className="font-youth mt-10 text-2xl">{t.auth.teamTitle}</h2>
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
