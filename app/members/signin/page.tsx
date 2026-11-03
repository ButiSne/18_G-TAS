import { buttonPrimary, TeamHeader } from "@/src/components/team-ui";
import { getMessages } from "@/src/lib/messages";
import { whatsappChatUrl } from "@/src/lib/site";

const t = getMessages();

export const metadata = { title: t.auth.signinTitle };

export default function SignIn() {
  return (
    <>
      <TeamHeader />
      <h1 className="font-luxe mt-10 text-4xl">{t.auth.signinTitle}</h1>
      <p className="mt-4 text-[var(--muted)]">{t.auth.signinBody}</p>
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
