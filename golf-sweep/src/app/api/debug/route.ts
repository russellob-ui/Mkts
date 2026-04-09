import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { tournaments, golfers, roundScores, tournamentResults, scoreSnapshots, banterEvents, rounds } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const passcode = request.nextUrl.searchParams.get("p");
  if (passcode !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureTables();

  const results: Record<string, unknown> = {};

  // Count all key tables
  const [snapshotCount] = await db.execute(sql`SELECT count(*) as c FROM score_snapshots`);
  const [banterCount] = await db.execute(sql`SELECT count(*) as c FROM banter_events`);
  const [roundScoreCount] = await db.execute(sql`SELECT count(*) as c FROM round_scores`);
  const [resultCount] = await db.execute(sql`SELECT count(*) as c FROM tournament_results`);
  const allRounds = await db.select().from(rounds);

  results.counts = {
    score_snapshots: snapshotCount,
    banter_events: banterCount,
    round_scores: roundScoreCount,
    tournament_results: resultCount,
  };
  results.rounds = allRounds;

  // Sample round_scores
  const sampleScores = await db.select().from(roundScores).limit(5);
  results.sampleRoundScores = sampleScores;

  // Sample snapshots
  const sampleSnapshots = await db.select().from(scoreSnapshots).limit(5);
  results.sampleSnapshots = sampleSnapshots;

  // Sample tournament_results
  const sampleResults = await db.select().from(tournamentResults).limit(5);
  results.sampleResults = sampleResults;

  return NextResponse.json(results);
}
