import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  players,
  wcTeams,
  teamAssignments,
  matches,
  matchEvents,
  pointsLog,
} from "@/db/schema";
import { and, gte, lte, eq } from "drizzle-orm";
import { TIER_LABELS } from "@/lib/points";

export const dynamic = "force-dynamic";

let tablesEnsured = false;

export async function GET(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");

    // Default to yesterday
    const now = new Date();
    let targetDate: Date;
    if (dateParam) {
      targetDate = new Date(`${dateParam}T00:00:00.000Z`);
    } else {
      targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() - 1);
      targetDate.setHours(0, 0, 0, 0);
    }

    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Load base data
    const allPlayers = await db.select().from(players);
    const allTeams = await db.select().from(wcTeams);
    const allAssignments = await db.select().from(teamAssignments);
    const allPoints = await db.select().from(pointsLog);

    type Team = (typeof allTeams)[number];
    type Assignment = (typeof allAssignments)[number];
    type Player = (typeof allPlayers)[number];

    const teamById = new Map<number, Team>(allTeams.map((t) => [t.id, t]));
    const assignByTeam = new Map<number, Assignment>(allAssignments.map((a) => [a.teamId, a]));
    const playerById = new Map<number, Player>(allPlayers.map((p) => [p.id, p]));

    // Matches played that day
    const dayMatches = await db
      .select()
      .from(matches)
      .where(
        and(
          gte(matches.kickoff, dayStart),
          lte(matches.kickoff, dayEnd),
          eq(matches.status, "finished")
        )
      );

    // Match events for those matches
    const dayMatchIds = new Set(dayMatches.map((m) => m.id));
    const allMatchEvents = await db.select().from(matchEvents);
    const dayEvents = allMatchEvents.filter((e) => dayMatchIds.has(e.matchId));

    // Build match results
    const matchResults = dayMatches
      .map((m) => {
        const home = teamById.get(m.homeTeamId);
        const away = teamById.get(m.awayTeamId);
        const homeAssign = assignByTeam.get(m.homeTeamId);
        const awayAssign = assignByTeam.get(m.awayTeamId);
        const homeOwner = homeAssign
          ? playerById.get(homeAssign.playerId)
          : null;
        const awayOwner = awayAssign
          ? playerById.get(awayAssign.playerId)
          : null;

        const goals = dayEvents
          .filter(
            (e) => e.matchId === m.id && e.eventType === "goal"
          )
          .map((e) => ({
            playerName: e.playerName,
            minute: e.minute,
            teamName: teamById.get(e.teamId)?.name ?? "?",
            detail: e.detail,
          }));

        const redCards = dayEvents.filter(
          (e) => e.matchId === m.id && e.eventType === "red_card"
        ).length;

        const homeCleanSheet =
          m.awayScore === 0 && (m.homeScore ?? 0) > 0;
        const awayCleanSheet =
          m.homeScore === 0 && (m.awayScore ?? 0) > 0;

        return {
          id: m.id,
          homeTeam: home?.name ?? "?",
          awayTeam: away?.name ?? "?",
          homeFlag: home?.flagEmoji ?? "",
          awayFlag: away?.flagEmoji ?? "",
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          homePenalties: m.homePenalties,
          awayPenalties: m.awayPenalties,
          stage: m.stage,
          kickoff: m.kickoff?.toISOString() ?? "",
          homeOwner: homeOwner?.name ?? null,
          homeOwnerColor: homeOwner?.color ?? null,
          awayOwner: awayOwner?.name ?? null,
          awayOwnerColor: awayOwner?.color ?? null,
          goals,
          redCards,
          homeCleanSheet,
          awayCleanSheet,
          homeTier: home?.tier ?? 1,
          awayTier: away?.tier ?? 1,
        };
      })
      .sort(
        (a, b) =>
          new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
      );

    // Points awarded that day grouped by player
    const dayPoints = allPoints.filter((p) => {
      const c = p.createdAt ? new Date(p.createdAt) : null;
      return c && c >= dayStart && c <= dayEnd;
    });

    const playerPointsMap = new Map<
      number,
      { name: string; color: string; points: number; breakdown: { source: string; points: number; note: string | null; teamName: string }[] }
    >();

    for (const p of dayPoints) {
      const existing = playerPointsMap.get(p.playerId);
      const team = teamById.get(p.teamId);
      const entry = {
        source: p.source,
        points: Math.round(p.points * 10) / 10,
        note: p.note,
        teamName: team?.name ?? "?",
      };
      if (existing) {
        existing.points += p.points;
        existing.breakdown.push(entry);
      } else {
        const pl = playerById.get(p.playerId);
        playerPointsMap.set(p.playerId, {
          name: pl?.name ?? "?",
          color: pl?.color ?? "#ffffff",
          points: p.points,
          breakdown: [entry],
        });
      }
    }

    const pointsByPlayer = Array.from(playerPointsMap.values())
      .map((p) => ({
        ...p,
        points: Math.round(p.points * 10) / 10,
      }))
      .sort((a, b) => b.points - a.points);

    const biggestEarner = pointsByPlayer[0] ?? null;

    // Leaderboard with position changes
    // Current standings
    const currentStandings = allPlayers
      .map((p) => {
        const pAssign = allAssignments.filter((a) => a.playerId === p.id);
        const total = pAssign.reduce((sum, a) => {
          return (
            sum +
            allPoints
              .filter(
                (pt) => pt.playerId === p.id && pt.teamId === a.teamId
              )
              .reduce((s, pt) => s + pt.points, 0)
          );
        }, 0);
        return {
          playerId: p.id,
          name: p.name,
          color: p.color ?? "#ffffff",
          totalPoints: Math.round(total * 10) / 10,
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);

    // Yesterday's standings (excluding today's points)
    const previousStandings = allPlayers
      .map((p) => {
        const pAssign = allAssignments.filter((a) => a.playerId === p.id);
        const total = pAssign.reduce((sum, a) => {
          return (
            sum +
            allPoints
              .filter(
                (pt) =>
                  pt.playerId === p.id &&
                  pt.teamId === a.teamId &&
                  !(
                    pt.createdAt &&
                    new Date(pt.createdAt) >= dayStart &&
                    new Date(pt.createdAt) <= dayEnd
                  )
              )
              .reduce((s, pt) => s + pt.points, 0)
          );
        }, 0);
        return {
          playerId: p.id,
          totalPoints: Math.round(total * 10) / 10,
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);

    const previousRankMap = new Map<number, number>();
    previousStandings.forEach((p, i) => previousRankMap.set(p.playerId, i + 1));

    const standings = currentStandings.map((p, i) => {
      const prevRank = previousRankMap.get(p.playerId) ?? i + 1;
      const currentRank = i + 1;
      return {
        ...p,
        rank: currentRank,
        previousRank: prevRank,
        movement: prevRank - currentRank, // positive = moved up
      };
    });

    // Upsets: lower-tier team beat higher-tier (higher tier number = weaker)
    const upsets = matchResults.filter((m) => {
      if (m.homeScore === null || m.awayScore === null) return false;
      if (m.homeScore > m.awayScore && m.homeTier > m.awayTier) return true;
      if (m.awayScore > m.homeScore && m.awayTier > m.homeTier) return true;
      return false;
    }).map((m) => {
      const winnerIsHome = (m.homeScore ?? 0) > (m.awayScore ?? 0);
      const winner = winnerIsHome ? m.homeTeam : m.awayTeam;
      const winnerFlag = winnerIsHome ? m.homeFlag : m.awayFlag;
      const loser = winnerIsHome ? m.awayTeam : m.homeTeam;
      const winnerTier = winnerIsHome ? m.homeTier : m.awayTier;
      return {
        winner,
        winnerFlag,
        loser,
        score: `${m.homeScore}-${m.awayScore}`,
        winnerTierLabel: TIER_LABELS[winnerTier] ?? "Unknown",
      };
    });

    // Clean sheets
    const cleanSheets = matchResults
      .filter((m) => m.homeCleanSheet || m.awayCleanSheet)
      .map((m) => {
        const team = m.homeCleanSheet ? m.homeTeam : m.awayTeam;
        const flag = m.homeCleanSheet ? m.homeFlag : m.awayFlag;
        const owner = m.homeCleanSheet ? m.homeOwner : m.awayOwner;
        return {
          team,
          flag,
          owner,
          score: `${m.homeScore}-${m.awayScore}`,
          opponent: m.homeCleanSheet ? m.awayTeam : m.homeTeam,
        };
      });

    // Red cards
    const redCards = dayEvents
      .filter((e) => e.eventType === "red_card")
      .map((e) => {
        const team = teamById.get(e.teamId);
        const match = dayMatches.find((m) => m.id === e.matchId);
        const home = match ? teamById.get(match.homeTeamId) : null;
        const away = match ? teamById.get(match.awayTeamId) : null;
        return {
          playerName: e.playerName,
          teamName: team?.name ?? "?",
          teamFlag: team?.flagEmoji ?? "",
          minute: e.minute,
          matchLabel: `${home?.name ?? "?"} vs ${away?.name ?? "?"}`,
        };
      });

    // Auto-generate headline
    let headline = "No matches played";
    if (matchResults.length > 0) {
      if (biggestEarner) {
        // Find the most dramatic result for the biggest earner
        const earnerPlayer = allPlayers.find(
          (p) => p.name === biggestEarner.name
        );
        if (earnerPlayer) {
          const earnerTeamIds = allAssignments
            .filter((a) => a.playerId === earnerPlayer.id)
            .map((a) => a.teamId);
          const earnerMatches = dayMatches.filter(
            (m) =>
              earnerTeamIds.includes(m.homeTeamId) ||
              earnerTeamIds.includes(m.awayTeamId)
          );
          if (earnerMatches.length > 0) {
            const bestMatch = earnerMatches.sort((a, b) => {
              const aGoals = (a.homeScore ?? 0) + (a.awayScore ?? 0);
              const bGoals = (b.homeScore ?? 0) + (b.awayScore ?? 0);
              return bGoals - aGoals;
            })[0];
            const home = teamById.get(bestMatch.homeTeamId);
            const away = teamById.get(bestMatch.awayTeamId);
            const isHome = earnerTeamIds.includes(bestMatch.homeTeamId);
            const earnerTeam = isHome ? home : away;
            const oppTeam = isHome ? away : home;
            const earnerScore = isHome
              ? bestMatch.homeScore
              : bestMatch.awayScore;
            const oppScore = isHome
              ? bestMatch.awayScore
              : bestMatch.homeScore;

            if (
              earnerScore !== null &&
              oppScore !== null &&
              earnerScore > oppScore
            ) {
              if (earnerScore >= 3) {
                headline = `${biggestEarner.name}'s ${earnerTeam?.name} demolish ${oppTeam?.name} ${bestMatch.homeScore}-${bestMatch.awayScore}`;
              } else {
                headline = `${biggestEarner.name}'s ${earnerTeam?.name} beat ${oppTeam?.name} ${bestMatch.homeScore}-${bestMatch.awayScore}`;
              }
            } else if (
              earnerScore !== null &&
              oppScore !== null &&
              earnerScore < oppScore
            ) {
              headline = `Heartbreak for ${biggestEarner.name} as ${earnerTeam?.name} fall ${bestMatch.homeScore}-${bestMatch.awayScore} to ${oppTeam?.name}`;
            } else {
              headline = `${biggestEarner.name} leads the day with ${biggestEarner.points} points`;
            }
          } else {
            headline = `${biggestEarner.name} leads the day with ${biggestEarner.points} points`;
          }
        }
      } else {
        // No points awarded, just describe the matches
        const m = matchResults[0];
        headline = `${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam}`;
        if (matchResults.length > 1) {
          headline += ` and ${matchResults.length - 1} more`;
        }
      }
    }

    const dateStr = dayStart.toISOString().split("T")[0];

    return NextResponse.json({
      date: dateStr,
      headline,
      matches: matchResults,
      pointsByPlayer,
      biggestEarner,
      standings,
      upsets,
      cleanSheets,
      redCards,
    });
  } catch (err) {
    console.error("[Digest]", err);
    return NextResponse.json(
      { error: "Failed to load digest" },
      { status: 500 }
    );
  }
}
