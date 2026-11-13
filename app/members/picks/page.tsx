import { redirect } from "next/navigation";
import { PicksBoard } from "@/src/components/picks-board";
import { TeamHeader } from "@/src/components/team-ui";
import { getDb } from "@/src/db/server";
import { requireMember } from "@/src/lib/auth/session";
import { loadCatalogue } from "@/src/lib/catalogue";
import { fill, getMessages } from "@/src/lib/messages";
import { currentRound, myRoundState } from "@/src/lib/team-round";

const t = getMessages();

export const metadata = { title: t.round.title };

export default async function Picks() {
  const me = await requireMember();
  const db = getDb()!;
  const round = await currentRound(db);
  if (!round || round.status !== "open") redirect("/members");
  const mine = await myRoundState(db, round.id, me.id);
  if (!mine.inRound) redirect("/members");
  const designs = await loadCatalogue(db);

  return (
    <div className="-mx-4 px-4">
      <TeamHeader />
      <h1 className="font-luxe mt-8 text-4xl">
        {mine.role === "curator" ? t.round.curatorTitle : t.round.title}
      </h1>
      <p className="mt-2 text-[var(--muted)]">
        {mine.role === "curator"
          ? t.round.curatorHome
          : fill(t.round.homeOpen, { n: round.picksPerMember })}
      </p>
      <PicksBoard
        designs={designs}
        roundId={round.id}
        picksPerMember={round.picksPerMember}
        initial={mine.designIds}
        initialNotes={mine.notes}
        initialSuggestion={mine.suggestion}
        locked={Boolean(mine.submittedAt)}
        unlimited={mine.role === "curator"}
      />
    </div>
  );
}
