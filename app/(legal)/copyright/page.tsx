import { ContactEmail } from "@/src/components/contact-email";
import { getMessages } from "@/src/lib/messages";
import { LEGAL_NAME } from "@/src/lib/site";

const t = getMessages();

export const metadata = { title: t.legal.copyright };

// Copyright, design rights and brand marks. TO BE REVIEWED by a legal adviser.
export default function Copyright() {
  return (
    <>
      <h1>Copyright &amp; design rights</h1>
      <p>
        &copy; {new Date().getFullYear()} {LEGAL_NAME}. All rights reserved.
      </p>

      <h2 id="ours">What belongs to 18 G-TAS</h2>
      <p>
        Every design, artwork, mockup and photograph on this site, and the brand marks below, belong
        to 18 G-TAS and are protected by copyright and, where registered, by design and trade mark
        law:
      </p>
      <ul>
        <li>the 18 mark, the linked logo and the pennant triangle;</li>
        <li>the names and wordmarks EITEEN, G-TAS and XVIII · G-TAS;</li>
        <li>all t-shirt designs, including those not yet released.</li>
      </ul>

      <h2 id="unreleased">Unreleased designs</h2>
      <p>
        Many designs here are shown before release, only so you can vote on them. Showing them to
        you does not give anyone a right to use them. Team members see designs in confidence and
        must not share them outside the team before release.
      </p>

      <h2 id="may">What you may do</h2>
      <ul>
        <li>view the designs and vote;</li>
        <li>
          share links to this site and the share images we provide, on WhatsApp, Facebook,
          Instagram, X or elsewhere.
        </li>
      </ul>

      <h2 id="may-not">What you may not do</h2>
      <ul>
        <li>copy, download, screenshot for reuse, trace or edit the designs;</li>
        <li>print them on clothing or anything else, or sell them;</li>
        <li>use our names or marks on your own products;</li>
        <li>use the designs to train, prompt or test AI models, or put them in datasets;</li>
        <li>remove or hide our name or marks from anything we share.</li>
      </ul>

      <h2 id="affiliation">No affiliation</h2>
      <p>
        18 G-TAS is not affiliated with, endorsed by or sponsored by any football club, federation,
        kit maker or fashion brand. Our designs use our own names.
      </p>

      <h2 id="report">Report a copy or a fake</h2>
      <p>
        If you see our designs or marks used without permission, or a fake 18 G-TAS product, please
        tell us: <ContactEmail />.
      </p>
    </>
  );
}
