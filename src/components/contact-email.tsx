import { fill, getMessages } from "@/src/lib/messages";
import { CONTACT_EMAIL, CONTACT_WHATSAPP, whatsappChatUrl } from "@/src/lib/site";

const t = getMessages();

/** How to reach 18 G-TAS: the WhatsApp line, plus an email address once one is set. */
export function ContactEmail() {
  return (
    <>
      <a href={whatsappChatUrl()} target="_blank" rel="noopener noreferrer">
        {fill(t.legal.whatsapp, { number: CONTACT_WHATSAPP })}
      </a>
      {CONTACT_EMAIL && (
        <>
          {" or "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </>
      )}
    </>
  );
}
