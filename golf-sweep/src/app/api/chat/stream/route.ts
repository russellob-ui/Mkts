import { NextRequest } from "next/server";
import { db } from "@/db";
import { chatMessages, players } from "@/db/schema";
import { eq, desc, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * SSE endpoint for live chat streaming.
 * On connect, sends last 100 messages as backfill.
 * Then polls DB every 2 seconds for new messages.
 */
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  let lastSeenId = 0;

  const stream = new ReadableStream({
    async start(controller) {
      // Backfill: send last 100 messages
      try {
        const backfill = await db
          .select()
          .from(chatMessages)
          .where(isNull(chatMessages.deletedAt))
          .orderBy(desc(chatMessages.createdAt))
          .limit(100);

        // Reverse so oldest first
        backfill.reverse();

        for (const msg of backfill) {
          const [player] = msg.playerId
            ? await db.select().from(players).where(eq(players.id, msg.playerId))
            : [null];

          const event = {
            id: msg.id,
            playerId: msg.playerId,
            playerName: msg.playerNameSnapshot,
            playerAvatar: msg.playerAvatarSnapshot,
            playerColor: player?.color ?? null,
            body: msg.body,
            contextType: msg.contextType,
            replyToMessageId: msg.replyToMessageId,
            reactions: msg.reactions,
            createdAt: msg.createdAt.toISOString(),
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
          lastSeenId = Math.max(lastSeenId, msg.id);
        }

        // Signal backfill complete
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "backfill_complete" })}\n\n`)
        );
      } catch (err) {
        console.error("[Chat SSE] Backfill error:", err);
      }

      // Poll for new messages every 2 seconds
      const interval = setInterval(async () => {
        try {
          const newMessages = await db
            .select()
            .from(chatMessages)
            .where(isNull(chatMessages.deletedAt))
            .orderBy(desc(chatMessages.createdAt))
            .limit(10);

          for (const msg of newMessages.reverse()) {
            if (msg.id <= lastSeenId) continue;

            const [player] = msg.playerId
              ? await db.select().from(players).where(eq(players.id, msg.playerId))
              : [null];

            const event = {
              id: msg.id,
              playerId: msg.playerId,
              playerName: msg.playerNameSnapshot,
              playerAvatar: msg.playerAvatarSnapshot,
              playerColor: player?.color ?? null,
              body: msg.body,
              contextType: msg.contextType,
              replyToMessageId: msg.replyToMessageId,
              reactions: msg.reactions,
              createdAt: msg.createdAt.toISOString(),
            };
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
            lastSeenId = msg.id;
          }
        } catch {
          // Non-fatal
        }
      }, 2000);

      // Heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(interval);
          clearInterval(heartbeat);
        }
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        clearInterval(heartbeat);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
