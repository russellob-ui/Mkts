import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { hotTakes, players } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureTables();

    const tournamentId = Number(
      request.nextUrl.searchParams.get("tournamentId") ?? "0"
    );

    if (!tournamentId) {
      return NextResponse.json(
        { error: "tournamentId query param is required" },
        { status: 400 }
      );
    }

    const takes = await db
      .select()
      .from(hotTakes)
      .where(eq(hotTakes.tournamentId, tournamentId));

    const allPlayers = await db.select().from(players);

    const result = takes.map((take) => {
      const player = allPlayers.find((p) => p.id === take.playerId);
      return {
        id: take.id,
        playerName: player?.name ?? "Unknown",
        playerId: take.playerId,
        playerSlug: player?.slug ?? null,
        playerColor: player?.color ?? null,
        playerAvatarEmoji: player?.avatarEmoji ?? null,
        takeText: take.takeText,
        category: take.category,
        submittedAt: take.submittedAt.toISOString(),
        outcome: take.outcome,
        pointsAwarded: take.pointsAwarded,
        gradingNotes: take.gradingNotes,
      };
    });

    return NextResponse.json({ takes: result });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
