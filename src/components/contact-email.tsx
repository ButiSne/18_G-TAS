import { getMessages } from "@/src/lib/messages";
import { CONTACT_EMAIL } from "@/src/lib/site";

const t = getMessages();

/** The public contact address, or a clear "to be confirmed" until the owner sets it. */
export function ContactEmail() {
  if (!CONTACT_EMAIL) return <strong>[{t.legal.contactPending}]</strong>;
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
}
