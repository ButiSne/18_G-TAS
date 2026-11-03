import { getMessages } from "@/src/lib/messages";

const t = getMessages();

// Not linked from the footer: there is no prize draw. Link it again only when the admin
// turns on the competition flag (public_round.competition), and get the rules checked first.
export const metadata = { title: t.legal.rules, robots: { index: false } };

export default function Rules() {
  return (
    <>
      <h1>Competition rules</h1>
      <p>
        There is no prize draw at present, so voting is not a promotional competition. If 18 G-TAS
        adds a prize, it becomes a promotional competition under the Consumer Protection Act, and
        the rules here must be written and checked before launch.
      </p>
    </>
  );
}
