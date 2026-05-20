import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  players,
  wcTeams,
  teamAssignments,
  pointsLog,
  matches,
  matchEvents,
  predictions,
} from "@/db/schema";

let tablesEnsured = false;

export async function GET() {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const allPlayers = await db.select().from(players);
    const allTeams = await db.select().from(wcTeams);
    const allAssignments = await db.select().from(teamAssignments);
    const allPoints = await db.select().from(pointsLog);
    const allMatches = await db.select().from(matches);
    const allEvents = await db.select().from(matchEvents);
    const allPredictions = await db.select().from(predictions);

    const finishedMatches = allMatches.filter(
      (m) =>
        m.status === "finished" &&
        m.homeScore !== null &&
        m.awayScore !== null
    );

    // ---- Total goals ----
    const totalGoals = finishedMatches.reduce(
      (s, m) => s + (m.homeScore ?? 0) + (m.awayScore ?? 0),
      0
    );
    const totalMatches = finishedMatches.length;
    const avgGoalsPerMatch =
      totalMatches > 0
        ? Math.round((totalGoals / totalMatches) * 100) / 100
        : 0;

    // ---- Total cards ----
    const cardEvents = allEvents.filter(
      (e) => e.eventType === "Card"
    );
    const totalCards = cardEvents.length;
    const totalRedCards = cardEvents.filter(
      (e) => e.detail?.toLowerCase().includes("red")
    ).length;
    const totalYellowCards = totalCards - totalRedCards;

    // ---- Total clean sheets ----
    const totalCleanSheets = finishedMatches.reduce((count, m) => {
      let cs = 0;
      if (m.awayScore === 0 && (m.homeScore ?? 0) > 0) cs++;
      if (m.homeScore === 0 && (m.awayScore ?? 0) > 0) cs++;
      return count + cs;
    }, 0);

    // ---- Top scorer (player from match_events) ----
    const goalEvents = allEvents.filter(
      (e) => e.eventType === "Goal"
    );
    const goalsByPlayer: Record<
      string,
      { name: string; teamId: number; goals: number }
    > = {};
    for (const evt of goalEvents) {
      const key = evt.playerName ?? "Unknown";
      if (!goalsByPlayer[key]) {
        goalsByPlayer[key] = {
          name: key,
          teamId: evt.teamId,
          goals: 0,
        };
      }
      goalsByPlayer[key].goals++;
    }
    const topScorers = Object.values(goalsByPlayer)
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 5)
      .map((s) => {
        const team = allTeams.find((t) => t.id === s.teamId);
        return {
          playerName: s.name,
          teamName: team?.name ?? "?",
          flagEmoji: team?.flagEmoji ?? "",
          goals: s.goals,
        };
      });

    // ---- Most carded team ----
    const cardsByTeam: Record<number, number> = {};
    for (const evt of cardEvents) {
      cardsByTeam[evt.teamId] = (cardsByTeam[evt.teamId] ?? 0) + 1;
    }
    let mostCardedTeam: {
      teamName: string;
      flagEmoji: string;
      cards: number;
    } | null = null;
    let maxCards = 0;
    for (const [tid, count] of Object.entries(cardsByTeam)) {
      if (count > maxCards) {
        maxCards = count;
        const team = allTeams.find((t) => t.id === parseInt(tid));
        mostCardedTeam = {
          teamName: team?.name ?? "?",
          flagEmoji: team?.flagEmoji ?? "",
          cards: count,
        };
      }
    }

    // ---- Biggest win (highest goal difference) ----
    let biggestWin: {
      homeTeam: string;
      awayTeam: string;
      homeFlag: string;
      awayFlag: string;
      homeScore: number;
      awayScore: number;
      stage: string;
    } | null = null;
    let maxGD = 0;
    for (const m of finishedMatches) {
      const gd = Math.abs((m.homeScore ?? 0) - (m.awayScore ?? 0));
      if (gd > maxGD) {
        maxGD = gd;
        const home = allTeams.find((t) => t.id === m.homeTeamId);
        const away = allTeams.find((t) => t.id === m.awayTeamId);
        biggestWin = {
          homeTeam: home?.name ?? "?",
          awayTeam: away?.name ?? "?",
          homeFlag: home?.flagEmoji ?? "",
          awayFlag: away?.flagEmoji ?? "",
          homeScore: m.homeScore ?? 0,
          awayScore: m.awayScore ?? 0,
          stage: m.stage,
        };
      }
    }

    // ---- Most exciting match (most total goals) ----
    let mostExciting: {
      homeTeam: string;
      awayTeam: string;
      homeFlag: string;
      awayFlag: string;
      homeScore: number;
      awayScore: number;
      stage: string;
    } | null = null;
    let maxTotalGoals = 0;
    for (const m of finishedMatches) {
      const total = (m.homeScore ?? 0) + (m.awayScore ?? 0);
      if (total > maxTotalGoals) {
        maxTotalGoals = total;
        const home = allTeams.find((t) => t.id === m.homeTeamId);
        const away = allTeams.find((t) => t.id === m.awayTeamId);
        mostExciting = {
          homeTeam: home?.name ?? "?",
          awayTeam: away?.name ?? "?",
          homeFlag: home?.flagEmoji ?? "",
          awayFlag: away?.flagEmoji ?? "",
          homeScore: m.homeScore ?? 0,
          awayScore: m.awayScore ?? 0,
          stage: m.stage,
        };
      }
    }

    // ---- Fastest goal ----
    let fastestGoal: {
      playerName: string;
      teamName: string;
      flagEmoji: string;
      minute: number;
      matchLabel: string;
    } | null = null;
    for (const evt of goalEvents) {
      if (evt.minute !== null && (fastestGoal === null || evt.minute < fastestGoal.minute)) {
        const m = allMatches.find((m) => m.id === evt.matchId);
        const team = allTeams.find((t) => t.id === evt.teamId);
        const home = m ? allTeams.find((t) => t.id === m.homeTeamId) : null;
        const away = m ? allTeams.find((t) => t.id === m.awayTeamId) : null;
        fastestGoal = {
          playerName: evt.playerName ?? "Unknown",
          teamName: team?.name ?? "?",
          flagEmoji: team?.flagEmoji ?? "",
          minute: evt.minute,
          matchLabel: `${home?.name ?? "?"} vs ${away?.name ?? "?"}`,
        };
      }
    }

    // ---- Points leader by day ----
    function matchDate(m: { kickoff: Date | null }): string {
      if (!m.kickoff) return "";
      return m.kickoff.toISOString().slice(0, 10);
    }

    // Group points by date, compute cumulative per player
    const allDates = [
      ...new Set(
        allPoints
          .map((p) => {
            const m = allMatches.find((m) => m.id === p.matchId);
            return m ? matchDate(m) : "";
          })
          .filter(Boolean)
      ),
    ].sort();

    const leaderByDay: { date: string; leader: string; color: string; points: number }[] = [];
    const cumulativeByPlayer: Record<number, number> = {};

    for (const date of allDates) {
      // Add all points from this date
      for (const pt of allPoints) {
        const m = allMatches.find((m) => m.id === pt.matchId);
        if (m && matchDate(m) === date) {
          cumulativeByPlayer[pt.playerId] =
            (cumulativeByPlayer[pt.playerId] ?? 0) + pt.points;
        }
      }
      // Find leader
      let maxPts = 0;
      let leaderId: number | null = null;
      for (const [pid, pts] of Object.entries(cumulativeByPlayer)) {
        if (pts > maxPts) {
          maxPts = pts;
          leaderId = parseInt(pid);
        }
      }
      const leaderPlayer = allPlayers.find((p) => p.id === leaderId);
      leaderByDay.push({
        date,
        leader: leaderPlayer?.name ?? "?",
        color: leaderPlayer?.color ?? "#ffffff",
        points: Math.round(maxPts * 10) / 10,
      });
    }

    // ---- Per-tier breakdown ----
    const tierPoints: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const pt of allPoints) {
      const assign = allAssignments.find(
        (a) => a.playerId === pt.playerId && a.teamId === pt.teamId
      );
      if (assign) {
        const team = allTeams.find((t) => t.id === assign.teamId);
        const tier = team?.tier ?? 1;
        tierPoints[tier] = (tierPoints[tier] ?? 0) + pt.points;
      }
    }
    const tierBreakdown = Object.entries(tierPoints)
      .map(([tier, points]) => ({
        tier: parseInt(tier),
        label:
          parseInt(tier) === 1
            ? "Elite"
            : parseInt(tier) === 2
              ? "Strong"
              : parseInt(tier) === 3
                ? "Mid"
                : "Underdog",
        points: Math.round(points * 10) / 10,
      }))
      .sort((a, b) => a.tier - b.tier);

    // ---- Prediction accuracy leaderboard ----
    const predictionLeaderboard = allPlayers
      .map((player) => {
        const preds = allPredictions.filter(
          (p) => p.playerId === player.id && p.resolved
        );
        const correct = preds.filter((p) => p.correct).length;
        const total = preds.length;
        return {
          playerName: player.name,
          color: player.color ?? "#ffffff",
          total,
          correct,
          accuracy:
            total > 0
              ? Math.round((correct / total) * 1000) / 10
              : 0,
        };
      })
      .sort((a, b) => b.accuracy - a.accuracy || b.correct - a.correct);

    return NextResponse.json({
      totalGoals,
      totalMatches,
      avgGoalsPerMatch,
      totalCards,
      totalRedCards,
      totalYellowCards,
      totalCleanSheets,
      topScorers,
      mostCardedTeam,
      biggestWin,
      mostExciting,
      fastestGoal,
      leaderByDay,
      tierBreakdown,
      predictionLeaderboard,
    });
  } catch (err) {
    console.error("[Stats]", err);
    return NextResponse.json(
      { error: "Failed to load stats" },
      { status: 500 }
    );
  }
}
