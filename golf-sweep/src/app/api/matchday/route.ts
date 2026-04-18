import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { sql } from "drizzle-orm";
import {
  generateBingoCard,
  draftBlocks,
  scorePrediction,
  scoreBingo,
} from "@/lib/matchday";

export const dynamic = "force-dynamic";

/**
 * GET /api/matchday — full game state for the current match.
 * Returns match, players, predictions, bingo cards, blocks, events, scores.
 */
export async function GET() {
  try {
    await ensureTables();

    // Get the most recent match
    const matches = await db.execute(
      sql`SELECT * FROM football_matches ORDER BY id DESC LIMIT 1`
    );
    const match = Array.from(matches as Iterable<Record<string, unknown>>)?.[0] as Record<string, unknown> | undefined;
    if (!match) {
      return NextResponse.json({ match: null });
    }

    const matchId = Number(match.id);

    const playersResult = await db.execute(
      sql`SELECT * FROM football_players WHERE match_id = ${matchId} ORDER BY id`
    );
    const players = Array.from(playersResult as Iterable<Record<string, unknown>>) as Array<Record<string, unknown>>;

    const predsResult = await db.execute(
      sql`SELECT * FROM football_predictions WHERE match_id = ${matchId}`
    );
    const predictions = Array.from(predsResult as Iterable<Record<string, unknown>>) as Array<Record<string, unknown>>;

    const bingoResult = await db.execute(
      sql`SELECT * FROM football_bingo_cards WHERE match_id = ${matchId}`
    );
    const bingoCards = Array.from(bingoResult as Iterable<Record<string, unknown>>) as Array<Record<string, unknown>>;

    const blocksResult = await db.execute(
      sql`SELECT * FROM football_blocks WHERE match_id = ${matchId} ORDER BY block_start`
    );
    const blocks = Array.from(blocksResult as Iterable<Record<string, unknown>>) as Array<Record<string, unknown>>;

    const eventsResult = await db.execute(
      sql`SELECT * FROM football_events WHERE match_id = ${matchId} ORDER BY minute ASC, id ASC`
    );
    const events = Array.from(eventsResult as Iterable<Record<string, unknown>>) as Array<Record<string, unknown>>;

    // Compute scores for each player
    const isFinished = match.status === "finished";
    const actualResults = {
      homeScore: match.final_home_score != null ? Number(match.final_home_score) : null,
      awayScore: match.final_away_score != null ? Number(match.final_away_score) : null,
      firstScorer: match.first_scorer ? String(match.first_scorer) : null,
      firstGoalMinute: match.first_goal_minute != null ? Number(match.first_goal_minute) : null,
      totalCorners: match.total_corners != null ? Number(match.total_corners) : null,
      totalCards: match.total_cards != null ? Number(match.total_cards) : null,
    };

    // Count goals per minute block
    const goalEvents = events.filter(
      (e) => String(e.event_type) === "goal"
    );

    const playerScores = players.map((p) => {
      const pid = Number(p.id);

      // Prediction score
      const pred = predictions.find((pr) => Number(pr.player_id) === pid);
      let predScore = { total: 0 };
      if (pred && isFinished) {
        predScore = scorePrediction(
          {
            predictedHomeScore: pred.predicted_home_score != null ? Number(pred.predicted_home_score) : null,
            predictedAwayScore: pred.predicted_away_score != null ? Number(pred.predicted_away_score) : null,
            firstScorer: pred.first_scorer ? String(pred.first_scorer) : null,
            firstGoalMinute: pred.first_goal_minute != null ? Number(pred.first_goal_minute) : null,
            totalCorners: pred.total_corners != null ? Number(pred.total_corners) : null,
            totalCards: pred.total_cards != null ? Number(pred.total_cards) : null,
          },
          actualResults
        );
      }

      // Bingo score
      const bingoCard = bingoCards.find((b) => Number(b.player_id) === pid);
      const squares = bingoCard?.squares
        ? (typeof bingoCard.squares === "string"
            ? JSON.parse(bingoCard.squares as string)
            : bingoCard.squares) as Array<{ key: string; text: string; marked: boolean }>
        : [];
      const bingoScore = scoreBingo(squares);

      // Block score
      const playerBlocks = blocks.filter((b) => Number(b.player_id) === pid);
      let blockGoals = 0;
      for (const b of playerBlocks) {
        const start = Number(b.block_start);
        const end = Number(b.block_end);
        blockGoals += goalEvents.filter((g) => {
          const min = Number(g.minute);
          return min >= start && min <= end;
        }).length;
      }

      return {
        playerId: pid,
        playerName: String(p.name),
        playerEmoji: String(p.emoji ?? ""),
        playerColor: String(p.color ?? "#10b981"),
        predictionPoints: predScore.total,
        bingoPoints: bingoScore.total,
        bingoSquaresMarked: bingoScore.squares,
        bingoLines: bingoScore.lines,
        bingoFullHouse: bingoScore.fullHouse,
        blockGoals,
        blockPoints: blockGoals * 5,
        totalPoints:
          predScore.total + bingoScore.total + blockGoals * 5,
      };
    });

    playerScores.sort((a, b) => b.totalPoints - a.totalPoints);

    return NextResponse.json({
      match: {
        id: matchId,
        homeTeam: match.home_team,
        awayTeam: match.away_team,
        matchDate: match.match_date,
        venue: match.venue,
        status: match.status,
        finalHomeScore: match.final_home_score,
        finalAwayScore: match.final_away_score,
        firstScorer: match.first_scorer,
        firstGoalMinute: match.first_goal_minute,
        totalCorners: match.total_corners,
        totalCards: match.total_cards,
        currentMinute: match.current_minute,
      },
      players: players.map((p) => ({
        id: Number(p.id),
        name: String(p.name),
        emoji: String(p.emoji ?? ""),
        color: String(p.color ?? "#10b981"),
      })),
      predictions: predictions.map((p) => ({
        playerId: Number(p.player_id),
        predictedHomeScore: p.predicted_home_score,
        predictedAwayScore: p.predicted_away_score,
        firstScorer: p.first_scorer,
        firstGoalMinute: p.first_goal_minute,
        totalCorners: p.total_corners,
        totalCards: p.total_cards,
      })),
      bingoCards: bingoCards.map((b) => ({
        playerId: Number(b.player_id),
        squares:
          typeof b.squares === "string"
            ? JSON.parse(b.squares as string)
            : b.squares,
      })),
      blocks: blocks.map((b) => ({
        playerId: Number(b.player_id),
        label: String(b.block_label),
        start: Number(b.block_start),
        end: Number(b.block_end),
      })),
      events: events.map((e) => ({
        id: Number(e.id),
        type: String(e.event_type),
        minute: Number(e.minute),
        detail: e.detail ? String(e.detail) : null,
        team: e.team ? String(e.team) : null,
      })),
      scores: playerScores,
    });
  } catch (error) {
    console.error("[Matchday GET]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/matchday — create a match, generate bingo cards + draft blocks.
 * Body: { homeTeam, awayTeam, matchDate, venue, players: [{ name, emoji, color }] }
 */
export async function POST(request: NextRequest) {
  try {
    await ensureTables();
    const body = await request.json();
    const { homeTeam, awayTeam, matchDate, venue, players: playerList } = body;

    if (!homeTeam || !awayTeam || !playerList?.length) {
      return NextResponse.json(
        { error: "homeTeam, awayTeam, and players[] are required" },
        { status: 400 }
      );
    }

    // Create match
    const matchResult = await db.execute(
      sql`INSERT INTO football_matches (home_team, away_team, match_date, venue)
          VALUES (${homeTeam}, ${awayTeam}, ${matchDate ?? new Date().toISOString()}, ${venue ?? null})
          RETURNING id`
    );
    const matchId = Number(Array.from(matchResult as Iterable<Record<string, unknown>>)[0].id);

    // Create players
    const playerIds: number[] = [];
    for (const p of playerList) {
      const result = await db.execute(
        sql`INSERT INTO football_players (match_id, name, emoji, color)
            VALUES (${matchId}, ${p.name}, ${p.emoji ?? "⚽"}, ${p.color ?? "#10b981"})
            RETURNING id`
      );
      playerIds.push(Number(Array.from(result as Iterable<Record<string, unknown>>)[0].id));
    }

    // Generate bingo cards for each player
    for (const pid of playerIds) {
      const card = generateBingoCard();
      await db.execute(
        sql`INSERT INTO football_bingo_cards (match_id, player_id, squares)
            VALUES (${matchId}, ${pid}, ${JSON.stringify(card)}::jsonb)`
      );
    }

    // Draft minute blocks
    const drafted = draftBlocks(playerIds);
    for (const { playerId, block } of drafted) {
      await db.execute(
        sql`INSERT INTO football_blocks (match_id, player_id, block_label, block_start, block_end)
            VALUES (${matchId}, ${playerId}, ${block.label}, ${block.start}, ${block.end})`
      );
    }

    return NextResponse.json({
      success: true,
      matchId,
      playerIds,
      blocksPerPlayer: drafted.reduce(
        (acc, d) => {
          const name = playerList[playerIds.indexOf(d.playerId)]?.name ?? "?";
          if (!acc[name]) acc[name] = [];
          acc[name].push(d.block.label);
          return acc;
        },
        {} as Record<string, string[]>
      ),
    });
  } catch (error) {
    console.error("[Matchday POST]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
