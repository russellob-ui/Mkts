import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { chatMessages, players } from "@/db/schema";
import { appendChatToJSONL } from "@/lib/chat-persistence";

export async function POST(request: NextRequest) {
  try {
    await ensureTables();

    const { playerPasscode, body, contextType, contextId, replyToMessageId } =
      await request.json();

    if (!playerPasscode || !body) {
      return NextResponse.json(
        { error: "playerPasscode and body are required" },
        { status: 400 }
      );
    }

    // Validate passcode
    const allPlayers = await db.select().from(players);
    const player = allPlayers.find((p) => p.passcode === playerPasscode);
    if (!player) {
      return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
    }

    const [message] = await db
      .insert(chatMessages)
      .values({
        playerId: player.id,
        playerNameSnapshot: player.name,
        playerAvatarSnapshot: player.avatarEmoji ?? null,
        body,
        contextType: contextType ?? "general",
        contextId: contextId ?? null,
        replyToMessageId: replyToMessageId ?? null,
        reactions: {},
      })
      .returning();

    // Persist to JSONL backup
    appendChatToJSONL({
      id: message.id,
      playerId: message.playerId,
      playerNameSnapshot: message.playerNameSnapshot,
      playerAvatarSnapshot: message.playerAvatarSnapshot,
      body: message.body,
      contextType: message.contextType,
      contextId: message.contextId,
      replyToMessageId: message.replyToMessageId,
      reactions: message.reactions,
      createdAt: message.createdAt.toISOString(),
    });

    return NextResponse.json({ message });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
