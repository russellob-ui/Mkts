import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  banterEvents,
  players,
  golfers,
  tournaments,
  picks,
  tournamentResults,
} from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await ensureTables();
  const tournamentIdParam = request.nextUrl.searchParams.get("tournamentId");
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const minImportance = Number(
    request.nextUrl.searchParams.get("minImportance") ?? "0"
  );

  // Default to the live tournament if no tournamentId specified
  let tournamentId = Number(tournamentIdParam ?? "0");
  if (!tournamentId) {
    const [live] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.status, "live"));
    if (live) tournamentId = live.id;
    else {
      const [first] = await db.select().from(tournaments).limit(1);
      if (first) tournamentId = first.id;
    }
  }

  if (!tournamentId) {
    return NextResponse.json({ events: [] });
  }

  // Fetch existing banter events
  let events = await db
    .select()
    .from(banterEvents)
    .where(eq(banterEvents.tournamentId, tournamentId))
    .orderBy(desc(banterEvents.createdAt))
    .limit(limit);

  // If no events yet, auto-generate initial banter from current state
  if (events.length === 0) {
    await generateInitialBanter(tournamentId);
    events = await db
      .select()
      .from(banterEvents)
      .where(eq(banterEvents.tournamentId, tournamentId))
      .orderBy(desc(banterEvents.createdAt))
      .limit(limit);
  }

  // Filter by importance in memory
  const filtered =
    minImportance > 0
      ? events.filter((e) => e.importance >= minImportance)
      : events;

  const allPlayers = await db.select().from(players);
  const allGolfers = await db.select().from(golfers);

  const result = filtered.map((e) => ({
    id: e.id,
    eventType: e.eventType,
    headline: e.headline,
    detail: e.detail,
    emoji: e.emoji,
    importance: e.importance,
    roundNumber: e.roundNumber,
    source: e.source,
    player: e.playerId ? allPlayers.find((p) => p.id === e.playerId) : null,
    golfer: e.golferId ? allGolfers.find((g) => g.id === e.golferId) : null,
    createdAt: e.createdAt.toISOString(),
  }));

  return NextResponse.json({ events: result });
}

/**
 * Generate initial banter events from tournament_results when the
 * banter_events table is empty. Uses current standings to create
 * a baseline set of observations.
 */
async function generateInitialBanter(tournamentId: number) {
  try {
    const tournamentPicks = await db
      .select()
      .from(picks)
      .where(eq(picks.tournamentId, tournamentId));
    const allPlayers = await db.select().from(players);
    const allGolfers = await db.select().from(golfers);
    const allResults = await db
      .select()
      .from(tournamentResults)
      .where(eq(tournamentResults.tournamentId, tournamentId));

    // Build enriched picks with results
    const enriched = tournamentPicks
      .map((pick) => {
        const player = allPlayers.find((p) => p.id === pick.playerId);
        const golfer = allGolfers.find((g) => g.id === pick.golferId);
        const result = allResults.find((r) => r.golferId === pick.golferId);
        if (!player || !golfer) return null;
        return {
          pickId: pick.id,
          playerId: player.id,
          playerName: player.name,
          golferId: golfer.id,
          golferName: golfer.name,
          position: result?.finalPosition ?? null,
          scoreToPar: result?.finalScoreToPar ?? null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (enriched.length === 0) return;

    const withScores = enriched.filter((e) => e.scoreToPar != null);
    if (withScores.length === 0) return;

    // Sort by score to par (best first)
    const sorted = [...withScores].sort(
      (a, b) => (a.scoreToPar ?? 0) - (b.scoreToPar ?? 0)
    );

    const eventsToInsert: Array<{
      tournamentId: number;
      roundNumber: number | null;
      playerId: number;
      golferId: number;
      eventType: string;
      headline: string;
      detail: string | null;
      emoji: string;
      importance: number;
      source: string;
    }> = [];

    // 1. Round 1 complete summary
    eventsToInsert.push({
      tournamentId,
      roundNumber: 1,
      playerId: sorted[0].playerId,
      golferId: sorted[0].golferId,
      eventType: "round_end",
      headline: `🏁 Round 1 complete — ${sorted[0].golferName} leads our picks at ${formatScore(sorted[0].scoreToPar)}`,
      detail: `${sorted[0].playerName}'s pick is out in front`,
      emoji: "🏁",
      importance: 7,
      source: "auto",
    });

    // 2. Sweep leader
    eventsToInsert.push({
      tournamentId,
      roundNumber: 1,
      playerId: sorted[0].playerId,
      golferId: sorted[0].golferId,
      eventType: "lead_change",
      headline: `👑 ${sorted[0].playerName}'s ${sorted[0].golferName} takes the sweep lead`,
      detail: `${formatScore(sorted[0].scoreToPar)} after Round 1`,
      emoji: "👑",
      importance: 7,
      source: "auto",
    });

    // 3. Under-par golfers
    for (const entry of sorted.filter((e) => (e.scoreToPar ?? 0) < 0)) {
      if (entry === sorted[0]) continue; // already covered
      eventsToInsert.push({
        tournamentId,
        roundNumber: 1,
        playerId: entry.playerId,
        golferId: entry.golferId,
        eventType: "position_jump_up",
        headline: `🔥 ${entry.golferName} at ${formatScore(entry.scoreToPar)} after R1`,
        detail: `${entry.playerName}'s pick is in the mix`,
        emoji: "🔥",
        importance: 5,
        source: "auto",
      });
    }

    // 4. Over-par strugglers
    for (const entry of sorted.filter((e) => (e.scoreToPar ?? 0) >= 3)) {
      eventsToInsert.push({
        tournamentId,
        roundNumber: 1,
        playerId: entry.playerId,
        golferId: entry.golferId,
        eventType: "position_jump_down",
        headline: `📉 ${entry.golferName} struggling at ${formatScore(entry.scoreToPar)}`,
        detail: `${entry.playerName} will need a comeback`,
        emoji: "📉",
        importance: 5,
        source: "auto",
      });
    }

    // 5. Wooden spoon alert (worst player)
    const worst = sorted[sorted.length - 1];
    if (worst && (worst.scoreToPar ?? 0) >= 5) {
      eventsToInsert.push({
        tournamentId,
        roundNumber: 1,
        playerId: worst.playerId,
        golferId: worst.golferId,
        eventType: "position_jump_down",
        headline: `🥄 Wooden spoon watch: ${worst.golferName} at ${formatScore(worst.scoreToPar)}`,
        detail: `${worst.playerName} in trouble early`,
        emoji: "🥄",
        importance: 6,
        source: "auto",
      });
    }

    // 6. Tournament started event
    eventsToInsert.push({
      tournamentId,
      roundNumber: 1,
      playerId: sorted[0].playerId,
      golferId: sorted[0].golferId,
      eventType: "round_start",
      headline: `⛳ The Masters is underway at Augusta National`,
      detail: `8 picks, 4 rounds, one green jacket`,
      emoji: "⛳",
      importance: 6,
      source: "auto",
    });

    // Insert all
    for (const event of eventsToInsert) {
      await db.insert(banterEvents).values(event);
    }

    console.log(`[Banter] Generated ${eventsToInsert.length} initial events`);
  } catch (err) {
    console.error("[Banter] Initial generation error:", err);
  }
}

function formatScore(s: number | null): string {
  if (s === null || s === undefined) return "E";
  if (s === 0) return "E";
  return s > 0 ? `+${s}` : String(s);
}
