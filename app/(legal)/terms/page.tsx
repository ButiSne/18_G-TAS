import Link from "next/link";
import { ContactEmail } from "@/src/components/contact-email";
import { getMessages } from "@/src/lib/messages";
import { LEGAL_NAME } from "@/src/lib/site";

const t = getMessages();

export const metadata = { title: t.legal.terms };

// Terms of use. TO BE REVIEWED by a legal adviser, including against the Consumer
// Protection Act and the Electronic Communications and Transactions Act.
export default function Terms() {
  return (
    <>
      <h1>Terms of use</h1>
      <p>
        These terms apply when you use this site, run by {LEGAL_NAME} (&ldquo;18 G-TAS&rdquo;). By
        using it you agree to them. If you are under 18, please read them with a parent or guardian.
      </p>

      <h2 id="vote">The vote</h2>
      <ul>
        <li>Voting is free. You do not need to buy anything or create an account.</li>
        <li>Each device may vote once per round.</li>
        <li>
          Do not use bots, scripts, several devices or any other trick to add votes. We may remove
          votes that break these rules, without notice.
        </li>
        <li>
          The results guide our decisions, but the final choice of which designs we produce is ours.
          Voting does not promise that any design will be made or sold.
        </li>
      </ul>

      <h2 id="no-prize">No prize</h2>
      <p>
        Voting is not a competition and there is no prize. If we ever add one, separate competition
        rules will apply and will be published before it starts.
      </p>

      <h2 id="designs">The designs</h2>
      <p>
        Every design shown here belongs to 18 G-TAS, and many are unreleased. See{" "}
        <Link href="/copyright">Copyright &amp; design rights</Link> for what you may and may not do
        with them.
      </p>

      <h2 id="use">Using the site fairly</h2>
      <p>
        Do not try to break, overload, copy or scrape the site, get into areas meant for the team,
        or pretend to be 18 G-TAS or a team member.
      </p>

      <h2 id="privacy">Your privacy</h2>
      <p>
        How we handle information is set out in our <Link href="/privacy">privacy notice</Link>.
      </p>

      <h2 id="changes">Changes and availability</h2>
      <p>
        We may change, pause or end the site or a voting round, and we may update these terms. The
        date at the bottom shows the latest version.
      </p>

      <h2 id="liability">Liability</h2>
      <p>
        The site is provided as it is. To the extent the law allows, including the Consumer
        Protection Act, 18 G-TAS is not liable for loss arising from using it. Nothing in these
        terms limits rights you have under South African law.
      </p>

      <h2 id="law">Law</h2>
      <p>These terms are governed by the laws of the Republic of South Africa.</p>

      <h2 id="contact">Contact</h2>
      <p>
        Questions about these terms: <ContactEmail />.
      </p>
    </>
  );
}
