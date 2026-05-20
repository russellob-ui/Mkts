import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  groupStandings,
  wcTeams,
  teamAssignments,
  players,
} from "@/db/schema";

let tablesEnsured = false;

export async function GET() {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const allStandings = await db.select().from(groupStandings);
    const allTeams = await db.select().from(wcTeams);
    const allAssignments = await db.select().from(teamAssignments);
    const allPlayers = await db.select().from(players);

    // Build a map of teamId -> owner player
    const ownerMap = new Map<
      number,
      { ownerName: string; ownerColor: string }
    >();
    for (const a of allAssignments) {
      const player = allPlayers.find((p) => p.id === a.playerId);
      if (player) {
        ownerMap.set(a.teamId, {
          ownerName: player.name,
          ownerColor: player.color ?? "#ffffff",
        });
      }
    }

    // Group standings by group letter
    const groups: Record<
      string,
      Array<{
        teamId: number;
        teamName: string;
        flagEmoji: string;
        ownerName: string | null;
        ownerColor: string | null;
        played: number;
        won: number;
        drawn: number;
        lost: number;
        gf: number;
        ga: number;
        gd: number;
        points: number;
        position: number | null;
        qualified: boolean;
      }>
    > = {};

    for (const s of allStandings) {
      const team = allTeams.find((t) => t.id === s.teamId);
      const owner = ownerMap.get(s.teamId);

      const entry = {
        teamId: s.teamId,
        teamName: team?.name ?? "?",
        flagEmoji: team?.flagEmoji ?? "🏳️",
        ownerName: owner?.ownerName ?? null,
        ownerColor: owner?.ownerColor ?? null,
        played: s.played,
        won: s.won,
        drawn: s.drawn,
        lost: s.lost,
        gf: s.goalsFor,
        ga: s.goalsAgainst,
        gd: s.goalDifference,
        points: s.points,
        position: s.position,
        qualified: s.qualified ?? false,
      };

      if (!groups[s.groupLetter]) {
        groups[s.groupLetter] = [];
      }
      groups[s.groupLetter].push(entry);
    }

    // Sort each group by position
    for (const letter of Object.keys(groups)) {
      groups[letter].sort(
        (a, b) => (a.position ?? 999) - (b.position ?? 999)
      );
    }

    return NextResponse.json({ groups });
  } catch (err) {
    console.error("[Groups]", err);
    return NextResponse.json(
      { error: "Failed to load groups" },
      { status: 500 }
    );
  }
}
