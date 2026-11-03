import Link from "next/link";
import { SubmitButton } from "@/src/components/submit-button";
import { buttonGhost, buttonPrimary, TeamHeader } from "@/src/components/team-ui";
import { requireMember } from "@/src/lib/auth/session";
import { fill, getMessages } from "@/src/lib/messages";
import { signOutAction } from "./actions";

const t = getMessages();

export const metadata = { title: t.auth.eyebrow };

export default async function MembersHome() {
  const me = await requireMember();
  return (
    <>
      <TeamHeader />
      <p className="mt-10 font-mono text-xs tracking-[0.3em] text-[var(--accent)] uppercase">
        {t.auth.eyebrow}
      </p>
      <h1 className="font-youth mt-3 text-4xl leading-tight">
        {fill(t.auth.membersHello, { name: me.name })}
      </h1>
      <p className="mt-4 text-[var(--muted)]">{t.auth.membersBody}</p>
      <div className="mt-8 flex flex-col gap-3">
        {me.role === "admin" && (
          <Link href="/admin" className={buttonPrimary}>
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
