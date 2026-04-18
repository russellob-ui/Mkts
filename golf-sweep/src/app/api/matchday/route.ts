import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { sql } from "drizzle-orm";
import {
  getEventDetails,
  getEventIncidents,
  getEventLineups,
  getEventStatistics,
  sofaEventStatus,
  computeElapsedMinute,
  getStatByName,
  type SofaEvent,
  type SofaIncident,
  type SofaLineup,
  type SofaStatItem,
} from "@/lib/football-api";
import {
  generateBingoCard,
  draftBlocks,
  scorePrediction,
  scoreBingo,
  autoBingoCheck,
} from "@/lib/matchday";

export const dynamic = "force-dynamic";

// In-memory cache (30s TTL)
let cachedAt = 0;
let cache: {
  event: SofaEvent | null;
  incidents: SofaIncident[];
  lineups: { home: SofaLineup | null; away: SofaLineup | null };
  stats: SofaStatItem[];
} | null = null;
let cachedEventId: number | null = null;
const CACHE_TTL = 30_000;

async function fetchLiveData(eventId: number) {
  const now = Date.now();
  if (cachedEventId === eventId && cache && now - cachedAt < CACHE_TTL) {
    return cache;
  }
  const [event, incidents, lineups, stats] = await Promise.all([
    getEventDetails(eventId),
    getEventIncidents(eventId),
    getEventLineups(eventId),
    getEventStatistics(eventId),
  ]);
  cache = { event, incidents, lineups, stats };
  cachedEventId = eventId;
  cachedAt = now;
  return cache;
}

function rows(r: unknown): Array<Record<string, unknown>> {
  return Array.from(r as Iterable<Record<string, unknown>>);
}

