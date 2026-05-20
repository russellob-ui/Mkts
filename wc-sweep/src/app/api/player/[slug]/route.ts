import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  players,
  wcTeams,
  teamAssignments,
  pointsLog,
  predictions,
  banterEvents,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { TIER_LABELS } from "@/lib/points";

let tablesEnsured = false;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const { slug } = await params;

    // Look up player by slug
    const playerRows = await db
      .select()
      .from(players)
      .where(eq(players.slug, slug));

    if (playerRows.length === 0) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    const player = playerRows[0];

    // All teams + assignments for this player
    const allTeams = await db.select().from(wcTeams);
    const teamById = new Map(allTeams.map((t) => [t.id, t]));

    const playerAssignments = await db
      .select()
      .from(teamAssignments)
      .where(eq(teamAssignments.playerId, player.id));

    // Points for this player
    const playerPoints = await db
      .select()
      .from(pointsLog)
      .where(eq(pointsLog.playerId, player.id));

    // Build teams list with points
    const teams = playerAssignments.map((a) => {
      const team = teamById.get(a.teamId);
      const teamPts = playerPoints
        .filter((p) => p.teamId === a.teamId)
        .reduce((sum, p) => sum + p.points, 0);
      return {
        teamId: a.teamId,
        name: team?.name ?? "?",
        flagEmoji: team?.flagEmoji ?? "🏳️",
        fifaCode: team?.fifaCode ?? "?",
        groupLetter: team?.groupLetter ?? "?",
        tier: team?.tier ?? 1,
        tierLabel: TIER_LABELS[team?.tier ?? 1] ?? "Unknown",
        eliminated: team?.eliminated ?? false,
        points: Math.round(teamPts * 10) / 10,
      };
    });

    const totalPoints =
      Math.round(teams.reduce((s, t) => s + t.points, 0) * 10) / 10;

    // Points breakdown per team+source
    const pointsBreakdown = playerPoints
      .map((p) => ({
        id: p.id,
        teamId: p.teamId,
        teamName: teamById.get(p.teamId)?.name ?? "?",
        teamFlag: teamById.get(p.teamId)?.flagEmoji ?? "🏳️",
        source: p.source,
        points: p.points,
        note: p.note,
        createdAt: p.createdAt?.toISOString() ?? "",
      }))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    // Predictions stats
    const playerPredictions = await db
      .select()
      .from(predictions)
      .where(eq(predictions.playerId, player.id));

    const totalPredictions = playerPredictions.length;
    const resolvedPredictions = playerPredictions.filter((p) => p.resolved);
    const correctPredictions = resolvedPredictions.filter((p) => p.correct);
    const accuracy =
      resolvedPredictions.length > 0
        ? Math.round(
            (correctPredictions.length / resolvedPredictions.length) * 100
          )
        : 0;

    // Recent banter events mentioning this player
    const recentBanter = await db
      .select()
      .from(banterEvents)
      .where(eq(banterEvents.playerId, player.id))
      .orderBy(desc(banterEvents.createdAt))
      .limit(20);

    const banterList = recentBanter.map((b) => ({
      id: b.id,
      eventType: b.eventType,
      headline: b.headline,
      detail: b.detail,
      emoji: b.emoji,
      importance: b.importance,
      createdAt: b.createdAt?.toISOString() ?? "",
    }));

    return NextResponse.json({
      player: {
        id: player.id,
        name: player.name,
        slug: player.slug,
        avatarEmoji: player.avatarEmoji,
        color: player.color,
      },
      teams: teams.sort((a, b) => b.points - a.points),
      totalPoints,
      pointsBreakdown,
      predictions: {
        total: totalPredictions,
        correct: correctPredictions.length,
        accuracy,
      },
      recentBanter: banterList,
    });
  } catch (err) {
    console.error("[Player Profile]", err);
    return NextResponse.json(
      { error: "Failed to load player profile" },
      { status: 500 }
    );
  }
}
