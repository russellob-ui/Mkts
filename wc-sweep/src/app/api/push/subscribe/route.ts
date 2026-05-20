import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";

let tablesEnsured = false;

export async function POST(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const body = await request.json();
    const { playerId, subscription } = body as {
      playerId?: number;
      subscription?: unknown;
    };

    if (!playerId || !subscription) {
      return NextResponse.json(
        { error: "playerId and subscription are required" },
        { status: 400 }
      );
    }

    // Validate player exists
    const existing = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.id, playerId));

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    // Store the subscription JSON
    await db
      .update(players)
      .set({ pushSubscription: JSON.stringify(subscription) })
      .where(eq(players.id, playerId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Push Subscribe]", err);
    return NextResponse.json(
      { error: "Failed to save push subscription" },
      { status: 500 }
    );
  }
}
