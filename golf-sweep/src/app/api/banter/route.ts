import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { banterEvents, players, golfers } from "@/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const tournamentId = Number(request.nextUrl.searchParams.get("tournamentId") ?? "1");
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const minImportance = Number(request.nextUrl.searchParams.get("minImportance") ?? "0");

  let query = db
    .select()
    .from(banterEvents)
    .where(eq(banterEvents.tournamentId, tournamentId))
    .orderBy(desc(banterEvents.createdAt))
    .limit(limit);

  const events = await query;

  // Filter by importance in memory (simpler than dynamic SQL)
  const filtered = minImportance > 0
    ? events.filter((e) => e.importance >= minImportance)
    : events;

  const allPlayers = await db.select().from(players);
  const allGolfers = await db.select().from(golfers);

  const result = filtered.map((e) => ({
    id: e.id,
    eventType: e.eventType,
    headline: e.headline,
    detail: e.detail,
    emoji: e.emoji,
    importance: e.importance,
    roundNumber: e.roundNumber,
    source: e.source,
    player: e.playerId ? allPlayers.find((p) => p.id === e.playerId) : null,
    golfer: e.golferId ? allGolfers.find((g) => g.id === e.golferId) : null,
    createdAt: e.createdAt.toISOString(),
  }));

  return NextResponse.json({ events: result });
}
