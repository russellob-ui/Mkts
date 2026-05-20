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
  chatMessages,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";

let tablesEnsured = false;

interface Award {
  name: string;
  emoji: string;
  winnerId: number | null;
  winnerName: string | null;
  value: string;
  description: string;
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
    const allChat = await db.select().from(chatMessages);

    const teamById = new Map(allTeams.map((t) => [t.id, t]));
    const playerById = new Map(allPlayers.map((p) => [p.id, p]));

    // Build assignment map: teamId -> playerId
    const teamOwner = new Map<number, number>();
    for (const a of allAssignments) {
      teamOwner.set(a.teamId, a.playerId);
    }

    // Player teams map: playerId -> teamId[]
    const playerTeams = new Map<number, number[]>();
    for (const a of allAssignments) {
      const existing = playerTeams.get(a.playerId) ?? [];
      existing.push(a.teamId);
      playerTeams.set(a.playerId, existing);
    }

    const awards: Award[] = [];

    // ---- Champion: most total points ----
    const playerTotalPoints = new Map<number, number>();
    for (const p of allPoints) {
      playerTotalPoints.set(
        p.playerId,
        (playerTotalPoints.get(p.playerId) ?? 0) + p.points
      );
    }

    let championId: number | null = null;
    let championPts = -Infinity;
    for (const [pid, pts] of playerTotalPoints) {
      if (pts > championPts) {
        championPts = pts;
        championId = pid;
      }
    }
    awards.push({
      name: "Champion",
      emoji: "🏆",
      winnerId: championId,
      winnerName: championId ? playerById.get(championId)?.name ?? null : null,
      value: championPts > -Infinity ? `${Math.round(championPts * 10) / 10} pts` : "N/A",
      description: "Player with the most total sweep points",
    });

    // ---- Golden Touch: player whose teams scored the most combined goals ----
    // Count goals per team from events
    const teamGoals = new Map<number, number>();
    for (const e of allEvents) {
      if (e.eventType === "Goal") {
        teamGoals.set(e.teamId, (teamGoals.get(e.teamId) ?? 0) + 1);
      }
    }
    // Fallback: count from match scores if no events yet
    if (teamGoals.size === 0) {
      for (const m of allMatches) {
        if (m.status === "finished") {
          if (m.homeScore != null) {
            teamGoals.set(
              m.homeTeamId,
              (teamGoals.get(m.homeTeamId) ?? 0) + m.homeScore
            );
          }
          if (m.awayScore != null) {
            teamGoals.set(
              m.awayTeamId,
              (teamGoals.get(m.awayTeamId) ?? 0) + m.awayScore
            );
          }
        }
      }
    }

    let goldenTouchId: number | null = null;
    let goldenTouchGoals = -1;
    for (const [pid, teamIds] of playerTeams) {
      const totalGoals = teamIds.reduce(
        (sum, tid) => sum + (teamGoals.get(tid) ?? 0),
        0
      );
      if (totalGoals > goldenTouchGoals) {
        goldenTouchGoals = totalGoals;
        goldenTouchId = pid;
      }
    }
    awards.push({
      name: "Golden Touch",
      emoji: "✨",
      winnerId: goldenTouchId,
      winnerName: goldenTouchId
        ? playerById.get(goldenTouchId)?.name ?? null
        : null,
      value:
        goldenTouchGoals >= 0
          ? `${goldenTouchGoals} goals`
          : "N/A",
      description:
        "Player whose teams scored the most combined goals",
    });

    // ---- Iron Curtain: most clean sheets ----
    // Count clean sheets per team from finished matches
    const teamCleanSheets = new Map<number, number>();
    for (const m of allMatches) {
      if (m.status === "finished") {
        if (m.awayScore === 0 && (m.homeScore ?? 0) > 0) {
          teamCleanSheets.set(
            m.homeTeamId,
            (teamCleanSheets.get(m.homeTeamId) ?? 0) + 1
          );
        }
        if (m.homeScore === 0 && (m.awayScore ?? 0) > 0) {
          teamCleanSheets.set(
            m.awayTeamId,
            (teamCleanSheets.get(m.awayTeamId) ?? 0) + 1
          );
        }
      }
    }

