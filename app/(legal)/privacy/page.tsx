import { ContactEmail } from "@/src/components/contact-email";
import { getMessages } from "@/src/lib/messages";
import { INFORMATION_OFFICER, LEGAL_NAME_FULL } from "@/src/lib/site";

const t = getMessages();

export const metadata = { title: t.legal.privacy };

// Plain-language privacy notice under POPIA (Act 4 of 2013). TO BE REVIEWED by a legal adviser.
export default function Privacy() {
  return (
    <>
      <h1>Privacy &amp; POPIA</h1>
      <p>
        This notice explains what {LEGAL_NAME_FULL} (&ldquo;we&rdquo;) collects on this site, why,
        and what you can ask us to do with it, under the Protection of Personal Information Act
        (POPIA).
      </p>

      <h2 id="who">Who is responsible</h2>
      <p>
        The responsible party is {LEGAL_NAME_FULL}, KwaZulu-Natal, South Africa. Information
        officer: <strong>{INFORMATION_OFFICER}</strong>. Contact: <ContactEmail />.
      </p>

      <h2 id="data">Data we collect</h2>
      <p>
        <strong>When you vote.</strong> Voting works without any personal information. To keep it
        fair we store:
      </p>
      <ul>
        <li>
          a scrambled (hashed) code for your device and one for your network. We cannot turn these
          back into your IP address or device;
        </li>
        <li>your swipes and your vote;</li>
        <li>
          the share link you came from (for example &ldquo;fb&rdquo; or a WhatsApp group code), so
          we know which channels brought votes;
        </li>
        <li>
          only if you choose to tell us: your age bracket, province, and school or area. These are
          optional and anonymous.
        </li>
      </ul>
      <p>
        <strong>From anyone under 18, we never collect</strong> names, email addresses or phone
        numbers. An email sign-in option, if we ever switch it on, is only offered after you confirm
        you are 18 or older.
      </p>
      <p>
        <strong>Team members and admins.</strong> We store your name and email address so we can
        send you sign-in links, and the designs you pick and rank.
      </p>

      <h2 id="why">Why we use it</h2>
      <ul>
        <li>to allow one vote per device per round and stop automated voting;</li>
        <li>to understand which designs different age groups, areas and channels like;</li>
        <li>to decide which designs we produce.</li>
      </ul>
      <p>
        We rely on your consent for the optional details, and on our legitimate interest in a fair
        vote for the hashed codes. We do not sell your information or use it for advertising.
      </p>

      <h2 id="children">Children</h2>
      <p>
        Many voters are under 18. The vote is designed to work with no personal information, so we
        do not need, and do not ask for, a parent&rsquo;s or guardian&rsquo;s consent to collect
        any.
      </p>

      <h2 id="storage">Where it is stored</h2>
      <p>
        The site runs on Vercel. The database is hosted by Neon in the United States, and design
        images are stored with Vercel Blob. Storing data outside South Africa is a cross-border
        transfer under section 72 of POPIA; these providers protect it under their data-processing
        terms, and what we send them is kept to the minimum above.
      </p>

      <h2 id="retention">How long we keep it</h2>
      <p>
        Individual votes and swipes are deleted 90 days after a round&rsquo;s results are published.
        After that we keep only totals (for example, &ldquo;Kasi Halo: 312 votes from 16&ndash;17
        year olds in KZN&rdquo;). Team members&rsquo; details are kept while they are on the team
        and deleted on request.
      </p>

      <h2 id="cookies">Cookies</h2>
      <p>
        We use <strong>one functional cookie</strong>. It remembers that this device has voted in
        the current round, so you are not asked twice. It is signed so it cannot be faked, and it
        holds no personal information. We use no advertising or tracking cookies. If we count page
        visits, we use cookie-free analytics.
      </p>

      <h2 id="security">Security</h2>
      <p>
        Device and network codes are hashed with a secret key. All connections are encrypted, and
        only our admins can see the voting data.
      </p>

      <h2 id="rights">Your rights</h2>
      <p>
        You may ask what we hold about you, ask us to correct or delete it, or object to how we use
        it. Because voting is anonymous, we usually hold nothing that identifies a voter. You may
        also complain to the Information Regulator of South Africa (
        <a href="https://inforegulator.org.za" rel="noopener noreferrer" target="_blank">
          inforegulator.org.za
        </a>
        ). Our PAIA manual is available on request.
      </p>

      <h2 id="contact">Contact us</h2>
      <p>
        For privacy questions or requests: <ContactEmail />.
      </p>
    </>
  );
}
