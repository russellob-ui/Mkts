import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { banterEvents, wcTeams } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

let tablesEnsured = false;

export async function GET() {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const allTeams = await db.select().from(wcTeams);

    const events = await db
      .select()
      .from(banterEvents)
      .orderBy(desc(banterEvents.createdAt))
      .limit(50);

    const result = events.map((e) => {
      const team = e.teamId
        ? allTeams.find((t) => t.id === e.teamId)
        : null;
      return {
        id: e.id,
        matchId: e.matchId,
        playerId: e.playerId,
        teamId: e.teamId,
        teamName: team?.name ?? null,
        teamFlag: team?.flagEmoji ?? null,
        eventType: e.eventType,
        headline: e.headline,
        detail: e.detail,
        emoji: e.emoji,
        importance: e.importance,
        source: e.source,
        createdAt: e.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ events: result });
  } catch (err) {
    console.error("[Banter]", err);
    return NextResponse.json(
      { error: "Failed to load banter events" },
      { status: 500 }
    );
  }
}
