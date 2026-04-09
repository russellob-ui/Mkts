import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { chatMessages, players } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    await ensureTables();

    const { playerPasscode, messageId, emoji } = await request.json();

    if (!playerPasscode || !messageId || !emoji) {
      return NextResponse.json(
        { error: "playerPasscode, messageId, and emoji are required" },
        { status: 400 }
      );
    }

    // Validate passcode
    const allPlayers = await db.select().from(players);
    const player = allPlayers.find((p) => p.passcode === playerPasscode);
    if (!player) {
      return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
    }

    // Get the message
    const [message] = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.id, messageId));

    if (!message) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      );
    }

    // Toggle reaction
    // reactions shape: { "emoji": [playerId1, playerId2, ...], ... }
    const reactions = (message.reactions as Record<string, number[]>) ?? {};
    const emojiReactions = reactions[emoji] ?? [];

    if (emojiReactions.includes(player.id)) {
      // Remove player from this emoji
      reactions[emoji] = emojiReactions.filter((id) => id !== player.id);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    } else {
      // Add player to this emoji
      reactions[emoji] = [...emojiReactions, player.id];
    }

    await db
      .update(chatMessages)
      .set({ reactions })
      .where(eq(chatMessages.id, messageId));

    return NextResponse.json({ reactions });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
