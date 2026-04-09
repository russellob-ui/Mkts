import { db } from "@/db";
import {
  scoreSnapshots,
  banterEvents,
  picks,
  players,
  golfers,
} from "@/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";

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
    await db.insert(scoreSnapshots).values({
      golferId: g.golferId,
      tournamentId,
      roundNumber: g.roundNumber,
      totalScoreToPar: g.totalScoreToPar,
      roundScoreToPar: g.roundScoreToPar,
      position: g.position,
      positionNumeric: parsePositionNumeric(g.position),
      thru: g.thru,
      thruNumeric: parseThruNumeric(g.thru),
    });
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
      const prevTotal = previous.totalScoreToPar ?? 0;
      const currTotal = current.totalScoreToPar ?? 0;
      const diff = currTotal - prevTotal;

      // Eagle: drop of exactly 2
      if (diff === -2) {
        await insertBanter(tournamentId, current, "eagle", 8,
          `🦅 ${current.golferName} eagles!`,
          `${current.playerName}'s pick moves to ${current.position}`,
          "🦅", tenMinAgo);
      }

      // Albatross: drop of 3
      if (diff === -3) {
        await insertBanter(tournamentId, current, "albatross", 10,
          `🤯 Albatross! ${current.golferName} drops 3 shots in one go!`,
          `Incredible — ${current.playerName} celebrating`,
          "🤯", tenMinAgo);
      }

      // Birdie streak: drop of 3+ in round score
      if (diff <= -3 && current.roundScoreToPar != null && previous.roundScoreToPar != null) {
        const roundDiff = (current.roundScoreToPar ?? 0) - (previous.roundScoreToPar ?? 0);
        if (roundDiff <= -3) {
          await insertBanter(tournamentId, current, "birdie_streak", 6,
            `🔥 ${current.golferName} on fire — ${Math.abs(roundDiff)} shots gained`,
            `${current.playerName}'s pick is charging`,
            "🔥", tenMinAgo);
        }
      }

      // Position jump up (5+ places)
      if (previous.positionNumeric && current.positionNumeric &&
          previous.positionNumeric - current.positionNumeric >= 5) {
        await insertBanter(tournamentId, current, "position_jump_up", 5,
          `📈 ${current.golferName} climbs to ${current.position}`,
          `${current.playerName}'s pick up ${previous.positionNumeric - current.positionNumeric} places`,
          "📈", tenMinAgo);
      }

      // Position drop (5+ places)
      if (previous.positionNumeric && current.positionNumeric &&
          current.positionNumeric - previous.positionNumeric >= 5) {
        await insertBanter(tournamentId, current, "position_jump_down", 5,
          `📉 ${current.golferName} drops to ${current.position}`,
          `Bad news for ${current.playerName}`,
          "📉", tenMinAgo);
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
        `👑 ${currentLeader.current.playerName}'s ${currentLeader.current.golferName} takes the sweep lead`,
        `Now at ${currentLeader.current.position}`,
        "👑", tenMinAgo);
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
