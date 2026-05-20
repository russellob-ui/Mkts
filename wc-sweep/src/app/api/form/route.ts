import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  players,
  pointsLog,
  matches,
} from "@/db/schema";

let tablesEnsured = false;

export async function GET() {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const allPlayers = await db.select().from(players);
    const allPoints = await db.select().from(pointsLog);
    const allMatches = await db.select().from(matches);

    // Build a map from matchId -> date string (YYYY-MM-DD from kickoff)
    const matchDateMap = new Map<number, string>();
    for (const m of allMatches) {
      if (m.kickoff) {
        const dateStr = m.kickoff.toISOString().split("T")[0];
        matchDateMap.set(m.id, dateStr);
      }
    }

    // Collect all unique match days that have points
    const allDatesSet = new Set<string>();
    for (const p of allPoints) {
      if (p.matchId) {
        const d = matchDateMap.get(p.matchId);
        if (d) allDatesSet.add(d);
      }
    }
    const allDates = [...allDatesSet].sort();

    // For each player, compute points per match day
    const form = allPlayers.map((player) => {
      const playerPoints = allPoints.filter((p) => p.playerId === player.id);

      // Group points by date
      const datePointsMap = new Map<string, number>();
      for (const p of playerPoints) {
        if (p.matchId) {
          const d = matchDateMap.get(p.matchId);
          if (d) {
            datePointsMap.set(d, (datePointsMap.get(d) ?? 0) + p.points);
          }
        }
      }

      // Build dailyPoints for all dates (fill gaps with 0)
      const dailyPoints = allDates.map((date) => ({
        date,
        points: Math.round((datePointsMap.get(date) ?? 0) * 10) / 10,
      }));

      // Last 10 match days
      const last10 = dailyPoints.slice(-10);

      // Calculate overall average (only days with matches)
      const daysWithPoints = dailyPoints.filter((d) => d.points > 0);
      const overallAvg =
        daysWithPoints.length > 0
          ? daysWithPoints.reduce((s, d) => s + d.points, 0) /
            daysWithPoints.length
          : 0;

      // Last 3 match days average
      const last3 = last10.slice(-3);
      const last3Avg =
        last3.length > 0
          ? last3.reduce((s, d) => s + d.points, 0) / last3.length
          : 0;

      // Determine trend
      let trend: "hot" | "cold" | "steady" = "steady";
      if (last3.length >= 2) {
        if (last3Avg > overallAvg * 1.1) {
          trend = "hot";
        } else if (last3Avg < overallAvg * 0.9) {
          trend = "cold";
        }
      }

      return {
        playerId: player.id,
        playerName: player.name,
        color: player.color ?? "#ffffff",
        trend,
        dailyPoints: last10,
      };
    });

    // Sort: hot first, then steady, then cold
    const trendOrder: Record<string, number> = { hot: 0, steady: 1, cold: 2 };
    form.sort(
      (a, b) =>
        (trendOrder[a.trend] ?? 1) - (trendOrder[b.trend] ?? 1)
    );

    return NextResponse.json({ form });
  } catch (err) {
    console.error("[Form]", err);
    return NextResponse.json(
      { error: "Failed to compute form guide" },
      { status: 500 }
    );
  }
}
