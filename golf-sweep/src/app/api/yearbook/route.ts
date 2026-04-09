import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  players,
  tournaments,
  picks,
  golfers,
  tournamentResults,
  pointsLog,
  records,
  seasons,
} from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureTables();

    const year = Number(
      request.nextUrl.searchParams.get("year") ?? "2026"
    );

    // Find season for this year
    const allSeasons = await db.select().from(seasons);
    const season = allSeasons.find((s) => s.year === year);

    const allPlayers = await db.select().from(players);
    const allTournaments = await db.select().from(tournaments);
    const allPicks = await db.select().from(picks);
    const allGolfers = await db.select().from(golfers);
    const allResults = await db.select().from(tournamentResults);
    const allPoints = await db.select().from(pointsLog);
    const allRecords = await db.select().from(records);

    // Filter tournaments to this season
    const seasonTournaments = season
      ? allTournaments.filter((t) => t.seasonId === season.id)
      : allTournaments;

    const seasonTournamentIds = new Set(seasonTournaments.map((t) => t.id));

    const yearbook = allPlayers.map((player) => {
      // Total points for the season
      const playerPoints = allPoints.filter(
        (p) =>
          p.playerId === player.id && seasonTournamentIds.has(p.tournamentId)
      );
      const totalPoints = playerPoints.reduce(
        (sum, p) => sum + p.points,
        0
      );

      // Points breakdown by source
      const pointsBySource: Record<string, number> = {};
      for (const p of playerPoints) {
        pointsBySource[p.source] =
          (pointsBySource[p.source] ?? 0) + p.points;
      }

      // Picks per tournament with results
      const picksPerTournament = seasonTournaments.map((tournament) => {
        const pick = allPicks.find(
          (p) =>
            p.playerId === player.id && p.tournamentId === tournament.id
        );
        if (!pick) return null;

        const golfer = allGolfers.find((g) => g.id === pick.golferId);
        const result = allResults.find(
          (r) =>
            r.golferId === pick.golferId &&
            r.tournamentId === tournament.id
        );

        const tournamentPoints = playerPoints
          .filter((p) => p.tournamentId === tournament.id)
          .reduce((sum, p) => sum + p.points, 0);

        return {
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          golferName: golfer?.name ?? "Unknown",
          golferId: pick.golferId,
          position: result?.finalPosition ?? null,
          scoreToPar: result?.finalScoreToPar ?? null,
          madeCut: result?.madeCut ?? null,
          points: tournamentPoints,
        };
      }).filter(Boolean);

      // Awards from records table (current, non-superseded)
      const playerAwards = allRecords.filter(
        (r) => r.playerId === player.id && r.supersededAt === null
      );

      return {
        player: {
          id: player.id,
          name: player.name,
          slug: player.slug,
          color: player.color,
          avatarEmoji: player.avatarEmoji,
        },
        totalPoints,
        pointsBySource,
        picks: picksPerTournament,
        awards: playerAwards.map((a) => ({
          id: a.id,
          recordType: a.recordType,
          description: a.description,
          displayValue: a.displayValue,
          scope: a.scope,
        })),
      };
    });

    yearbook.sort((a, b) => b.totalPoints - a.totalPoints);

    return NextResponse.json({
      year,
      seasonId: season?.id ?? null,
      yearbook,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
