import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  drawState,
  teamAssignments,
  wcTeams,
  players,
} from "@/db/schema";

let tablesEnsured = false;

export async function GET() {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const stateRows = await db.select().from(drawState);
    const state = stateRows[0];

    if (!state || state.status === "not_started") {
      return NextResponse.json({ status: "not_started" });
    }

    if (state.status === "live") {
      return NextResponse.json({
        status: "live",
        currentIndex: state.currentIndex ?? 0,
        revealOrder: state.revealOrder ?? [],
        seed: state.seed,
      });
    }

    // status === "complete"
    const allAssignments = await db.select().from(teamAssignments);
    const allTeams = await db.select().from(wcTeams);
    const allPlayers = await db.select().from(players);

    const assignments = allAssignments.map((a) => {
      const team = allTeams.find((t) => t.id === a.teamId);
      const player = allPlayers.find((p) => p.id === a.playerId);
      return {
        teamId: a.teamId,
        playerId: a.playerId,
        drawOrder: a.drawOrder,
        teamName: team?.name ?? "?",
        flagEmoji: team?.flagEmoji ?? "\u{1F3F3}️",
        tier: team?.tier ?? 1,
        groupLetter: team?.groupLetter ?? "?",
        playerName: player?.name ?? "?",
        playerColor: player?.color ?? "#ffffff",
      };
    });

    return NextResponse.json({
      status: "complete",
      seed: state.seed,
      completedAt: state.completedAt?.toISOString() ?? null,
      assignments,
    });
  } catch (err) {
    console.error("[Draw Status]", err);
    return NextResponse.json(
      { error: "Failed to load draw status" },
      { status: 500 }
    );
  }
}