    let ironCurtainId: number | null = null;
    let ironCurtainCS = -1;
    for (const [pid, teamIds] of playerTeams) {
      const totalCS = teamIds.reduce(
        (sum, tid) => sum + (teamCleanSheets.get(tid) ?? 0),
        0
      );
      if (totalCS > ironCurtainCS) {
        ironCurtainCS = totalCS;
        ironCurtainId = pid;
      }
    }
    awards.push({
      name: "Iron Curtain",
      emoji: "🧱",
      winnerId: ironCurtainId,
      winnerName: ironCurtainId
        ? playerById.get(ironCurtainId)?.name ?? null
        : null,
      value:
        ironCurtainCS >= 0
          ? `${ironCurtainCS} clean sheets`
          : "N/A",
      description:
        "Player whose teams had the most clean sheets",
    });

    // ---- Lucky Draw: most points from underdogs (tier 3 + tier 4 teams) ----
    let luckyDrawId: number | null = null;
    let luckyDrawPts = -Infinity;
    for (const [pid, teamIds] of playerTeams) {
      const underdogTeamIds = teamIds.filter((tid) => {
        const t = teamById.get(tid);
        return t && t.tier >= 3;
      });
      const pts = allPoints
        .filter(
          (p) => p.playerId === pid && underdogTeamIds.includes(p.teamId)
        )
        .reduce((sum, p) => sum + p.points, 0);
      if (pts > luckyDrawPts) {
        luckyDrawPts = pts;
        luckyDrawId = pid;
      }
    }
    awards.push({
      name: "Lucky Draw",
      emoji: "🍀",
      winnerId: luckyDrawId,
      winnerName: luckyDrawId
        ? playerById.get(luckyDrawId)?.name ?? null
        : null,
      value:
        luckyDrawPts > -Infinity
          ? `${Math.round(luckyDrawPts * 10) / 10} pts from underdogs`
          : "N/A",
      description:
        "Best value from the draw — most points from underdog teams",
    });

    // ---- Wooden Spoon: fewest total points ----
    let spoonId: number | null = null;
    let spoonPts = Infinity;
    for (const p of allPlayers) {
      const pts = playerTotalPoints.get(p.id) ?? 0;
      if (pts < spoonPts) {
        spoonPts = pts;
        spoonId = p.id;
      }
    }
    awards.push({
      name: "Wooden Spoon",
      emoji: "🥄",
      winnerId: spoonId,
      winnerName: spoonId ? playerById.get(spoonId)?.name ?? null : null,
      value:
        spoonPts < Infinity
          ? `${Math.round(spoonPts * 10) / 10} pts`
          : "N/A",
      description: "Player with the fewest total sweep points",
    });

    // ---- Prophet: highest prediction accuracy ----
    let prophetId: number | null = null;
    let prophetAccuracy = -1;
    let prophetCount = 0;
    for (const p of allPlayers) {
      const playerPreds = allPredictions.filter(
        (pr) => pr.playerId === p.id && pr.resolved
      );
      if (playerPreds.length === 0) continue;
      const correct = playerPreds.filter((pr) => pr.correct).length;
      const accuracy = correct / playerPreds.length;
      if (
        accuracy > prophetAccuracy ||
        (accuracy === prophetAccuracy && playerPreds.length > prophetCount)
      ) {
        prophetAccuracy = accuracy;
        prophetId = p.id;
        prophetCount = playerPreds.length;
      }
    }
    awards.push({
      name: "Prophet",
      emoji: "🔮",
      winnerId: prophetId,
      winnerName: prophetId
        ? playerById.get(prophetId)?.name ?? null
        : null,
      value:
        prophetAccuracy >= 0
          ? `${Math.round(prophetAccuracy * 100)}% (${prophetCount} resolved)`
          : "N/A",
      description: "Highest prediction accuracy",
    });

    // ---- Chatty: most chat messages ----
    const chatCount = new Map<number, number>();
    for (const c of allChat) {
      if (c.playerId != null && !c.deletedAt) {
        chatCount.set(c.playerId, (chatCount.get(c.playerId) ?? 0) + 1);
      }
    }
    let chattyId: number | null = null;
    let chattyCount = 0;
    for (const [pid, count] of chatCount) {
      if (count > chattyCount) {
        chattyCount = count;
        chattyId = pid;
      }
    }
    awards.push({
      name: "Chatty",
      emoji: "💬",
      winnerId: chattyId,
      winnerName: chattyId
        ? playerById.get(chattyId)?.name ?? null
        : null,
      value: chattyCount > 0 ? `${chattyCount} messages` : "N/A",
      description: "Most chat messages sent",
    });

