import { db } from "@/db";
import {
  scoreSnapshots,
  banterEvents,
  picks,
  players,
  golfers,
} from "@/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import {
  getScorecard,
  analyzeScorecardRound,
  getGolfSeasonYear,
  type ScorecardRound,
} from "@/lib/slashgolf";

interface SnapshotData {
  golferId: number;
  playerId: number;
  playerName: string;
  golferName: string;
  totalScoreToPar: number | null;
  roundScoreToPar: number | null;
  position: string | null;
  positionNumeric: number | null;
  thru: string | null;
  roundNumber: number;
}

function parsePositionNumeric(pos: string | null): number | null {
  if (!pos) return null;
  const cleaned = pos.toUpperCase().replace(/^T/, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function parseThruNumeric(thru: string | null): number | null {
  if (!thru) return null;
  if (thru.toUpperCase() === "F") return 18;
  const num = parseInt(thru, 10);
  return isNaN(num) ? null : num;
}

/**
 * Module-level set tracking which hole-level banter events have already fired.
 * Key format: `${golferId}-R${roundNumber}-H${holeId}-${eventType}`
 * Prevents duplicate banter when the same scorecard is re-polled.
 */
const banteredHoles = new Set<string>();

/** Write score snapshots for all picked golfers after a poll */
export async function writeScoreSnapshots(
  tournamentId: number,
  golferData: Array<{
    golferId: number;
    totalScoreToPar: number | null;
    roundScoreToPar: number | null;
    position: string | null;
    thru: string | null;
    roundNumber: number;
  }>
) {
  for (const g of golferData) {
    try {
      // Defensive: round number must be 1-4, fallback to 1
      const rn = Number.isFinite(g.roundNumber) && g.roundNumber >= 1 && g.roundNumber <= 4
        ? g.roundNumber
        : 1;
      await db.insert(scoreSnapshots).values({
        golferId: g.golferId,
        tournamentId,
        roundNumber: rn,
        totalScoreToPar: g.totalScoreToPar,
        roundScoreToPar: g.roundScoreToPar,
        position: g.position,
        positionNumeric: parsePositionNumeric(g.position),
        thru: g.thru,
        thruNumeric: parseThruNumeric(g.thru),
      });
    } catch (err) {
      console.error(`[Snapshots] Insert failed for golfer ${g.golferId}:`, err);
      // Continue with other golfers
    }
  }
}

/** Ordinal suffix helper: 1 -> "1st", 2 -> "2nd", 13 -> "13th" etc. */
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Info about a golfer that the leaderboard route already resolved, needed
 * for scorecard fetches.
 */
export interface GolferScorecardInfo {
  golferId: number;       // our DB id
  playerId: number;       // our DB player (sweep player) id
  playerName: string;
  golferName: string;
  slashPlayerId: string;  // Slash Golf API player id
  currentRound: number;   // which round the tournament is currently on (1-4)
  thru: string | null;    // "F", "3", null, "CUT", etc.
  status: string;         // "playing", "finished", "not_started", "cut", etc.
  position: string | null;
}

/**
 * In-memory scorecard cache. Key: `${slashPlayerId}-${tournId}-${year}`.
 * Cached for 60s alongside the leaderboard poll interval.
 */
const scorecardCache = new Map<string, { rounds: ScorecardRound[]; cachedAt: number }>();
const SCORECARD_CACHE_TTL = 30_000;

/**
 * Fetch scorecards for our picked golfers and generate banter events for
 * REAL eagles, birdies, bogeys, doubles, and albatrosses with actual hole numbers.
 *
 * Called from the leaderboard route after writeScoreSnapshots during live play.
 */
export async function generateScorecardBanter(
  tournamentId: number,
  slashTournId: string,
  golferInfos: GolferScorecardInfo[]
) {
  const year = getGolfSeasonYear();
  const tenMinAgo = new Date(Date.now() - 10 * 60_000);

  for (const info of golferInfos) {
    try {
      // Skip golfers who haven't teed off yet or are cut/wd/dq
      if (
        info.status === "not_started" ||
        info.status === "cut" ||
        info.status === "wd" ||
        info.status === "dq"
      ) {
        continue;
      }

      // Fetch scorecard (with caching)
      const cacheKey = `${info.slashPlayerId}-${slashTournId}-${year}`;
      const now = Date.now();
      let rounds: ScorecardRound[];

      const cached = scorecardCache.get(cacheKey);
      if (cached && now - cached.cachedAt < SCORECARD_CACHE_TTL) {
        rounds = cached.rounds;
      } else {
        rounds = await getScorecard(slashTournId, year, info.slashPlayerId);
        scorecardCache.set(cacheKey, { rounds, cachedAt: now });
      }

      if (rounds.length === 0) continue;

      // Find the current round's scorecard
      const currentRound = rounds.find((r) => r.roundId === info.currentRound)
        ?? rounds[rounds.length - 1]; // fallback to latest
      if (!currentRound || currentRound.holes.length === 0) continue;

      const analysis = analyzeScorecardRound(currentRound);

      const snapshotData: SnapshotData = {
        golferId: info.golferId,
        playerId: info.playerId,
        playerName: info.playerName,
        golferName: info.golferName,
        totalScoreToPar: null,
        roundScoreToPar: null,
        position: info.position,
        positionNumeric: parsePositionNumeric(info.position),
        thru: info.thru,
        roundNumber: info.currentRound,
      };

      // Albatrosses
      for (const hole of analysis.albatross) {
        const key = `${info.golferId}-R${info.currentRound}-H${hole.holeId}-albatross`;
        if (banteredHoles.has(key)) continue;
        banteredHoles.add(key);
        await insertBanter(tournamentId, snapshotData, "albatross", 10,
          `\u{1F92F} ALBATROSS! ${info.golferName} aces the par-${hole.par} ${ordinal(hole.holeId)}!`,
          `${info.playerName}'s pick with an incredible ${hole.holeScore} on a par ${hole.par}`,
          "\u{1F92F}", tenMinAgo);
      }

      // Eagles
      for (const hole of analysis.eagles) {
        const key = `${info.golferId}-R${info.currentRound}-H${hole.holeId}-eagle`;
        if (banteredHoles.has(key)) continue;
        banteredHoles.add(key);
        await insertBanter(tournamentId, snapshotData, "eagle", 8,
          `\u{1F985} ${info.golferName} eagles the ${ordinal(hole.holeId)}! ${info.playerName}'s pick`,
          `${hole.holeScore} on the par-${hole.par} ${ordinal(hole.holeId)}`,
          "\u{1F985}", tenMinAgo);
      }

      // Double bogey or worse
      for (const hole of analysis.doubles) {
        const key = `${info.golferId}-R${info.currentRound}-H${hole.holeId}-double_bogey`;
        if (banteredHoles.has(key)) continue;
        banteredHoles.add(key);
        const diff = hole.holeScore - hole.par;
        const label = diff === 2 ? "doubles" : diff === 3 ? "triples" : `takes ${hole.holeScore} on`;
        await insertBanter(tournamentId, snapshotData, "double_bogey", 6,
          `\u{1F480} ${info.golferName} ${label} the ${ordinal(hole.holeId)} — ${info.playerName} in trouble`,
          `${hole.holeScore} on the par-${hole.par} ${ordinal(hole.holeId)}`,
          "\u{1F480}", tenMinAgo);
      }
    } catch (err) {
      console.error(`[Banter] Scorecard fetch/analysis failed for golfer ${info.golferId}:`, err);
      // Continue with other golfers — scorecard errors are non-fatal
    }
  }
}

/** Generate banter events by comparing latest vs previous snapshots */
export async function generateBanterFromSnapshot(tournamentId: number) {
  try {
    const tournamentPicks = await db
      .select()
      .from(picks)
      .where(eq(picks.tournamentId, tournamentId));

    const allPlayers = await db.select().from(players);
    const allGolfers = await db.select().from(golfers);

    const snapshotPairs: Array<{
      current: SnapshotData;
      previous: SnapshotData | null;
    }> = [];

    for (const pick of tournamentPicks) {
      const player = allPlayers.find((p) => p.id === pick.playerId);
      const golfer = allGolfers.find((g) => g.id === pick.golferId);
      if (!player || !golfer) continue;

      const snapshots = await db
        .select()
        .from(scoreSnapshots)
        .where(
          and(
            eq(scoreSnapshots.golferId, pick.golferId),
            eq(scoreSnapshots.tournamentId, tournamentId)
          )
        )
        .orderBy(desc(scoreSnapshots.capturedAt))
        .limit(2);

      if (snapshots.length === 0) continue;

      const current: SnapshotData = {
        golferId: pick.golferId,
        playerId: pick.playerId,
        playerName: player.name,
        golferName: golfer.name,
        totalScoreToPar: snapshots[0].totalScoreToPar,
        roundScoreToPar: snapshots[0].roundScoreToPar,
        position: snapshots[0].position,
        positionNumeric: snapshots[0].positionNumeric,
        thru: snapshots[0].thru,
        roundNumber: snapshots[0].roundNumber,
      };

      const previous: SnapshotData | null =
        snapshots.length > 1
          ? {
              golferId: pick.golferId,
              playerId: pick.playerId,
              playerName: player.name,
              golferName: golfer.name,
              totalScoreToPar: snapshots[1].totalScoreToPar,
              roundScoreToPar: snapshots[1].roundScoreToPar,
              position: snapshots[1].position,
              positionNumeric: snapshots[1].positionNumeric,
              thru: snapshots[1].thru,
              roundNumber: snapshots[1].roundNumber,
            }
          : null;

      snapshotPairs.push({ current, previous });
    }

    const tenMinAgo = new Date(Date.now() - 10 * 60_000);

    for (const { current, previous } of snapshotPairs) {
      if (!previous) continue;

      // Position jump up (5+ places)
      if (previous.positionNumeric && current.positionNumeric &&
          previous.positionNumeric - current.positionNumeric >= 5) {
        await insertBanter(tournamentId, current, "position_jump_up", 5,
          `\u{1F4C8} ${current.golferName} climbs to ${current.position}`,
          `${current.playerName}'s pick up ${previous.positionNumeric - current.positionNumeric} places`,
          "\u{1F4C8}", tenMinAgo);
      }

      // Position drop (5+ places)
      if (previous.positionNumeric && current.positionNumeric &&
          current.positionNumeric - previous.positionNumeric >= 5) {
        await insertBanter(tournamentId, current, "position_jump_down", 5,
          `\u{1F4C9} ${current.golferName} drops to ${current.position}`,
          `Bad news for ${current.playerName}`,
          "\u{1F4C9}", tenMinAgo);
      }

      // Cut missed
      if (current.roundNumber === 2 && current.thru === "F" &&
          (current.position?.toUpperCase() === "MC" || current.position?.toUpperCase() === "CUT")) {
        await insertBanter(tournamentId, current, "cut_missed", 8,
          `❌ ${current.golferName} misses the cut`,
          `${current.playerName}'s tournament is over`,
          "❌", tenMinAgo);
      }
    }

    // Lead change check
    const currentLeader = snapshotPairs
      .filter((p) => p.current.positionNumeric != null)
      .sort((a, b) => (a.current.positionNumeric ?? 999) - (b.current.positionNumeric ?? 999))[0];
    const previousLeader = snapshotPairs
      .filter((p) => p.previous?.positionNumeric != null)
      .sort((a, b) => (a.previous!.positionNumeric ?? 999) - (b.previous!.positionNumeric ?? 999))[0];

    if (currentLeader && previousLeader &&
        currentLeader.current.playerId !== previousLeader.current.playerId) {
      await insertBanter(tournamentId, currentLeader.current, "lead_change", 7,
        `\u{1F451} ${currentLeader.current.playerName}'s ${currentLeader.current.golferName} takes the sweep lead`,
        `Now at ${currentLeader.current.position}`,
        "\u{1F451}", tenMinAgo);
    }
  } catch (err) {
    console.error("[Banter] Generation error:", err);
  }
}

async function insertBanter(
  tournamentId: number,
  data: SnapshotData,
  eventType: string,
  importance: number,
  headline: string,
  detail: string,
  emoji: string,
  dedupeAfter: Date
) {
  // Dedup: check for same type + golfer within last 10 minutes
  const existing = await db
    .select()
    .from(banterEvents)
    .where(
      and(
        eq(banterEvents.tournamentId, tournamentId),
        eq(banterEvents.eventType, eventType),
        eq(banterEvents.golferId, data.golferId),
        gte(banterEvents.createdAt, dedupeAfter)
      )
    )
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(banterEvents).values({
    tournamentId,
    roundNumber: data.roundNumber,
    playerId: data.playerId,
    golferId: data.golferId,
    eventType,
    headline,
    detail,
    emoji,
    importance,
    source: "auto",
  });
}
