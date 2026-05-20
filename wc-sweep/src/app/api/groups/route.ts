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

    const allTeams = await db.select().from(wcTeams);
    const allStandings = await db.select().from(groupStandings);
    const allAssignments = await db.select().from(teamAssignments);
    const allPlayers = await db.select().from(players);

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

    const standingsMap = new Map(
      allStandings.map((s) => [s.teamId, s])
    );

    const groups: Record<string, Array<{
      teamId: number;
      teamName: string;
      flagEmoji: string;
      tier: number;
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
    }>> = {};

    for (const team of allTeams) {
      const s = standingsMap.get(team.id);
      const owner = ownerMap.get(team.id);

      const entry = {
        teamId: team.id,
        teamName: team.name,
        flagEmoji: team.flagEmoji ?? "🏳️",
        tier: team.tier,
        ownerName: owner?.ownerName ?? null,
        ownerColor: owner?.ownerColor ?? null,
        played: s?.played ?? 0,
        won: s?.won ?? 0,
        drawn: s?.drawn ?? 0,
        lost: s?.lost ?? 0,
        gf: s?.goalsFor ?? 0,
        ga: s?.goalsAgainst ?? 0,
        gd: s?.goalDifference ?? 0,
        points: s?.points ?? 0,
        position: s?.position ?? null,
        qualified: s?.qualified ?? false,
      };

      const letter = team.groupLetter;
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(entry);
    }

    for (const letter of Object.keys(groups)) {
      groups[letter].sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.gd !== b.gd) return b.gd - a.gd;
        return b.gf - a.gf;
      });
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
