import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { chatMessages, players } from "@/db/schema";
import { desc, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

let tablesEnsured = false;

export async function GET(request: NextRequest) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "100");
    const beforeParam = request.nextUrl.searchParams.get("before");

    const allPlayers = await db.select().from(players);

    let messages = await db
      .select()
      .from(chatMessages)
      .where(isNull(chatMessages.deletedAt))
      .orderBy(desc(chatMessages.createdAt))
      .limit(beforeParam ? limit + 100 : limit);

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
        playerName: msg.playerNameSnapshot,
        playerAvatar: msg.playerAvatarSnapshot,
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
    console.error("[Chat History] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