    // ---- Best Team: single team with the most points ----
    const teamTotalPoints = new Map<number, number>();
    for (const p of allPoints) {
      teamTotalPoints.set(
        p.teamId,
        (teamTotalPoints.get(p.teamId) ?? 0) + p.points
      );
    }

    let bestTeamId: number | null = null;
    let bestTeamPts = -Infinity;
    for (const [tid, pts] of teamTotalPoints) {
      if (pts > bestTeamPts) {
        bestTeamPts = pts;
        bestTeamId = tid;
      }
    }
    const bestTeam = bestTeamId ? teamById.get(bestTeamId) : null;
    awards.push({
      name: "Best Team",
      emoji: "⭐",
      winnerId: bestTeamId,
      winnerName: bestTeam
        ? `${bestTeam.flagEmoji ?? ""} ${bestTeam.name}`
        : null,
      value:
        bestTeamPts > -Infinity
          ? `${Math.round(bestTeamPts * 10) / 10} pts`
          : "N/A",
      description: "Single team that earned the most sweep points",
    });

    // ---- Worst Team: single team that earned the fewest points (among teams that played) ----
    // Teams that played: appear in at least one finished match
    const teamsPlayed = new Set<number>();
    for (const m of allMatches) {
      if (m.status === "finished") {
        teamsPlayed.add(m.homeTeamId);
        teamsPlayed.add(m.awayTeamId);
      }
    }

    let worstTeamId: number | null = null;
    let worstTeamPts = Infinity;
    for (const tid of teamsPlayed) {
      const pts = teamTotalPoints.get(tid) ?? 0;
      if (pts < worstTeamPts) {
        worstTeamPts = pts;
        worstTeamId = tid;
      }
    }
    const worstTeam = worstTeamId ? teamById.get(worstTeamId) : null;
    awards.push({
      name: "Worst Team",
      emoji: "😭",
      winnerId: worstTeamId,
      winnerName: worstTeam
        ? `${worstTeam.flagEmoji ?? ""} ${worstTeam.name}`
        : null,
      value:
        worstTeamPts < Infinity
          ? `${Math.round(worstTeamPts * 10) / 10} pts`
          : "N/A",
      description:
        "Single team that earned the fewest sweep points (among teams that played)",
    });

    // ---- MVP Match: single match that generated the most total sweep points ----
    const matchTotalPoints = new Map<number, number>();
    for (const p of allPoints) {
      if (p.matchId != null) {
        matchTotalPoints.set(
          p.matchId,
          (matchTotalPoints.get(p.matchId) ?? 0) + Math.abs(p.points)
        );
      }
    }

    let mvpMatchId: number | null = null;
    let mvpMatchPts = -Infinity;
    for (const [mid, pts] of matchTotalPoints) {
      if (pts > mvpMatchPts) {
        mvpMatchPts = pts;
        mvpMatchId = mid;
      }
    }
    let mvpMatchName: string | null = null;
    if (mvpMatchId != null) {
      const m = allMatches.find((m) => m.id === mvpMatchId);
      if (m) {
        const home = teamById.get(m.homeTeamId);
        const away = teamById.get(m.awayTeamId);
        mvpMatchName = `${home?.flagEmoji ?? ""} ${home?.name ?? "?"} ${m.homeScore ?? 0} - ${m.awayScore ?? 0} ${away?.name ?? "?"} ${away?.flagEmoji ?? ""}`;
      }
    }
    awards.push({
      name: "MVP Match",
      emoji: "🌟",
      winnerId: mvpMatchId,
      winnerName: mvpMatchName,
      value:
        mvpMatchPts > -Infinity
          ? `${Math.round(mvpMatchPts * 10) / 10} pts generated`
          : "N/A",
      description:
        "Single match that generated the most total sweep points",
    });

    return NextResponse.json({ awards });
  } catch (err) {
    console.error("[Yearbook]", err);
    return NextResponse.json(
      { error: "Failed to compute yearbook awards" },
      { status: 500 }
    );
  }
}
