import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  commissionerActions,
  pointsLog,
  teamAssignments,
} from "@/db/schema";
import { eq } from "drizzle-orm";

let tablesEnsured = false;

interface CommissionerActionBody {
  matchId?: number;
  affectedPlayerId?: number;
  actionType: string;
  pointsDelta?: number;
  headline: string;
  reason?: string;
  emoji?: string;
}

export async function POST(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const body: CommissionerActionBody = await request.json();

    if (!body.actionType || !body.headline) {
      return NextResponse.json(
        { error: "actionType and headline are required" },
        { status: 400 }
      );
    }

    // Insert the commissioner action
    const [action] = await db
      .insert(commissionerActions)
      .values({
        matchId: body.matchId ?? null,
        affectedPlayerId: body.affectedPlayerId ?? null,
        actionType: body.actionType,
        pointsDelta: body.pointsDelta ?? null,
        headline: body.headline,
        reason: body.reason ?? null,
        emoji: body.emoji ?? null,
      })
      .returning();

    // If pointsDelta provided and affectedPlayerId is set,
    // insert into points_log for each of the player's teams
    if (
      body.pointsDelta !== undefined &&
      body.pointsDelta !== null &&
      body.affectedPlayerId
    ) {
      // Get this player's team assignments
      const assignments = await db
        .select()
        .from(teamAssignments)
        .where(eq(teamAssignments.playerId, body.affectedPlayerId));

      // Distribute the points delta across all their teams (applied once, to first team)
      // Commissioner points go as a single entry against the first assigned team
      if (assignments.length > 0) {
        const targetTeamId = assignments[0].teamId;
        await db.insert(pointsLog).values({
          playerId: body.affectedPlayerId,
          teamId: targetTeamId,
          matchId: body.matchId ?? null,
          source: "commissioner",
          points: body.pointsDelta,
          note: body.headline,
        });
      }
    }

    return NextResponse.json({ action }, { status: 201 });
  } catch (err) {
    console.error("[Commissioner Action]", err);
    return NextResponse.json(
      { error: "Failed to create commissioner action" },
      { status: 500 }
    );
  }
}
