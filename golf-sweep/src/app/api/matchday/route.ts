import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { sql } from "drizzle-orm";
import {
  getFixtureById,
  getFixtureEvents,
  getFixtureLineups,
  getFixtureStats,
  fixtureStatus,
  getStatValue,
  type Fixture,
  type MatchEvent,
  type TeamLineup,
  type TeamStats,
} from "@/lib/football-api";
import {
  generateBingoCard,
  draftBlocks,
  scorePrediction,
  scoreBingo,
  autoBingoCheck,
} from "@/lib/matchday";

export const dynamic = "force-dynamic";

// In-memory cache for API responses (30-second TTL)
let cachedAt = 0;
let cachedFixture: Fixture | null = null;
let cachedEvents: MatchEvent[] = [];
let cachedLineups: TeamLineup[] = [];
let cachedStats: TeamStats[] = [];
let cachedFixtureId: number | null = null;

const CACHE_TTL_MS = 30_000;

async function fetchLiveData(fixtureId: number) {
  const now = Date.now();
  if (cachedFixtureId === fixtureId && now - cachedAt < CACHE_TTL_MS) {
    return {
      fixture: cachedFixture,
      events: cachedEvents,
      lineups: cachedLineups,
      stats: cachedStats,
    };
  }

  // Fetch all in parallel
  const [fixture, events, lineups, stats] = await Promise.all([
    getFixtureById(fixtureId),
    getFixtureEvents(fixtureId),
    getFixtureLineups(fixtureId),
    getFixtureStats(fixtureId),
  ]);

  cachedFixture = fixture;
  cachedEvents = events;
  cachedLineups = lineups;
  cachedStats = stats;
  cachedFixtureId = fixtureId;
  cachedAt = now;

  return { fixture, events, lineups, stats };
}

function rowsFrom(result: unknown): Array<Record<string, unknown>> {
  return Array.from(result as Iterable<Record<string, unknown>>);
}

/**
 * GET /api/matchday — full game state with LIVE data from API-Football.
 */
