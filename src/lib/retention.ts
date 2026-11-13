// Data retention (brief §6, privacy notice): 90 days after a round's results are published,
// raw per-device rows are deleted and only totals are kept. Run daily by Vercel Cron.
// For each such round, in one transaction:
//   1. freeze the results as a snapshot on the round (so /results keeps working),
//   2. roll swipes into swipe_aggregate and number-one votes into vote_aggregate,
//   3. delete the raw swipe, vote, matchup and ballot rows (ballots hold hashes too).

import { and, eq, isNull, lt, sql } from "drizzle-orm";
import type { createDb } from "../db/client.ts";
import { ballot, matchup, publicRound, swipe, vote } from "../db/schema.ts";
import { audit } from "./audit.ts";
import { sweepRateLimits } from "./rate-limit.ts";
import { publicResults } from "./stages.ts";

type Db = ReturnType<typeof createDb>;

export const RETENTION_DAYS = 90;

export type RetentionReport = {
  rounds: number;
  swipesDeleted: number;
  votesDeleted: number;
  rateLimitRowsSwept: number;
};

export async function runRetention(db: Db, now: Date): Promise<RetentionReport> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60_000);
  const due = await db
    .select({ id: publicRound.id, snapshot: publicRound.resultsSnapshot })
    .from(publicRound)
    .where(and(eq(publicRound.status, "published"), lt(publicRound.publishedAt, cutoff)));

  const report: RetentionReport = {
    rounds: 0,
    swipesDeleted: 0,
    votesDeleted: 0,
    rateLimitRowsSwept: 0,
  };
  for (const round of due) {
    const snapshot = round.snapshot ?? (await publicResults(db, round.id));
    await db.transaction(async (tx) => {
      await tx
        .update(publicRound)
        .set({ resultsSnapshot: snapshot })
        .where(and(eq(publicRound.id, round.id), isNull(publicRound.resultsSnapshot)));
      await tx.execute(sql`
        insert into swipe_aggregate (public_round_id, entry_id, ref, age_bracket, province, likes, passes)
        select public_round_id, entry_id, ref, age_bracket, province,
               count(*) filter (where liked), count(*) filter (where not liked)
        from swipe where public_round_id = ${round.id}
        group by public_round_id, entry_id, ref, age_bracket, province
        on conflict on constraint swipe_aggregate_cell do update
          set likes = swipe_aggregate.likes + excluded.likes,
              passes = swipe_aggregate.passes + excluded.passes`);
      await tx.execute(sql`
        insert into vote_aggregate (public_round_id, entry_id, age_bracket, province, ref, votes)
        select public_round_id, entry_id, age_bracket, province, ref, count(*)
        from vote where public_round_id = ${round.id}
        group by public_round_id, entry_id, age_bracket, province, ref
        on conflict on constraint vote_aggregate_cell do update
          set votes = vote_aggregate.votes + excluded.votes`);
      const swipes = await tx
        .delete(swipe)
        .where(eq(swipe.publicRoundId, round.id))
        .returning({ id: swipe.id });
      const votes = await tx
        .delete(vote)
        .where(eq(vote.publicRoundId, round.id))
        .returning({ id: vote.id });
      await tx.delete(matchup).where(eq(matchup.publicRoundId, round.id));
      await tx.delete(ballot).where(eq(ballot.publicRoundId, round.id));
      if (swipes.length || votes.length) {
        await audit(tx, null, "retention.rolled_up", {
          publicRoundId: round.id,
          swipes: swipes.length,
          votes: votes.length,
        });
      }
      report.swipesDeleted += swipes.length;
      report.votesDeleted += votes.length;
    });
    report.rounds++;
  }
  report.rateLimitRowsSwept = await sweepRateLimits(db, now);
  return report;
}
