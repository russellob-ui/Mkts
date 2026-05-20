import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  players,
  wcTeams,
  teamAssignments,
  matches,
  pointsLog,
  banterEvents,
} from "@/db/schema";
import { eq, and, gte, lte, or, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

let tablesEnsured = false;

export async function GET(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const url = new URL(request.url);
    const playerSlug = url.searchParams.get("playerSlug");
    if (!playerSlug) {
      return NextResponse.json(
        { error: "playerSlug is required" },
        { status: 400 }
      );
    }

    // Load base data
    const allPlayers = await db.select().from(players);
    const allTeams = await db.select().from(wcTeams);
    const allAssignments = await db.select().from(teamAssignments);
    const allPoints = await db.select().from(pointsLog);

    const player = allPlayers.find((p) => p.slug === playerSlug);
    if (!player) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    // Player's teams
    const playerAssignments = allAssignments.filter(
      (a) => a.playerId === player.id
    );
    const playerTeamIds = new Set(playerAssignments.map((a) => a.teamId));

    // Leaderboard for rank
    const leaderboard = allPlayers
      .map((p) => {
        const pAssign = allAssignments.filter((a) => a.playerId === p.id);
        const total = pAssign.reduce((sum, a) => {
          const teamPts = allPoints
            .filter((pt) => pt.playerId === p.id && pt.teamId === a.teamId)
            .reduce((s, pt) => s + pt.points, 0);
          return sum + teamPts;
        }, 0);
        return { id: p.id, totalPoints: Math.round(total * 10) / 10 };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);

    const rank =
      leaderboard.findIndex((e) => e.id === player.id) + 1;
    const totalPoints =
      leaderboard.find((e) => e.id === player.id)?.totalPoints ?? 0;

    // Date boundaries
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayStart);
    yesterdayEnd.setMilliseconds(-1);

    const tomorrowStart = new Date(todayEnd);
    tomorrowStart.setMilliseconds(1);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    // All matches from yesterday through tomorrow
    const allRelevantMatches = await db
      .select()
      .from(matches)
      .where(
        and(gte(matches.kickoff, yesterdayStart), lte(matches.kickoff, tomorrowEnd))
      );

    type Team = (typeof allTeams)[number];
    type Assignment = (typeof allAssignments)[number];
    type Player = (typeof allPlayers)[number];

    const teamById = new Map<number, Team>(allTeams.map((t) => [t.id, t]));
    const assignByTeam = new Map<number, Assignment>(allAssignments.map((a) => [a.teamId, a]));
    const playerById = new Map<number, Player>(allPlayers.map((p) => [p.id, p]));

    function enrichMatch(m: (typeof allRelevantMatches)[number]) {
      const home = teamById.get(m.homeTeamId);
      const away = teamById.get(m.awayTeamId);
      const homeAssign = assignByTeam.get(m.homeTeamId);
      const awayAssign = assignByTeam.get(m.awayTeamId);
      return {
        id: m.id,
        homeTeam: home?.name ?? "?",
        awayTeam: away?.name ?? "?",
        homeFlag: home?.flagEmoji ?? "",
        awayFlag: away?.flagEmoji ?? "",
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: m.status,
        minute: m.minute,
        kickoff: m.kickoff?.toISOString() ?? "",
        stage: m.stage,
        venue: m.venue,
        city: m.city,
        homeOwner: homeAssign
          ? playerById.get(homeAssign.playerId)?.name ?? null
          : null,
        awayOwner: awayAssign
          ? playerById.get(awayAssign.playerId)?.name ?? null
          : null,
        isYourTeam: playerTeamIds.has(m.homeTeamId) || playerTeamIds.has(m.awayTeamId),
        yourTeamSide: playerTeamIds.has(m.homeTeamId)
          ? "home"
          : playerTeamIds.has(m.awayTeamId)
            ? "away"
            : null,
      };
    }

    // Filter to matches involving this player's teams
    const playerMatches = allRelevantMatches.filter(
      (m) => playerTeamIds.has(m.homeTeamId) || playerTeamIds.has(m.awayTeamId)
    );

    const todayMatches = playerMatches
      .filter((m) => {
        const k = m.kickoff ? new Date(m.kickoff) : null;
        return k && k >= todayStart && k <= todayEnd;
      })
      .map(enrichMatch)
      .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());

    const yesterdayMatches = playerMatches
      .filter((m) => {
        const k = m.kickoff ? new Date(m.kickoff) : null;
        return k && k >= yesterdayStart && k <= yesterdayEnd;
      })
      .map(enrichMatch)
      .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());

    const tomorrowMatches = playerMatches
      .filter((m) => {
        const k = m.kickoff ? new Date(m.kickoff) : null;
        return k && k >= tomorrowStart && k <= tomorrowEnd;
      })
      .map(enrichMatch)
      .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());

    // Points earned today
    const todayPoints = allPoints.filter((p) => {
      if (p.playerId !== player.id) return false;
      const c = p.createdAt ? new Date(p.createdAt) : null;
      return c && c >= todayStart && c <= todayEnd;
    });

    const todayPointsTotal = Math.round(
      todayPoints.reduce((s, p) => s + p.points, 0) * 10
    ) / 10;

    const todayBreakdown = todayPoints.map((p) => {
      const team = teamById.get(p.teamId);
      return {
        source: p.source,
        points: Math.round(p.points * 10) / 10,
        note: p.note,
        teamName: team?.name ?? "?",
        teamFlag: team?.flagEmoji ?? "",
      };
    });

    // Next match countdown — find the player's next upcoming match
    const allPlayerMatches = await db
      .select()
      .from(matches)
      .where(gte(matches.kickoff, now));

    const nextMatch = allPlayerMatches
      .filter(
        (m) =>
          (playerTeamIds.has(m.homeTeamId) || playerTeamIds.has(m.awayTeamId)) &&
          m.status === "scheduled"
      )
      .sort(
        (a, b) =>
          new Date(a.kickoff!).getTime() - new Date(b.kickoff!).getTime()
      )[0];

    const nextMatchCard = nextMatch ? enrichMatch(nextMatch) : null;
    const nextMatchCountdown = nextMatch?.kickoff
      ? new Date(nextMatch.kickoff).getTime() - now.getTime()
      : null;

    // Coming up: next 3 scheduled matches
    const upcomingMatches = allPlayerMatches
      .filter(
        (m) =>
          (playerTeamIds.has(m.homeTeamId) || playerTeamIds.has(m.awayTeamId)) &&
          m.status === "scheduled"
      )
      .sort(
        (a, b) =>
          new Date(a.kickoff!).getTime() - new Date(b.kickoff!).getTime()
      )
      .slice(0, 3)
      .map(enrichMatch);

    // Player's teams with status
    const yourTeams = playerAssignments.map((a) => {
      const team = teamById.get(a.teamId);
      const isPlayingToday = todayMatches.some(
        (m) =>
          (m.yourTeamSide === "home" && team?.name === m.homeTeam) ||
          (m.yourTeamSide === "away" && team?.name === m.awayTeam)
      );
      const playedYesterday = yesterdayMatches.some(
        (m) =>
          playerTeamIds.has(a.teamId) &&
          (a.teamId === allRelevantMatches.find((rm) => rm.id === m.id)?.homeTeamId ||
            a.teamId === allRelevantMatches.find((rm) => rm.id === m.id)?.awayTeamId)
      );
      const playsTomorrow = tomorrowMatches.some(
        (m) =>
          playerTeamIds.has(a.teamId) &&
          (a.teamId === allRelevantMatches.find((rm) => rm.id === m.id)?.homeTeamId ||
            a.teamId === allRelevantMatches.find((rm) => rm.id === m.id)?.awayTeamId)
      );
      return {
        teamId: a.teamId,
        teamName: team?.name ?? "?",
        flagEmoji: team?.flagEmoji ?? "",
        tier: team?.tier ?? 1,
        eliminated: team?.eliminated ?? false,
        isPlayingToday,
        playedYesterday,
        playsTomorrow,
      };
    });

    // Recent banter about this player
    const recentBanter = await db
      .select()
      .from(banterEvents)
      .where(eq(banterEvents.playerId, player.id))
      .orderBy(desc(banterEvents.createdAt))
      .limit(10);

    const banterList = recentBanter.map((b) => {
      const team = b.teamId ? teamById.get(b.teamId) : null;
      return {
        id: b.id,
        eventType: b.eventType,
        headline: b.headline,
        detail: b.detail,
        emoji: b.emoji,
        importance: b.importance,
        teamName: team?.name ?? null,
        teamFlag: team?.flagEmoji ?? null,
        createdAt: b.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      player: {
        id: player.id,
        name: player.name,
        slug: player.slug,
        avatarEmoji: player.avatarEmoji,
        color: player.color,
      },
      rank,
      totalPoints,
      totalPlayers: allPlayers.length,
      todayMatches,
      yesterdayMatches,
      tomorrowMatches,
      todayPoints: {
        total: todayPointsTotal,
        breakdown: todayBreakdown,
      },
      nextMatch: nextMatchCard,
      nextMatchCountdownMs: nextMatchCountdown,
      upcomingMatches,
      yourTeams,
      recentBanter: banterList,
    });
  } catch (err) {
    console.error("[MyDay]", err);
    return NextResponse.json(
      { error: "Failed to load my day" },
      { status: 500 }
    );
  }
}