export async function GET() {
  try {
    await ensureTables();

    // Find the most recent match from our DB
    const matchRows = rowsFrom(
      await db.execute(
        sql`SELECT * FROM football_matches ORDER BY id DESC LIMIT 1`
      )
    );
    const match = matchRows[0];
    if (!match) {
      return NextResponse.json({ match: null });
    }

    const matchId = Number(match.id);
    const apiFixtureId = match.api_fixture_id ? Number(match.api_fixture_id) : null;

    // Load DB data (players, predictions, bingo, blocks)
    const players = rowsFrom(
      await db.execute(
        sql`SELECT * FROM football_players WHERE match_id = ${matchId} ORDER BY id`
      )
    );
    const predictions = rowsFrom(
      await db.execute(
        sql`SELECT * FROM football_predictions WHERE match_id = ${matchId}`
      )
    );
    const bingoCards = rowsFrom(
      await db.execute(
        sql`SELECT * FROM football_bingo_cards WHERE match_id = ${matchId}`
      )
    );
    const blocks = rowsFrom(
      await db.execute(
        sql`SELECT * FROM football_blocks WHERE match_id = ${matchId} ORDER BY block_start`
      )
    );

    // Fetch LIVE data from API-Football (if we have a fixture ID)
    let fixture: Fixture | null = null;
    let events: MatchEvent[] = [];
    let lineups: TeamLineup[] = [];
    let stats: TeamStats[] = [];
    let liveStatus: "upcoming" | "live" | "finished" | "other" = "upcoming";
    let liveMinute: number | null = null;
    let homeScore: number | null = null;
    let awayScore: number | null = null;
    let totalCorners = 0;
    let totalCards = 0;
    let firstScorer: string | null = null;
    let firstGoalMinute: number | null = null;

    if (apiFixtureId && process.env.RAPIDAPI_KEY) {
      try {
        const live = await fetchLiveData(apiFixtureId);
        fixture = live.fixture;
        events = live.events;
        lineups = live.lineups;
        stats = live.stats;

        if (fixture) {
          liveStatus = fixtureStatus(fixture.fixture.status.short);
          liveMinute = fixture.fixture.status.elapsed;
          homeScore = fixture.goals.home;
          awayScore = fixture.goals.away;

          // Count corners from stats
          const homeId = fixture.teams.home.id;
          const awayId = fixture.teams.away.id;
          const hCorners = getStatValue(stats, homeId, "Corner Kicks") ?? 0;
          const aCorners = getStatValue(stats, awayId, "Corner Kicks") ?? 0;
          totalCorners = hCorners + aCorners;

          // Count cards from events
          totalCards = events.filter(
            (e) => e.type === "Card"
          ).length;

          // First goalscorer
          const firstGoal = events.find((e) => e.type === "Goal");
          if (firstGoal) {
            firstScorer = firstGoal.player.name;
            firstGoalMinute = firstGoal.time.elapsed;
          }
        }
      } catch (err) {
        console.error("[Matchday] API-Football fetch error:", err);
      }
    }

    // Derive match status for our DB (sync if changed)
    const dbStatus = String(match.status);
    if (liveStatus !== "other" && liveStatus !== dbStatus) {
      await db.execute(
        sql`UPDATE football_matches SET status = ${liveStatus},
            final_home_score = ${homeScore},
            final_away_score = ${awayScore},
            total_corners = ${totalCorners},
            total_cards = ${totalCards},
            first_scorer = ${firstScorer},
            first_goal_minute = ${firstGoalMinute},
            current_minute = ${liveMinute}
          WHERE id = ${matchId}`
      );
    } else if (liveMinute != null) {
      await db.execute(
        sql`UPDATE football_matches SET
            final_home_score = ${homeScore},
            final_away_score = ${awayScore},
            total_corners = ${totalCorners},
            total_cards = ${totalCards},
            first_scorer = ${firstScorer},
            first_goal_minute = ${firstGoalMinute},
            current_minute = ${liveMinute}
          WHERE id = ${matchId}`
      );
    }

    // Auto-check bingo squares based on live events + stats
    const goalEvents = events.filter((e) => e.type === "Goal");
    const cardEvents = events.filter((e) => e.type === "Card");
    const varEvents = events.filter(
      (e) => e.type === "Var" || (e.type === "Goal" && e.detail === "Penalty")
    );
    const subEvents = events.filter((e) => e.type === "subst");

    const bingoContext = {
      events,
      goalEvents,
      cardEvents,
      varEvents,
      subEvents,
      totalCorners,
      totalCards,
      homeScore: homeScore ?? 0,
      awayScore: awayScore ?? 0,
      liveMinute: liveMinute ?? 0,
      isFinished: liveStatus === "finished",
    };

    // Auto-mark bingo for each player
    for (const card of bingoCards) {
      const squares = (
        typeof card.squares === "string"
          ? JSON.parse(card.squares as string)
          : card.squares
      ) as Array<{ key: string; text: string; marked: boolean }>;

      const updated = autoBingoCheck(squares, bingoContext);
      const changed = updated.some(
        (s, i) => s.marked !== squares[i]?.marked
      );
      if (changed) {
        await db.execute(
          sql`UPDATE football_bingo_cards SET squares = ${JSON.stringify(updated)}::jsonb
              WHERE match_id = ${matchId} AND player_id = ${Number(card.player_id)}`
        );
        card.squares = updated;
      }
    }

    // Compute scores
    const actualResults = {
      homeScore,
      awayScore,
      firstScorer,
      firstGoalMinute,
      totalCorners,
      totalCards,
    };

    const playerScores = players.map((p) => {
      const pid = Number(p.id);

      // Prediction score (only if finished)
      const pred = predictions.find((pr) => Number(pr.player_id) === pid);
      let predScore = { total: 0 };
      if (pred && liveStatus === "finished") {
        predScore = scorePrediction(
          {
            predictedHomeScore:
              pred.predicted_home_score != null
                ? Number(pred.predicted_home_score)
                : null,
            predictedAwayScore:
              pred.predicted_away_score != null
                ? Number(pred.predicted_away_score)
                : null,
            firstScorer: pred.first_scorer
              ? String(pred.first_scorer)
              : null,
            firstGoalMinute:
              pred.first_goal_minute != null
                ? Number(pred.first_goal_minute)
                : null,
            totalCorners:
              pred.total_corners != null ? Number(pred.total_corners) : null,
            totalCards:
              pred.total_cards != null ? Number(pred.total_cards) : null,
          },
          actualResults
        );
      }

      // Bingo score
      const bingoCard = bingoCards.find((b) => Number(b.player_id) === pid);
      const squares = bingoCard?.squares
        ? ((typeof bingoCard.squares === "string"
            ? JSON.parse(bingoCard.squares as string)
            : bingoCard.squares) as Array<{
            key: string;
            text: string;
            marked: boolean;
          }>)
        : [];
      const bingoScore = scoreBingo(squares);

      // Block score
      const playerBlocks = blocks.filter(
        (b) => Number(b.player_id) === pid
      );
      let blockGoals = 0;
      for (const b of playerBlocks) {
        const start = Number(b.block_start);
        const end = Number(b.block_end);
        blockGoals += goalEvents.filter((g) => {
          const min = g.time.elapsed;
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
        totalPoints: predScore.total + bingoScore.total + blockGoals * 5,
      };
    });

    playerScores.sort((a, b) => b.totalPoints - a.totalPoints);

    return NextResponse.json({
      match: {
        id: matchId,
        homeTeam: fixture?.teams.home.name ?? String(match.home_team),
        awayTeam: fixture?.teams.away.name ?? String(match.away_team),
        homeLogo: fixture?.teams.home.logo ?? null,
        awayLogo: fixture?.teams.away.logo ?? null,
        venue: fixture?.fixture.venue?.name ?? match.venue ?? null,
        status: liveStatus,
        statusLong: fixture?.fixture.status.long ?? String(match.status),
        elapsed: liveMinute,
        homeScore,
        awayScore,
        totalCorners,
        totalCards,
        firstScorer,
        firstGoalMinute,
        apiFixtureId,
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
        minute: e.time.elapsed,
        extra: e.time.extra,
        type: e.type,
        detail: e.detail,
        player: e.player.name,
        assist: e.assist?.name ?? null,
        team: e.team.name,
      })),
      lineups: lineups.map((l) => ({
        team: l.team.name,
        teamLogo: l.team.logo,
        formation: l.formation,
        coach: l.coach?.name ?? null,
        startXI: l.startXI.map((p) => ({
          name: p.player.name,
          number: p.player.number,
          pos: p.player.pos,
        })),
        subs: l.substitutes.map((p) => ({
          name: p.player.name,
          number: p.player.number,
          pos: p.player.pos,
        })),
      })),
      stats: stats.map((s) => ({
        team: s.team.name,
        stats: Object.fromEntries(
          s.statistics.map((st) => [st.type, st.value])
        ),
      })),
      scores: playerScores,
      cachedAgo: Math.round((Date.now() - cachedAt) / 1000),
    });
  } catch (error) {
    console.error("[Matchday GET]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/matchday — create a match linked to an API-Football fixture.
 * Body: { fixtureId, homeTeam, awayTeam, venue, players: [{ name, emoji, color }] }
 */
export async function POST(request: NextRequest) {
  try {
    await ensureTables();
    const body = await request.json();
    const {
      fixtureId,
      homeTeam,
      awayTeam,
      venue,
      players: playerList,
    } = body;

    if (!playerList?.length) {
      return NextResponse.json(
        { error: "players[] required" },
        { status: 400 }
      );
    }

    // Create the match row with the API fixture ID
    const matchResult = rowsFrom(
      await db.execute(
        sql`INSERT INTO football_matches (home_team, away_team, match_date, venue, api_fixture_id)
            VALUES (${homeTeam ?? "TBD"}, ${awayTeam ?? "TBD"}, ${new Date().toISOString()}, ${venue ?? null}, ${fixtureId ?? null})
            RETURNING id`
      )
    );
    const matchId = Number(matchResult[0].id);

    // Create players
    const playerIds: number[] = [];
    for (const p of playerList) {
      const r = rowsFrom(
        await db.execute(
          sql`INSERT INTO football_players (match_id, name, emoji, color)
              VALUES (${matchId}, ${p.name}, ${p.emoji ?? "⚽"}, ${p.color ?? "#10b981"})
              RETURNING id`
        )
      );
      playerIds.push(Number(r[0].id));
    }

    // Generate bingo cards
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

    return NextResponse.json({ success: true, matchId });
  } catch (error) {
    console.error("[Matchday POST]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
