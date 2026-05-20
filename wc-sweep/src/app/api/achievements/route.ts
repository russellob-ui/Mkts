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
import { eq, and, inArray, sql, desc, asc } from "drizzle-orm";

let tablesEnsured = false;

interface Achievement {
  id: string;
  name: string;
  emoji: string;
  description: string;
  unlockedAt: string | null;
}

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

    // Helpers
    function getPlayerTeamIds(playerId: number): number[] {
      return allAssignments
        .filter((a) => a.playerId === playerId)
        .map((a) => a.teamId);
    }

    function getTeamTier(teamId: number): number {
      return allTeams.find((t) => t.id === teamId)?.tier ?? 1;
    }

    // Achievement definitions
    const ACHIEVEMENT_DEFS: {
      id: string;
      name: string;
      emoji: string;
      description: string;
    }[] = [
      {
        id: "first_blood",
        name: "First Blood",
        emoji: "\u{1FA78}",
        description: "First player to earn any points",
      },
      {
        id: "giant_killer",
        name: "Giant Killer",
        emoji: "\u{1F5E1}️",
        description: "Owns a Tier 4 team that beat a Tier 1 team",
      },
      {
        id: "clean_sheet_king",
        name: "Clean Sheet King",
        emoji: "\u{1F9E4}",
        description: "Most clean sheets across all your teams",
      },
      {
        id: "prophet",
        name: "Prophet",
        emoji: "\u{1F52E}",
        description: "5+ correct predictions in a row",
      },
      {
        id: "underdog_whisperer",
        name: "Underdog Whisperer",
        emoji: "\u{1F415}",
        description: "Highest total points from Tier 4 teams",
      },
      {
        id: "goal_machine",
        name: "Goal Machine",
        emoji: "⚽",
        description: "Your team scored 3+ goals in a single match",
      },
      {
        id: "red_mist",
        name: "Red Mist",
        emoji: "\u{1F7E5}",
        description: "Your team got a red card",
      },
      {
        id: "swept",
        name: "Swept",
        emoji: "\u{1F9F9}",
        description: "All your teams won on the same match day",
      },
      {
        id: "heartbreak",
        name: "Heartbreak",
        emoji: "\u{1F494}",
        description: "Lost a knockout match on penalties",
      },
      {
        id: "perfect_day",
        name: "Perfect Day",
        emoji: "✨",
        description: "Earned 10+ points in a single match day",
      },
      {
        id: "century_club",
        name: "Century Club",
        emoji: "\u{1F4AF}",
        description: "Reached 100 total points",
      },
      {
        id: "last_man_standing",
        name: "Last Man Standing",
        emoji: "\u{1F3C6}",
        description: "Last player with teams still alive",
      },
    ];

    // Precompute: finished matches grouped by date
    const finishedMatches = allMatches.filter(
      (m) => m.status === "finished" && m.homeScore !== null && m.awayScore !== null
    );

    function matchDate(m: { kickoff: Date | null }): string {
      if (!m.kickoff) return "";
      return m.kickoff.toISOString().slice(0, 10);
    }

    // Compute per-player achievements
    const result = allPlayers.map((player) => {
      const teamIds = getPlayerTeamIds(player.id);
      const playerPoints = allPoints.filter((p) => p.playerId === player.id);
      const achievements: Achievement[] = ACHIEVEMENT_DEFS.map((def) => ({
        ...def,
        unlockedAt: null,
      }));

      function unlock(id: string, at: string | null) {
        const a = achievements.find((a) => a.id === id);
        if (a && !a.unlockedAt) a.unlockedAt = at;
      }

      // "First Blood" — first player to earn any points
      // We check this globally below

      // "Giant Killer" — owns a Tier 4 team that beat a Tier 1 team
      for (const m of finishedMatches) {
        const homeIsPlayer = teamIds.includes(m.homeTeamId);
        const awayIsPlayer = teamIds.includes(m.awayTeamId);
        if (!homeIsPlayer && !awayIsPlayer) continue;

        const playerTeamId = homeIsPlayer ? m.homeTeamId : m.awayTeamId;
        const oppTeamId = homeIsPlayer ? m.awayTeamId : m.homeTeamId;
        const playerScore = homeIsPlayer ? m.homeScore! : m.awayScore!;
        const oppScore = homeIsPlayer ? m.awayScore! : m.homeScore!;

        if (
          getTeamTier(playerTeamId) === 4 &&
          getTeamTier(oppTeamId) === 1 &&
          playerScore > oppScore
        ) {
          unlock("giant_killer", m.kickoff?.toISOString() ?? null);
        }

        // "Goal Machine" — team scored 3+ goals in a single match
        if (playerScore >= 3) {
          unlock("goal_machine", m.kickoff?.toISOString() ?? null);
        }

        // "Heartbreak" — lost a knockout match on penalties
        if (
          m.stage !== "Group" &&
          m.homePenalties !== null &&
          m.awayPenalties !== null
        ) {
          const playerPens = homeIsPlayer
            ? m.homePenalties
            : m.awayPenalties;
          const oppPens = homeIsPlayer ? m.awayPenalties : m.homePenalties;
          if (playerPens !== null && oppPens !== null && playerPens < oppPens) {
            unlock("heartbreak", m.kickoff?.toISOString() ?? null);
          }
        }
      }

      // "Clean Sheet King" — computed globally below

      // "Prophet" — 5+ correct predictions in a row
      const playerPreds = allPredictions
        .filter((p) => p.playerId === player.id && p.resolved)
        .sort(
          (a, b) =>
            new Date(a.submittedAt).getTime() -
            new Date(b.submittedAt).getTime()
        );
      let streak = 0;
      let maxStreak = 0;
      let streakUnlockedAt: string | null = null;
      for (const pred of playerPreds) {
        if (pred.correct) {
          streak++;
          if (streak >= 5 && !streakUnlockedAt) {
            streakUnlockedAt = pred.resolvedAt?.toISOString() ?? null;
          }
          if (streak > maxStreak) maxStreak = streak;
        } else {
          streak = 0;
        }
      }
      if (maxStreak >= 5) {
        unlock("prophet", streakUnlockedAt);
      }

      // "Red Mist" — your team got a red card
      for (const evt of allEvents) {
        if (
          evt.eventType === "Card" &&
          evt.detail?.toLowerCase().includes("red") &&
          teamIds.includes(evt.teamId)
        ) {
          unlock("red_mist", evt.createdAt?.toISOString() ?? null);
          break;
        }
      }

      // "Swept" — all your teams won on the same match day
      if (teamIds.length > 0) {
        const matchesByDate: Record<string, typeof finishedMatches> = {};
        for (const m of finishedMatches) {
          const date = matchDate(m);
          if (!date) continue;
          // Check if any of this player's teams played
          if (
            teamIds.includes(m.homeTeamId) ||
            teamIds.includes(m.awayTeamId)
          ) {
            if (!matchesByDate[date]) matchesByDate[date] = [];
            matchesByDate[date].push(m);
          }
        }
        for (const [date, dayMatches] of Object.entries(matchesByDate)) {
          // Find which of player's teams played this day
          const teamsPlayingToday = new Set<number>();
          for (const m of dayMatches) {
            if (teamIds.includes(m.homeTeamId))
              teamsPlayingToday.add(m.homeTeamId);
            if (teamIds.includes(m.awayTeamId))
              teamsPlayingToday.add(m.awayTeamId);
          }
          if (teamsPlayingToday.size < 2) continue; // Need at least 2 teams playing
          // Check all won
          let allWon = true;
          for (const tid of teamsPlayingToday) {
            const teamMatch = dayMatches.find(
              (m) => m.homeTeamId === tid || m.awayTeamId === tid
            );
            if (!teamMatch) {
              allWon = false;
              break;
            }
            const isHome = teamMatch.homeTeamId === tid;
            const teamScore = isHome
              ? teamMatch.homeScore!
              : teamMatch.awayScore!;
            const oppScore = isHome
              ? teamMatch.awayScore!
              : teamMatch.homeScore!;
            if (teamScore <= oppScore) {
              allWon = false;
              break;
            }
          }
          if (allWon) {
            const matchTime =
              dayMatches[dayMatches.length - 1]?.kickoff?.toISOString() ?? null;
            unlock("swept", matchTime);
          }
        }
      }

      // "Perfect Day" — earned 10+ points in a single match day
      const pointsByDate: Record<string, { total: number; at: string | null }> =
        {};
      for (const pt of playerPoints) {
        if (!pt.matchId) continue;
        const m = allMatches.find((m) => m.id === pt.matchId);
        if (!m) continue;
        const date = matchDate(m);
        if (!date) continue;
        if (!pointsByDate[date])
          pointsByDate[date] = { total: 0, at: null };
        pointsByDate[date].total += pt.points;
        if (!pointsByDate[date].at)
          pointsByDate[date].at = pt.createdAt?.toISOString() ?? null;
      }
      for (const [, val] of Object.entries(pointsByDate)) {
        if (val.total >= 10) {
          unlock("perfect_day", val.at);
        }
      }

      // "Century Club" — reached 100 total points
      const totalPlayerPoints = playerPoints.reduce(
        (s, p) => s + p.points,
        0
      );
      if (totalPlayerPoints >= 100) {
        // Approximate unlock time: last point entry
        const sorted = [...playerPoints].sort(
          (a, b) =>
            new Date(a.createdAt ?? 0).getTime() -
            new Date(b.createdAt ?? 0).getTime()
        );
        let runningTotal = 0;
        for (const pt of sorted) {
          runningTotal += pt.points;
          if (runningTotal >= 100) {
            unlock("century_club", pt.createdAt?.toISOString() ?? null);
            break;
          }
        }
      }

      return {
        playerId: player.id,
        playerName: player.name,
        slug: player.slug,
        color: player.color ?? "#ffffff",
        avatarEmoji: player.avatarEmoji ?? "",
        achievements,
      };
    });

    // "First Blood" — global: first player to earn any points
    if (allPoints.length > 0) {
      const earliest = [...allPoints].sort(
        (a, b) =>
          new Date(a.createdAt ?? 0).getTime() -
          new Date(b.createdAt ?? 0).getTime()
      )[0];
      const winner = result.find((r) => r.playerId === earliest.playerId);
      if (winner) {
        const a = winner.achievements.find((a) => a.id === "first_blood");
        if (a) a.unlockedAt = earliest.createdAt?.toISOString() ?? null;
      }
    }

    // "Clean Sheet King" — global: player with most clean sheets
    const cleanSheetsByPlayer: Record<number, { count: number; at: string | null }> = {};
    for (const m of finishedMatches) {
      if (m.homeScore === null || m.awayScore === null) continue;
      // Home clean sheet
      if (m.awayScore === 0 && m.homeScore > 0) {
        const assign = allAssignments.find(
          (a) => a.teamId === m.homeTeamId
        );
        if (assign) {
          if (!cleanSheetsByPlayer[assign.playerId])
            cleanSheetsByPlayer[assign.playerId] = { count: 0, at: null };
          cleanSheetsByPlayer[assign.playerId].count++;
          if (!cleanSheetsByPlayer[assign.playerId].at)
            cleanSheetsByPlayer[assign.playerId].at =
              m.kickoff?.toISOString() ?? null;
        }
      }
      // Away clean sheet
      if (m.homeScore === 0 && m.awayScore > 0) {
        const assign = allAssignments.find(
          (a) => a.teamId === m.awayTeamId
        );
        if (assign) {
          if (!cleanSheetsByPlayer[assign.playerId])
            cleanSheetsByPlayer[assign.playerId] = { count: 0, at: null };
          cleanSheetsByPlayer[assign.playerId].count++;
          if (!cleanSheetsByPlayer[assign.playerId].at)
            cleanSheetsByPlayer[assign.playerId].at =
              m.kickoff?.toISOString() ?? null;
        }
      }
    }
    let maxCS = 0;
    let csWinnerId: number | null = null;
    for (const [pid, data] of Object.entries(cleanSheetsByPlayer)) {
      if (data.count > maxCS) {
        maxCS = data.count;
        csWinnerId = parseInt(pid);
      }
    }
    if (csWinnerId !== null && maxCS > 0) {
      const winner = result.find((r) => r.playerId === csWinnerId);
      if (winner) {
        const a = winner.achievements.find(
          (a) => a.id === "clean_sheet_king"
        );
        if (a)
          a.unlockedAt =
            cleanSheetsByPlayer[csWinnerId]?.at ?? null;
      }
    }

    // "Underdog Whisperer" — global: highest total points from Tier 4 teams
    let maxT4 = 0;
    let t4WinnerId: number | null = null;
    let t4WinnerAt: string | null = null;
    for (const player of allPlayers) {
      const teamIds = getPlayerTeamIds(player.id);
      const t4Teams = teamIds.filter((tid) => getTeamTier(tid) === 4);
      if (t4Teams.length === 0) continue;
      const t4Points = allPoints
        .filter(
          (p) => p.playerId === player.id && t4Teams.includes(p.teamId)
        )
        .reduce((s, p) => s + p.points, 0);
      if (t4Points > maxT4) {
        maxT4 = t4Points;
        t4WinnerId = player.id;
        const latest = allPoints
          .filter(
            (p) => p.playerId === player.id && t4Teams.includes(p.teamId)
          )
          .sort(
            (a, b) =>
              new Date(b.createdAt ?? 0).getTime() -
              new Date(a.createdAt ?? 0).getTime()
          )[0];
        t4WinnerAt = latest?.createdAt?.toISOString() ?? null;
      }
    }
    if (t4WinnerId !== null && maxT4 > 0) {
      const winner = result.find((r) => r.playerId === t4WinnerId);
      if (winner) {
        const a = winner.achievements.find(
          (a) => a.id === "underdog_whisperer"
        );
        if (a) a.unlockedAt = t4WinnerAt;
      }
    }

    // "Last Man Standing" — global: if only one player has teams still alive
    const playersWithAlive = allPlayers.filter((player) => {
      const teamIds = getPlayerTeamIds(player.id);
      return teamIds.some((tid) => {
        const team = allTeams.find((t) => t.id === tid);
        return team && !team.eliminated;
      });
    });
    if (playersWithAlive.length === 1) {
      const winner = result.find(
        (r) => r.playerId === playersWithAlive[0].id
      );
      if (winner) {
        const a = winner.achievements.find(
          (a) => a.id === "last_man_standing"
        );
        if (a) a.unlockedAt = new Date().toISOString();
      }
    }

    return NextResponse.json({ players: result });
  } catch (err) {
    console.error("[Achievements]", err);
    return NextResponse.json(
      { error: "Failed to compute achievements" },
      { status: 500 }
    );
  }
}