export async function GET() {
  try {
    await ensureTables();
    const matchRows = rows(
      await db.execute(sql`SELECT * FROM football_matches ORDER BY id DESC LIMIT 1`)
    );
    const match = matchRows[0];
    if (!match) return NextResponse.json({ match: null });

    const matchId = Number(match.id);
    const apiEventId = match.api_fixture_id ? Number(match.api_fixture_id) : null;

    const players = rows(await db.execute(sql`SELECT * FROM football_players WHERE match_id = ${matchId} ORDER BY id`));
    const predictions = rows(await db.execute(sql`SELECT * FROM football_predictions WHERE match_id = ${matchId}`));
    const bingoCards = rows(await db.execute(sql`SELECT * FROM football_bingo_cards WHERE match_id = ${matchId}`));
    const blocks = rows(await db.execute(sql`SELECT * FROM football_blocks WHERE match_id = ${matchId} ORDER BY block_start`));

    // Fetch LIVE data from Sofascore
    let event: SofaEvent | null = null;
    let incidents: SofaIncident[] = [];
    let homeLineup: SofaLineup | null = null;
    let awayLineup: SofaLineup | null = null;
    let stats: SofaStatItem[] = [];
    let liveStatus: "upcoming" | "live" | "finished" | "other" = "upcoming";
    let liveMinute: number | null = null;
    let homeScore = 0;
    let awayScore = 0;
    let totalCorners = 0;
    let totalCards = 0;
    let firstScorer: string | null = null;
    let firstGoalMinute: number | null = null;

    if (apiEventId && process.env.RAPIDAPI_KEY) {
      try {
        const live = await fetchLiveData(apiEventId);
        event = live.event;
        incidents = live.incidents;
        homeLineup = live.lineups.home;
        awayLineup = live.lineups.away;
        stats = live.stats;

        if (event) {
          liveStatus = sofaEventStatus(event);
          liveMinute = computeElapsedMinute(event);
          homeScore = event.homeScore?.current ?? 0;
          awayScore = event.awayScore?.current ?? 0;

          const corners = getStatByName(stats, "Corner kicks");
          totalCorners = corners.home + corners.away;
          totalCards = incidents.filter((i) => i.incidentType === "card").length;

          const firstGoal = incidents.find((i) => i.incidentType === "goal" && !i.rescinded);
          if (firstGoal) {
            firstScorer = firstGoal.player?.name ?? firstGoal.player?.shortName ?? null;
            firstGoalMinute = firstGoal.time;
          }
        }
      } catch (err) {
        console.error("[Matchday] Sofascore fetch error:", err);
      }
    }

    // Sync DB state
    if (liveStatus !== "other") {
      await db.execute(
        sql`UPDATE football_matches SET status = ${liveStatus},
            final_home_score = ${homeScore}, final_away_score = ${awayScore},
            total_corners = ${totalCorners}, total_cards = ${totalCards},
            first_scorer = ${firstScorer}, first_goal_minute = ${firstGoalMinute},
            current_minute = ${liveMinute}
          WHERE id = ${matchId}`
      );
    }

    // Goal events for bingo + blocks
    const goalIncidents = incidents.filter((i) => i.incidentType === "goal" && !i.rescinded);
    const cardIncidents = incidents.filter((i) => i.incidentType === "card");
    const subIncidents = incidents.filter((i) => i.incidentType === "substitution");
    const varIncidents = incidents.filter((i) => i.incidentType === "varDecision");

    // Auto-check bingo
    const bingoContext = {
      events: incidents.map((i) => ({
        type: i.incidentType === "goal" ? "Goal" : i.incidentType === "card" ? "Card" : i.incidentType === "substitution" ? "subst" : i.incidentType === "varDecision" ? "Var" : i.incidentType,
        detail: i.incidentClass ?? i.description ?? "",
        time: { elapsed: i.time, extra: i.addedTime ?? null },
        team: { name: i.isHome ? "home" : "away" },
      })),
      goalEvents: goalIncidents.map((i) => ({
        type: "Goal",
        detail: i.incidentClass === "penalty" ? "Penalty" : i.incidentClass === "ownGoal" ? "Own Goal" : "Normal Goal",
        time: { elapsed: i.time, extra: i.addedTime ?? null },
        team: { name: i.isHome ? "home" : "away" },
      })),
      cardEvents: cardIncidents.map((i) => ({
        type: "Card",
        detail: i.incidentClass === "yellow" ? "Yellow Card" : i.incidentClass === "red" ? "Red Card" : i.incidentClass === "yellowRed" ? "Yellow → Red Card" : "Card",
        time: { elapsed: i.time, extra: i.addedTime ?? null },
      })),
      varEvents: varIncidents.map((i) => ({ type: "Var" as const })),
      subEvents: subIncidents.map((i) => ({
        type: "subst" as const,
        time: { elapsed: i.time, extra: i.addedTime ?? null },
      })),
      totalCorners,
      totalCards,
      homeScore,
      awayScore,
      liveMinute: liveMinute ?? 0,
      isFinished: liveStatus === "finished",
    };

    for (const card of bingoCards) {
      const sq = (typeof card.squares === "string" ? JSON.parse(card.squares as string) : card.squares) as Array<{ key: string; text: string; marked: boolean }>;
      const updated = autoBingoCheck(sq, bingoContext);
      if (updated.some((s, i) => s.marked !== sq[i]?.marked)) {
        await db.execute(sql`UPDATE football_bingo_cards SET squares = ${JSON.stringify(updated)}::jsonb WHERE match_id = ${matchId} AND player_id = ${Number(card.player_id)}`);
        card.squares = updated;
      }
    }

    // Compute scores
    const actual = { homeScore, awayScore, firstScorer, firstGoalMinute, totalCorners, totalCards };
    const playerScores = players.map((p) => {
      const pid = Number(p.id);
      const pred = predictions.find((pr) => Number(pr.player_id) === pid);
      let predScore = { total: 0 };
      if (pred && liveStatus === "finished") {
        predScore = scorePrediction({
          predictedHomeScore: pred.predicted_home_score != null ? Number(pred.predicted_home_score) : null,
          predictedAwayScore: pred.predicted_away_score != null ? Number(pred.predicted_away_score) : null,
          firstScorer: pred.first_scorer ? String(pred.first_scorer) : null,
          firstGoalMinute: pred.first_goal_minute != null ? Number(pred.first_goal_minute) : null,
          totalCorners: pred.total_corners != null ? Number(pred.total_corners) : null,
          totalCards: pred.total_cards != null ? Number(pred.total_cards) : null,
        }, actual);
      }

      const bc = bingoCards.find((b) => Number(b.player_id) === pid);
      const sq = bc?.squares ? (typeof bc.squares === "string" ? JSON.parse(bc.squares as string) : bc.squares) as Array<{ key: string; text: string; marked: boolean }> : [];
      const bs = scoreBingo(sq);

      const pb = blocks.filter((b) => Number(b.player_id) === pid);
      let blockGoals = 0;
      for (const b of pb) {
        blockGoals += goalIncidents.filter((g) => g.time >= Number(b.block_start) && g.time <= Number(b.block_end)).length;
      }

      return {
        playerId: pid, playerName: String(p.name), playerEmoji: String(p.emoji ?? ""),
        playerColor: String(p.color ?? "#10b981"),
        predictionPoints: predScore.total, bingoPoints: bs.total,
        bingoSquaresMarked: bs.squares, bingoLines: bs.lines, bingoFullHouse: bs.fullHouse,
        blockGoals, blockPoints: blockGoals * 5,
        totalPoints: predScore.total + bs.total + blockGoals * 5,
      };
    });
    playerScores.sort((a, b) => b.totalPoints - a.totalPoints);

    // Build lineups for response
    const lineupsResponse = [];
    if (homeLineup && event) {
      const starters = homeLineup.players.filter((p) => !p.substitute);
      const subs = homeLineup.players.filter((p) => p.substitute);
      lineupsResponse.push({
        team: event.homeTeam.name, formation: homeLineup.formation,
        startXI: starters.map((p) => ({ name: p.player.shortName || p.player.name, number: p.shirtNumber, pos: p.player.position || p.position })),
        subs: subs.map((p) => ({ name: p.player.shortName || p.player.name, number: p.shirtNumber, pos: p.player.position || p.position })),
      });
    }
    if (awayLineup && event) {
      const starters = awayLineup.players.filter((p) => !p.substitute);
      const subs = awayLineup.players.filter((p) => p.substitute);
      lineupsResponse.push({
        team: event.awayTeam.name, formation: awayLineup.formation,
        startXI: starters.map((p) => ({ name: p.player.shortName || p.player.name, number: p.shirtNumber, pos: p.player.position || p.position })),
        subs: subs.map((p) => ({ name: p.player.shortName || p.player.name, number: p.shirtNumber, pos: p.player.position || p.position })),
      });
    }

    return NextResponse.json({
      match: {
        id: matchId,
        homeTeam: event?.homeTeam.name ?? String(match.home_team),
        awayTeam: event?.awayTeam.name ?? String(match.away_team),
        venue: event?.venue?.stadium?.name ?? match.venue ?? null,
        status: liveStatus, statusLong: event?.status.description ?? String(match.status),
        elapsed: liveMinute, homeScore, awayScore, totalCorners, totalCards,
        firstScorer, firstGoalMinute, apiEventId,
      },
      players: players.map((p) => ({ id: Number(p.id), name: String(p.name), emoji: String(p.emoji ?? ""), color: String(p.color ?? "#10b981") })),
      predictions: predictions.map((p) => ({
        playerId: Number(p.player_id), predictedHomeScore: p.predicted_home_score,
        predictedAwayScore: p.predicted_away_score, firstScorer: p.first_scorer,
        firstGoalMinute: p.first_goal_minute, totalCorners: p.total_corners, totalCards: p.total_cards,
      })),
      bingoCards: bingoCards.map((b) => ({ playerId: Number(b.player_id), squares: typeof b.squares === "string" ? JSON.parse(b.squares as string) : b.squares })),
      blocks: blocks.map((b) => ({ playerId: Number(b.player_id), label: String(b.block_label), start: Number(b.block_start), end: Number(b.block_end) })),
      events: incidents.filter((i) => ["goal", "card", "substitution", "varDecision"].includes(i.incidentType)).map((i) => ({
        minute: i.time, extra: i.addedTime ?? null,
        type: i.incidentType, detail: i.incidentClass ?? i.description ?? "",
        player: i.player?.shortName ?? i.player?.name ?? (i.playerIn ? `${i.playerIn.shortName} on` : ""),
        assist: i.assist1?.shortName ?? null,
        team: i.isHome ? (event?.homeTeam.name ?? "Home") : (event?.awayTeam.name ?? "Away"),
      })),
      lineups: lineupsResponse,
      scores: playerScores,
      cachedAgo: Math.round((Date.now() - cachedAt) / 1000),
    });
  } catch (error) {
    console.error("[Matchday GET]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureTables();
    const { fixtureId, homeTeam, awayTeam, venue, players: playerList } = await request.json();
    if (!playerList?.length) return NextResponse.json({ error: "players[] required" }, { status: 400 });

    const mr = rows(await db.execute(
      sql`INSERT INTO football_matches (home_team, away_team, match_date, venue, api_fixture_id)
          VALUES (${homeTeam ?? "TBD"}, ${awayTeam ?? "TBD"}, ${new Date().toISOString()}, ${venue ?? null}, ${fixtureId ?? null})
          RETURNING id`
    ));
    const matchId = Number(mr[0].id);

    const playerIds: number[] = [];
    for (const p of playerList) {
      const r = rows(await db.execute(
        sql`INSERT INTO football_players (match_id, name, emoji, color) VALUES (${matchId}, ${p.name}, ${p.emoji ?? "⚽"}, ${p.color ?? "#10b981"}) RETURNING id`
      ));
      playerIds.push(Number(r[0].id));
    }

    for (const pid of playerIds) {
      await db.execute(sql`INSERT INTO football_bingo_cards (match_id, player_id, squares) VALUES (${matchId}, ${pid}, ${JSON.stringify(generateBingoCard())}::jsonb)`);
    }

    const drafted = draftBlocks(playerIds);
    for (const { playerId, block } of drafted) {
      await db.execute(sql`INSERT INTO football_blocks (match_id, player_id, block_label, block_start, block_end) VALUES (${matchId}, ${playerId}, ${block.label}, ${block.start}, ${block.end})`);
    }

    return NextResponse.json({ success: true, matchId });
  } catch (error) {
    console.error("[Matchday POST]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
