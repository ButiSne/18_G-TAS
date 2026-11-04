import { SubmitButton } from "@/src/components/submit-button";
import { buttonPrimary, TeamHeader } from "@/src/components/team-ui";
import { getDb } from "@/src/db/server";
import { peekInvite } from "@/src/lib/auth/store";
import { looksLikeToken } from "@/src/lib/auth/tokens";
import { fill, getMessages } from "@/src/lib/messages";
import { whatsappChatUrl } from "@/src/lib/site";
import { redeemAction } from "./actions";

const t = getMessages();

// The token is in the URL: never send it on to another site in a Referer header.
export const metadata = { title: t.auth.signinTitle, referrer: "no-referrer" as const };

export default async function Join({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const slow = (await searchParams).slow === "1";
  const db = getDb();
  const invite =
    db && looksLikeToken(token) ? await peekInvite(db, token, new Date()) : { state: "unknown" };

  if (invite.state !== "valid") {
    return (
      <>
        <TeamHeader />
        <h1 className="font-luxe mt-10 text-4xl">{t.auth.joinInvalidTitle}</h1>
        <p className="mt-4 text-[var(--muted)]">{t.auth.joinInvalidBody}</p>
        <a
          href={whatsappChatUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className={`${buttonPrimary} mt-8`}
        >
          {t.auth.askAdmin}
        </a>
      </>
    );
  }

  return (
    <>
      <TeamHeader />
      <p className="mt-10 font-mono text-xs tracking-[0.3em] text-[var(--accent)] uppercase">
        {t.auth.eyebrow}
      </p>
      <h1 className="font-youth mt-3 text-4xl leading-tight">
        {fill(t.auth.joinHello, { name: "name" in invite ? (invite.name ?? "") : "" })}
      </h1>
      <p className="mt-4 text-[var(--muted)]">{t.auth.joinBody}</p>
      {slow && (
        <p role="alert" className="text-coral mt-4 text-sm">
          {t.auth.slow}
        </p>
      )}
      <form action={redeemAction.bind(null, token)} className="mt-8">
        <SubmitButton className={buttonPrimary} pending={t.auth.joinWorking}>
          {t.auth.joinButton}
        </SubmitButton>
      </form>
    </>
  );
}
