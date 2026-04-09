import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { commissionerActions, pointsLog } from "@/db/schema";

export async function POST(request: NextRequest) {
  try {
    const passcode = request.headers.get("x-commissioner-passcode");
    if (passcode !== process.env.COMMISSIONER_PASSCODE) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureTables();

    const {
      actionType,
      affectedPlayerId,
      pointsDelta,
      headline,
      reason,
      emoji,
      tournamentId,
    } = await request.json();

    if (!actionType || !headline) {
      return NextResponse.json(
        { error: "actionType and headline are required" },
        { status: 400 }
      );
    }

    const [action] = await db
      .insert(commissionerActions)
      .values({
        actionType,
        affectedPlayerId: affectedPlayerId ?? null,
        pointsDelta: pointsDelta ?? null,
        headline,
        reason: reason ?? null,
        emoji: emoji ?? null,
        tournamentId: tournamentId ?? null,
      })
      .returning();

    // If bonus or deduction, also log points
    if (
      (actionType === "bonus" || actionType === "deduction") &&
      affectedPlayerId &&
      pointsDelta != null &&
      tournamentId
    ) {
      await db.insert(pointsLog).values({
        playerId: affectedPlayerId,
        tournamentId,
        source: "commissioner",
        points: pointsDelta,
        note: `${actionType}: ${headline}`,
      });
    }

    return NextResponse.json({ action });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
