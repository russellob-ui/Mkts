import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  drawState,
  teamAssignments,
  wcTeams,
  players,
} from "@/db/schema";
import { generateSeed, generateDraw } from "@/lib/draw";
import { eq } from "drizzle-orm";
import { verifyAdminRequest } from "@/lib/admin-auth";

let tablesEnsured = false;

export async function POST(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const authError = await verifyAdminRequest(request);
    if (authError) return authError;

    // Check if draw already completed
    const stateRows = await db.select().from(drawState);
    const existing = stateRows[0];
    if (existing && existing.status === "complete") {
      return NextResponse.json(
        { error: "Draw already completed" },
        { status: 409 }
      );
    }

    // Load players and teams
    const allPlayers = await db.select().from(players);
    const allTeams = await db.select().from(wcTeams);

    if (allPlayers.length < 2) {
      return NextResponse.json(
        { error: "Need at least 2 players to run the draw" },
        { status: 400 }
      );
    }
    if (allTeams.length === 0) {
      return NextResponse.json(
        { error: "No teams in database. Seed teams first." },
        { status: 400 }
      );
    }

    // Generate seed and run draw
    const seed = generateSeed();
    const playerIds = allPlayers.map((p) => p.id);
    const teamsForDraw = allTeams.map((t) => ({ id: t.id, tier: t.tier }));
    const assignments = generateDraw(teamsForDraw, playerIds, seed);

    // Insert team_assignments
    for (const a of assignments) {
      await db.insert(teamAssignments).values({
        playerId: a.playerId,
        teamId: a.teamId,
        drawOrder: a.order,
      });
    }

    // Upsert draw_state to "complete"
    if (existing) {
      await db
        .update(drawState)
        .set({
          status: "complete",
          seed,
          revealOrder: assignments.map((a) => ({
            teamId: a.teamId,
            playerId: a.playerId,
          })),
          drawLog: assignments,
          startedAt: new Date(),
          completedAt: new Date(),
        })
        .where(eq(drawState.id, existing.id));
    } else {
      await db.insert(drawState).values({
        status: "complete",
        seed,
        revealOrder: assignments.map((a) => ({
          teamId: a.teamId,
          playerId: a.playerId,
        })),
        drawLog: assignments,
        startedAt: new Date(),
        completedAt: new Date(),
      });
    }

    // Build response with full details
    const result = assignments.map((a) => {
      const team = allTeams.find((t) => t.id === a.teamId);
      const player = allPlayers.find((p) => p.id === a.playerId);
      return {
        teamId: a.teamId,
        playerId: a.playerId,
        drawOrder: a.order,
        teamName: team?.name ?? "?",
        flagEmoji: team?.flagEmoji ?? "\u{1F3F3}️",
        tier: team?.tier ?? 1,
        groupLetter: team?.groupLetter ?? "?",
        playerName: player?.name ?? "?",
      };
    });

    return NextResponse.json({
      status: "complete",
      seed,
      assignments: result,
    });
  } catch (err) {
    console.error("[Draw Start]", err);
    return NextResponse.json(
      { error: "Failed to run draw" },
      { status: 500 }
    );
  }
}
