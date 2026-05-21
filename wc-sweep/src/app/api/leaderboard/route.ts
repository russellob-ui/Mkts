import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  players,
  wcTeams,
  teamAssignments,
  pointsLog,
  matches,
  banterEvents,
  chatMessages,
  quizResults,
  predictions,
} from "@/db/schema";
import { desc, asc, and, gte, lte, gt, isNull, eq } from "drizzle-orm";

let tablesEnsured = false;

function timeAgoStr(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  if (diff < 0) return "just now";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export async function GET() {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // Fetch all core data in parallel
    const [
      allPlayers,
      allTeams,
      allAssignments,
      allPoints,
      allMatches,
      recentBanter,
      recentChat,
      recentQuizResults,
    ] = await Promise.all([
      db.select().from(players),
      db.select().from(wcTeams),
      db.select().from(teamAssignments),
      db.select().from(pointsLog),
      db.select().from(matches).orderBy(asc(matches.kickoff)),
      db
        .select()
        .from(banterEvents)
        .orderBy(desc(banterEvents.createdAt))
        .limit(20),
      db
        .select()
        .from(chatMessages)
        .where(isNull(chatMessages.deletedAt))
        .orderBy(desc(chatMessages.createdAt))
        .limit(20),
      db
        .select()
        .from(quizResults)
        .orderBy(desc(quizResults.createdAt))
        .limit(20),
    ]);

    // ----- Build helpers -----
    const teamMap = new Map(allTeams.map((t) => [t.id, t]));
    const playerMap = new Map(allPlayers.map((p) => [p.id, p]));

    // Points that existed 24h ago (for rank comparison)
    const pointsBefore24h = allPoints.filter(
      (p) => p.createdAt && p.createdAt.getTime() <= twentyFourHoursAgo.getTime()
    );

    // Points in last 3 days
    const pointsLast3Days = allPoints.filter(
      (p) => p.createdAt && p.createdAt.getTime() > threeDaysAgo.getTime()
    );

    // First point date (for daily average calculation)
    const firstPointDate = allPoints.reduce(
      (min, p) =>
        p.createdAt && p.createdAt.getTime() < min ? p.createdAt.getTime() : min,
      Date.now()
    );
    const totalDays = Math.max(
      1,
      Math.ceil((Date.now() - firstPointDate) / (24 * 60 * 60 * 1000))
    );

    // Helper: classify point source
    function classifySource(source: string) {
      if (
        source.startsWith("match_") ||
        source === "clean_sheet" ||
        source === "goals_bonus" ||
        source.startsWith("advance_")
      )
        return "game";
      if (source.startsWith("prediction")) return "prediction";
      if (source === "quiz") return "quiz";
      if (source === "prop") return "prop";
      return "other";
    }

    // ----- Compute old rankings (24h ago) -----
    const oldTotalsByPlayer = new Map<number, number>();
    for (const p of pointsBefore24h) {
      oldTotalsByPlayer.set(
        p.playerId,
        (oldTotalsByPlayer.get(p.playerId) ?? 0) + p.points
      );
    }
    const oldRanks = [...oldTotalsByPlayer.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([pid], i) => ({ pid, rank: i + 1 }));
    const oldRankMap = new Map(oldRanks.map((r) => [r.pid, r.rank]));

    // ----- Build leaderboard -----
    const leaderboard = allPlayers
      .map((player) => {
        const playerAssignments = allAssignments.filter(
          (a) => a.playerId === player.id
        );
        const playerPoints = allPoints.filter(
          (p) => p.playerId === player.id
        );

        // Points breakdown
        let gamePoints = 0;
        let predictionPoints = 0;
        let quizPoints = 0;
        let propPoints = 0;
        let otherPoints = 0;
        let totalPoints = 0;

        for (const p of playerPoints) {
          const cat = classifySource(p.source);
          const pts = p.points;
          totalPoints += pts;
          if (cat === "game") gamePoints += pts;
          else if (cat === "prediction") predictionPoints += pts;
          else if (cat === "quiz") quizPoints += pts;
          else if (cat === "prop") propPoints += pts;
          else otherPoints += pts;
        }

        // Round all values
        const round1 = (n: number) => Math.round(n * 10) / 10;
        totalPoints = round1(totalPoints);
        gamePoints = round1(gamePoints);
        predictionPoints = round1(predictionPoints);
        quizPoints = round1(quizPoints);
        propPoints = round1(propPoints);
        otherPoints = round1(otherPoints);

        // Teams alive
        const teamsAlive = playerAssignments.filter((a) => {
          const team = teamMap.get(a.teamId);
          return team && !team.eliminated;
        }).length;
        const teamsTotal = playerAssignments.length;

        // Trend: daily avg last 3 days vs overall
        const last3DaysPts = pointsLast3Days
          .filter((p) => p.playerId === player.id)
          .reduce((s, p) => s + p.points, 0);
        const last3DaysAvg = last3DaysPts / 3;
        const overallAvg = totalPoints / totalDays;

        let trend: "hot" | "cold" | "steady" = "steady";
        if (overallAvg > 0 && last3DaysAvg > overallAvg * 1.1) trend = "hot";
        else if (overallAvg > 0 && last3DaysAvg < overallAvg * 0.9)
          trend = "cold";

        return {
          playerId: player.id,
          playerName: player.name,
          playerSlug: player.slug,
          avatarEmoji: player.avatarEmoji,
          color: player.color ?? "#ffffff",
          gamePoints,
          predictionPoints,
          quizPoints,
          propPoints,
          otherPoints,
          totalPoints,
          teamsAlive,
          teamsTotal,
          rankChange: 0, // computed after sort
          trend,
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);

    // Compute rankChange after sorting
    leaderboard.forEach((entry, i) => {
      const currentRank = i + 1;
      const oldRank = oldRankMap.get(entry.playerId);
      if (oldRank != null) {
        entry.rankChange = oldRank - currentRank; // positive = moved up
      } else {
        entry.rankChange = 0;
      }
    });

    // ----- Today's matches -----
    const todayMatches = allMatches
      .filter((m) => {
        const ko = m.kickoff;
        return ko >= todayStart && ko <= todayEnd;
      })
      .map((m) => {
        const home = teamMap.get(m.homeTeamId);
        const away = teamMap.get(m.awayTeamId);
        const homeAssign = allAssignments.find(
          (a) => a.teamId === m.homeTeamId
        );
        const awayAssign = allAssignments.find(
          (a) => a.teamId === m.awayTeamId
        );
        const homeOwner = homeAssign
          ? playerMap.get(homeAssign.playerId)?.name ?? null
          : null;
        const awayOwner = awayAssign
          ? playerMap.get(awayAssign.playerId)?.name ?? null
          : null;
        return {
          id: m.id,
          homeTeam: home?.name ?? "?",
          awayTeam: away?.name ?? "?",
          homeFlag: home?.flagEmoji ?? "🏳️",
          awayFlag: away?.flagEmoji ?? "🏳️",
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          status: m.status,
          minute: m.minute,
          kickoff: m.kickoff?.toISOString() ?? "",
          homeOwner,
          awayOwner,
          stage: m.stage,
          venue: m.venue,
          city: m.city,
        };
      })
      .sort(
        (a, b) =>
          new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
      );

    // ----- Next match -----
    const upcomingMatches = allMatches
      .filter((m) => m.status === "scheduled" && m.kickoff > now)
      .sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());

    let nextMatch: {
      homeTeam: string;
      homeFlag: string;
      awayTeam: string;
      awayFlag: string;
      kickoff: string;
      homeOwner: string | null;
      awayOwner: string | null;
      stage: string;
    } | null = null;

    if (upcomingMatches.length > 0) {
      const nm = upcomingMatches[0];
      const home = teamMap.get(nm.homeTeamId);
      const away = teamMap.get(nm.awayTeamId);
      const homeAssign = allAssignments.find((a) => a.teamId === nm.homeTeamId);
      const awayAssign = allAssignments.find((a) => a.teamId === nm.awayTeamId);
      nextMatch = {
        homeTeam: home?.name ?? "?",
        homeFlag: home?.flagEmoji ?? "🏳️",
        awayTeam: away?.name ?? "?",
        awayFlag: away?.flagEmoji ?? "🏳️",
        kickoff: nm.kickoff.toISOString(),
        homeOwner: homeAssign
          ? playerMap.get(homeAssign.playerId)?.name ?? null
          : null,
        awayOwner: awayAssign
          ? playerMap.get(awayAssign.playerId)?.name ?? null
          : null,
        stage: nm.stage,
      };
    }

    // ----- Live match -----
    const liveMatchRow = allMatches.find((m) => m.status === "live");
    let liveMatch: {
      id: number;
      homeTeam: string;
      homeFlag: string;
      awayTeam: string;
      awayFlag: string;
      homeScore: number;
      awayScore: number;
      minute: number;
      homeOwner: string | null;
      awayOwner: string | null;
    } | null = null;

    if (liveMatchRow) {
      const home = teamMap.get(liveMatchRow.homeTeamId);
      const away = teamMap.get(liveMatchRow.awayTeamId);
      const homeAssign = allAssignments.find(
        (a) => a.teamId === liveMatchRow.homeTeamId
      );
      const awayAssign = allAssignments.find(
        (a) => a.teamId === liveMatchRow.awayTeamId
      );
      liveMatch = {
        id: liveMatchRow.id,
        homeTeam: home?.name ?? "?",
        homeFlag: home?.flagEmoji ?? "🏳️",
        awayTeam: away?.name ?? "?",
        awayFlag: away?.flagEmoji ?? "🏳️",
        homeScore: liveMatchRow.homeScore ?? 0,
        awayScore: liveMatchRow.awayScore ?? 0,
        minute: liveMatchRow.minute ?? 0,
        homeOwner: homeAssign
          ? playerMap.get(homeAssign.playerId)?.name ?? null
          : null,
        awayOwner: awayAssign
          ? playerMap.get(awayAssign.playerId)?.name ?? null
          : null,
      };
    }

    // ----- Today points by player -----
    const todayPoints = allPoints.filter(
      (p) => p.createdAt && p.createdAt >= todayStart && p.createdAt <= todayEnd
    );
    const todayByPlayer = new Map<number, number>();
    for (const p of todayPoints) {
      todayByPlayer.set(
        p.playerId,
        (todayByPlayer.get(p.playerId) ?? 0) + p.points
      );
    }
    const todayPointsByPlayer = [...todayByPlayer.entries()]
      .map(([pid, pts]) => ({
        playerId: pid,
        playerName: playerMap.get(pid)?.name ?? "Unknown",
        points: Math.round(pts * 10) / 10,
      }))
      .sort((a, b) => b.points - a.points);

    // ----- Featured stat (rotates hourly) -----
    const hour = now.getHours();
    const statCandidates: Array<{ emoji: string; text: string }> = [];

    // Best defence
    for (const player of allPlayers) {
      const pAssignments = allAssignments.filter(
        (a) => a.playerId === player.id
      );
      const aliveTeams = pAssignments
        .map((a) => teamMap.get(a.teamId))
        .filter((t) => t && !t.eliminated);

      for (const team of aliveTeams) {
        if (!team) continue;
        // Count clean sheets from points
        const cleanSheets = allPoints.filter(
          (p) =>
            p.playerId === player.id &&
            p.teamId === team.id &&
            p.source === "clean_sheet"
        ).length;
        if (cleanSheets >= 2) {
          statCandidates.push({
            emoji: "🧤",
            text: `${player.name}'s ${team.name}: ${cleanSheets} clean sheets`,
          });
        }
      }
    }

    // Most predictions correct
    for (const player of allPlayers) {
      const predPts = allPoints.filter(
        (p) => p.playerId === player.id && p.source.startsWith("prediction")
      );
      if (predPts.length >= 3) {
        statCandidates.push({
          emoji: "🎯",
          text: `${player.name} has nailed ${predPts.length} predictions`,
        });
      }
    }

    // Zero teams alive
    for (const entry of leaderboard) {
      if (entry.teamsTotal > 0 && entry.teamsAlive === 0) {
        statCandidates.push({
          emoji: "💨",
          text: `${entry.playerName} has 0 teams left alive`,
        });
      }
    }

    // Leader's total
    if (leaderboard.length >= 2) {
      const gap =
        leaderboard[0].totalPoints - leaderboard[1].totalPoints;
      if (gap > 0) {
        statCandidates.push({
          emoji: "👑",
          text: `${leaderboard[0].playerName} leads by ${Math.round(gap * 10) / 10} points`,
        });
      }
    }

    // Hot streak
    for (const entry of leaderboard) {
      if (entry.trend === "hot") {
        statCandidates.push({
          emoji: "🔥",
          text: `${entry.playerName} is on fire! Hot streak in the last 3 days`,
        });
      }
    }

    let featuredStat: { emoji: string; text: string } | null = null;
    if (statCandidates.length > 0) {
      featuredStat = statCandidates[hour % statCandidates.length];
    }

    // ----- Recent activity feed -----
    type ActivityItem = {
      type: "banter" | "chat" | "prediction" | "quiz";
      emoji: string;
      text: string;
      timeAgo: string;
      sortTime: number;
    };

    const activityItems: ActivityItem[] = [];

    // Banter events
    for (const evt of recentBanter.slice(0, 10)) {
      activityItems.push({
        type: "banter",
        emoji: evt.emoji ?? "📢",
        text: evt.headline,
        timeAgo: timeAgoStr(evt.createdAt),
        sortTime: evt.createdAt.getTime(),
      });
    }

    // Chat messages (exclude trash_talk context)
    for (const msg of recentChat) {
      if (msg.contextType === "trash_talk") continue;
      activityItems.push({
        type: "chat",
        emoji: "💬",
        text: `${msg.playerNameSnapshot}: ${msg.body.length > 60 ? msg.body.slice(0, 60) + "..." : msg.body}`,
        timeAgo: timeAgoStr(msg.createdAt),
        sortTime: msg.createdAt.getTime(),
      });
    }

    // Quiz completions
    for (const qr of recentQuizResults) {
      const p = playerMap.get(qr.playerId);
      activityItems.push({
        type: "quiz",
        emoji: "🧠",
        text: `${p?.name ?? "Someone"} scored ${qr.score}/5 on the quiz`,
        timeAgo: timeAgoStr(qr.createdAt),
        sortTime: qr.createdAt.getTime(),
      });
    }

    // Sort by time and take last 10
    const recentActivity = activityItems
      .sort((a, b) => b.sortTime - a.sortTime)
      .slice(0, 10)
      .map(({ sortTime: _sortTime, ...rest }) => rest);

    // ----- Pending actions -----
    const scheduledToday = todayMatches.filter(
      (m) => m.status === "scheduled"
    ).length;

    // Check for today's quiz
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    // Quiz is always available if there are questions (which there always are)
    const quizAvailable = true;

    // Props available if there are scheduled matches today
    const propsAvailable = scheduledToday > 0;

    // ----- Upcoming matches (next 3 after now) -----
    const upcomingNext3 = upcomingMatches.slice(0, 3).map((m) => {
      const home = teamMap.get(m.homeTeamId);
      const away = teamMap.get(m.awayTeamId);
      const homeAssign = allAssignments.find(
        (a) => a.teamId === m.homeTeamId
      );
      const awayAssign = allAssignments.find(
        (a) => a.teamId === m.awayTeamId
      );
      return {
        id: m.id,
        homeTeam: home?.name ?? "?",
        awayTeam: away?.name ?? "?",
        homeFlag: home?.flagEmoji ?? "🏳️",
        awayFlag: away?.flagEmoji ?? "🏳️",
        kickoff: m.kickoff.toISOString(),
        homeOwner: homeAssign
          ? playerMap.get(homeAssign.playerId)?.name ?? null
          : null,
        awayOwner: awayAssign
          ? playerMap.get(awayAssign.playerId)?.name ?? null
          : null,
        stage: m.stage,
        venue: m.venue,
        city: m.city,
      };
    });

    return NextResponse.json({
      leaderboard,
      todayMatches,
      nextMatch,
      liveMatch,
      todayPointsByPlayer,
      featuredStat,
      recentActivity,
      pendingActions: {
        matchesToPredict: scheduledToday,
        quizAvailable,
        propsAvailable,
      },
      upcomingMatches: upcomingNext3,
    });
  } catch (err) {
    console.error("[Leaderboard]", err);
    return NextResponse.json(
      { error: "Failed to load leaderboard" },
      { status: 500 }
    );
  }
}
