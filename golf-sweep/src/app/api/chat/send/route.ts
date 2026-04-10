import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { chatMessages, players } from "@/db/schema";
import { appendChatToJSONL } from "@/lib/chat-persistence";

export async function POST(request: NextRequest) {
  try {
    await ensureTables();

    const body_json = await request.json();
    // Accept either { playerPasscode } or { passcode } for backwards compat
    const passcode = body_json.playerPasscode ?? body_json.passcode;
    const playerId = body_json.playerId ?? null;
    const body = body_json.body;
    const contextType = body_json.contextType;
    const contextId = body_json.contextId;
    const replyToMessageId = body_json.replyToMessageId;

    if (!passcode || !body) {
      return NextResponse.json(
        { error: "passcode and body are required" },
        { status: 400 }
      );
    }

    if (typeof body !== "string" || body.trim().length === 0) {
      return NextResponse.json(
        { error: "Message body cannot be empty" },
        { status: 400 }
      );
    }

    // Validate passcode — if playerId is supplied, verify the passcode
    // matches THAT specific player (prevents picking wrong player when
    // multiple players share a passcode). Otherwise fall back to global
    // passcode lookup (backwards compat).
    const allPlayers = await db.select().from(players);
    let player;
    if (playerId) {
      player = allPlayers.find(
        (p) => p.id === Number(playerId) && p.passcode === passcode
      );
      if (!player) {
        return NextResponse.json(
          { error: "Invalid passcode for this player" },
          { status: 401 }
        );
      }
    } else {
      player = allPlayers.find((p) => p.passcode === passcode);
      if (!player) {
        return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
      }
    }

    const [message] = await db
      .insert(chatMessages)
      .values({
        playerId: player.id,
        playerNameSnapshot: player.name,
        playerAvatarSnapshot: player.avatarEmoji ?? null,
        body: body.trim(),
        contextType: contextType ?? "general",
        contextId: contextId ?? null,
        replyToMessageId: replyToMessageId ?? null,
        reactions: {},
      })
      .returning();

    // Persist to JSONL backup (non-fatal if volume not mounted)
    try {
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
    } catch (err) {
      console.error("[Chat] JSONL append failed (non-fatal):", err);
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error("[Chat Send] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

