import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { chatMessages, players } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

let tablesEnsured = false;

export async function GET() {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const allPlayers = await db.select().from(players);
    const playerMap = new Map(allPlayers.map((p) => [p.id, p]));

    const msgs = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.contextType, "trash_talk"))
      .orderBy(desc(chatMessages.createdAt))
      .limit(50);

    const messages = msgs.map((m) => {
      // contextId stores the target player id
      const targetPlayer = m.contextId ? playerMap.get(m.contextId) : null;
      return {
        id: m.id,
        senderName: m.playerNameSnapshot,
        senderAvatar: m.playerAvatarSnapshot,
        senderId: m.playerId,
        targetName: targetPlayer?.name ?? "Unknown",
        targetSlug: targetPlayer?.slug ?? "",
        message: m.body,
        emoji: m.reactions, // we store the emoji in reactions field as a simple string hack
        createdAt: m.createdAt,
      };
    });

    return NextResponse.json({ messages, players: allPlayers.map((p) => ({ id: p.id, name: p.name, slug: p.slug, color: p.color })) });
  } catch (error) {
    console.error("[Trash Talk GET] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const body = await request.json();
    const { senderId, targetPlayerSlug, message, emoji, passcode } = body;

    if (!passcode || !message || !targetPlayerSlug) {
      return NextResponse.json(
        { error: "passcode, message, and targetPlayerSlug are required" },
        { status: 400 }
      );
    }

    if (typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message cannot be empty" },
        { status: 400 }
      );
    }

    if (message.trim().length > 280) {
      return NextResponse.json(
        { error: "Message must be 280 characters or fewer" },
        { status: 400 }
      );
    }

    const allPlayers = await db.select().from(players);

    // Validate sender
    let sender;
    if (senderId) {
      sender = allPlayers.find(
        (p) => p.id === Number(senderId) && p.passcode === passcode
      );
    } else {
      sender = allPlayers.find((p) => p.passcode === passcode);
    }

    if (!sender) {
      return NextResponse.json(
        { error: "Invalid passcode" },
        { status: 401 }
      );
    }

    // Find target player
    const target = allPlayers.find((p) => p.slug === targetPlayerSlug);
    if (!target) {
      return NextResponse.json(
        { error: "Target player not found" },
        { status: 404 }
      );
    }

    const [msg] = await db
      .insert(chatMessages)
      .values({
        playerId: sender.id,
        playerNameSnapshot: sender.name,
        playerAvatarSnapshot: sender.avatarEmoji ?? null,
        body: `${emoji ? emoji + " " : ""}${message.trim()}`,
        contextType: "trash_talk",
        contextId: target.id,
        replyToMessageId: null,
        reactions: {},
      })
      .returning();

    return NextResponse.json({ message: msg });
  } catch (error) {
    console.error("[Trash Talk POST] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
