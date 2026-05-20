import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { matchEvents, matches, players } from "@/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

let tablesEnsured = false;

const BINGO_EVENTS = [
  "Goal in first 10 minutes",
  "Red card",
  "0-0 at halftime",
  "Penalty awarded",
  "Goal after 85th min",
  "Hat trick",
  "Own goal",
  "5+ goals in a match",
  "Clean sheet",
  "Injury time goal",
  "Missed penalty",
  "VAR decision",
  "3+ yellow cards in a match",
  "Player scores twice",
  "Header goal",
  "Free kick goal",
  "Goal from outside the box",
  "Substitute scores",
  "Goalkeeper saves penalty",
  "Both teams score",
];

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function seededRng(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

function generateBingoCard(
  dateStr: string,
  playerId: number
): Array<Array<{ text: string; completed: boolean }>> {
  const seed = hashString(`bingo-${dateStr}-${playerId}`);
  const rng = seededRng(seed);

  // Shuffle events
  const indices = Array.from({ length: BINGO_EVENTS.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  // Take first 16 for 4x4 grid
  const selected = indices.slice(0, 16);
  const card: Array<Array<{ text: string; completed: boolean }>> = [];
  for (let row = 0; row < 4; row++) {
    const rowCells: Array<{ text: string; completed: boolean }> = [];
    for (let col = 0; col < 4; col++) {
      const idx = row * 4 + col;
      rowCells.push({
        text: BINGO_EVENTS[selected[idx]],
        completed: false,
      });
    }
    card.push(rowCells);
  }
  return card;
}

function checkBingo(card: Array<Array<{ text: string; completed: boolean }>>): number {
  let lines = 0;

  // Rows
  for (let r = 0; r < 4; r++) {
    if (card[r].every((c) => c.completed)) lines++;
  }
  // Columns
  for (let c = 0; c < 4; c++) {
    if (card.every((row) => row[c].completed)) lines++;
  }
  // Diagonals
  if ([0, 1, 2, 3].every((i) => card[i][i].completed)) lines++;
  if ([0, 1, 2, 3].every((i) => card[i][3 - i].completed)) lines++;

  return lines;
}

export async function GET(request: NextRequest) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get("playerId");

    if (!playerId) {
      // Return player list
      const allPlayers = await db.select().from(players);
      return NextResponse.json({
        players: allPlayers.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          color: p.color,
        })),
      });
    }

    const dateStr = getTodayString();
    const card = generateBingoCard(dateStr, Number(playerId));

    // Check today's match events to mark cells as completed
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Get today's matches
    const todayMatches = await db
      .select()
      .from(matches)
      .where(
        and(
          gte(matches.kickoff, todayStart),
          lte(matches.kickoff, todayEnd)
        )
      );

    const matchIds = todayMatches.map((m) => m.id);

    // Get events for today's matches
    let events: Array<{
      id: number;
      matchId: number;
      eventType: string;
      minute: number | null;
      detail: string | null;
      playerName: string | null;
    }> = [];
    if (matchIds.length > 0) {
      events = await db
        .select()
        .from(matchEvents)
        .where(
          sql`${matchEvents.matchId} IN (${sql.join(
            matchIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        );
    }

    // Build a set of triggered bingo events
    const triggered = new Set<string>();

    for (const evt of events) {
      if (evt.eventType === "Goal" && evt.minute !== null && evt.minute <= 10) {
        triggered.add("Goal in first 10 minutes");
      }
      if (evt.eventType === "Card" && evt.detail === "Red Card") {
        triggered.add("Red card");
      }
      if (evt.eventType === "Goal" && evt.minute !== null && evt.minute >= 85) {
        triggered.add("Goal after 85th min");
      }
      if (evt.eventType === "Goal" && evt.minute !== null && evt.minute >= 90) {
        triggered.add("Injury time goal");
      }
      if (evt.eventType === "Goal" && evt.detail === "Own Goal") {
        triggered.add("Own goal");
      }
      if (evt.eventType === "Goal" && evt.detail === "Penalty") {
        triggered.add("Penalty awarded");
      }
      if (evt.eventType === "Var") {
        triggered.add("VAR decision");
      }
      if (evt.eventType === "Goal" && evt.detail === "Header") {
        triggered.add("Header goal");
      }
      if (evt.eventType === "Goal" && evt.detail === "Free Kick") {
        triggered.add("Free kick goal");
      }
      if (evt.eventType === "subst" && evt.detail === "Substitute Goal") {
        triggered.add("Substitute scores");
      }
      if (evt.eventType === "Missed Penalty" || evt.detail === "Missed Penalty") {
        triggered.add("Missed penalty");
      }
      if (evt.eventType === "Penalty Save" || evt.detail === "Penalty Save") {
        triggered.add("Goalkeeper saves penalty");
      }
    }

    // Check match-level conditions
    for (const m of todayMatches) {
      if (m.status === "finished" || m.status === "live") {
        const hs = m.homeScore ?? 0;
        const as = m.awayScore ?? 0;
        if (hs + as >= 5) triggered.add("5+ goals in a match");
        if (hs === 0 || as === 0) {
          if (m.status === "finished") triggered.add("Clean sheet");
        }
        if (hs > 0 && as > 0) triggered.add("Both teams score");

        // Count goals per match per player for hat tricks and doubles
        const matchGoals = events.filter(
          (e) => e.matchId === m.id && e.eventType === "Goal" && e.detail !== "Own Goal"
        );
        const goalsByPlayer = new Map<string, number>();
        for (const g of matchGoals) {
          const name = g.playerName ?? "unknown";
          goalsByPlayer.set(name, (goalsByPlayer.get(name) ?? 0) + 1);
        }
        for (const count of goalsByPlayer.values()) {
          if (count >= 2) triggered.add("Player scores twice");
          if (count >= 3) triggered.add("Hat trick");
        }

        // Yellow cards per match
        const matchYellows = events.filter(
          (e) =>
            e.matchId === m.id &&
            e.eventType === "Card" &&
            (e.detail === "Yellow Card" || e.detail === "Second Yellow card")
        );
        if (matchYellows.length >= 3) triggered.add("3+ yellow cards in a match");
      }

      // Halftime check (if live and minute around 45-55, check if 0-0)
      if (m.status === "live" && m.minute && m.minute >= 45 && m.minute <= 55) {
        if ((m.homeScore ?? 0) === 0 && (m.awayScore ?? 0) === 0) {
          triggered.add("0-0 at halftime");
        }
      }
      // Also mark it if the match is finished and no goals were scored before halftime
      if (m.status === "finished") {
        const firstHalfGoals = events.filter(
          (e) => e.matchId === m.id && e.eventType === "Goal" && e.minute !== null && e.minute <= 45
        );
        if (firstHalfGoals.length === 0) {
          triggered.add("0-0 at halftime");
        }
      }
    }

    // Mark completed cells
    for (const row of card) {
      for (const cell of row) {
        if (triggered.has(cell.text)) {
          cell.completed = true;
        }
      }
    }

    const completedCount = card.flat().filter((c) => c.completed).length;
    const bingoLines = checkBingo(card);
    const isFullHouse = completedCount === 16;
    const points = completedCount + bingoLines * 5 + (isFullHouse ? 10 : 0);

    // Get all players for player list
    const allPlayers = await db.select().from(players);

    return NextResponse.json({
      date: dateStr,
      card,
      completedCount,
      bingoLines,
      isFullHouse,
      points,
      triggeredEvents: Array.from(triggered),
      players: allPlayers.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        color: p.color,
      })),
    });
  } catch (error) {
    console.error("[Bingo GET] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
