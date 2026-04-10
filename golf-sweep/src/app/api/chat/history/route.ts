import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { chatMessages, players } from "@/db/schema";
import { desc, lt, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureTables();

    const beforeParam = request.nextUrl.searchParams.get("before");
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50");

    const allPlayers = await db.select().from(players);

    // Build query: non-deleted messages, ordered by createdAt desc
    let query;
    if (beforeParam) {
      const beforeId = Number(beforeParam);
      query = db
        .select()
        .from(chatMessages)
        .where(
          isNull(chatMessages.deletedAt)
        )
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit + 100); // over-fetch then filter by id
    } else {
      query = db
        .select()
        .from(chatMessages)
        .where(isNull(chatMessages.deletedAt))
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit);
    }

    let messages = await query;

    // If before is specified, filter to only messages with id < before
    if (beforeParam) {
      const beforeId = Number(beforeParam);
      messages = messages
        .filter((m) => m.id < beforeId)
        .slice(0, limit);
    }

    const result = messages.map((msg) => {
      const player = msg.playerId
        ? allPlayers.find((p) => p.id === msg.playerId)
        : null;
      return {
        id: msg.id,
        playerId: msg.playerId,
        // Both naming conventions for backwards compat
        playerName: msg.playerNameSnapshot,
        playerAvatar: msg.playerAvatarSnapshot,
        playerNameSnapshot: msg.playerNameSnapshot,
        playerAvatarSnapshot: msg.playerAvatarSnapshot,
        playerColor: player?.color ?? null,
        body: msg.body,
        contextType: msg.contextType,
        contextId: msg.contextId,
        replyToMessageId: msg.replyToMessageId,
        reactions: msg.reactions,
        editedAt: msg.editedAt?.toISOString() ?? null,
        createdAt: msg.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ messages: result });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
