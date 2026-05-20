import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  matchEvents,
  wcTeams,
  teamAssignments,
  players,
} from "@/db/schema";

export const dynamic = "force-dynamic";

let tablesEnsured = false;

export async function GET() {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const allTeams = await db.select().from(wcTeams);
    const allAssignments = await db.select().from(teamAssignments);
    const allPlayers = await db.select().from(players);
    const allEvents = await db.select().from(matchEvents);

    type Team = (typeof allTeams)[number];
    type Assignment = (typeof allAssignments)[number];
    type Player = (typeof allPlayers)[number];

    const teamById = new Map<number, Team>(allTeams.map((t) => [t.id, t]));
    const assignByTeam = new Map<number, Assignment>(allAssignments.map((a) => [a.teamId, a]));
    const playerById = new Map<number, Player>(allPlayers.map((p) => [p.id, p]));

    // Goals: group by playerName + teamId, exclude own goals
    const goalEvents = allEvents.filter(
      (e) =>
        e.eventType === "goal" &&
        e.detail !== "Own Goal" &&
        e.playerName
    );

    const goalMap = new Map<
      string,
      { playerName: string; teamId: number; goals: number }
    >();

    for (const e of goalEvents) {
      const key = `${e.playerName}|${e.teamId}`;
      const existing = goalMap.get(key);
      if (existing) {
        existing.goals++;
      } else {
        goalMap.set(key, {
          playerName: e.playerName!,
          teamId: e.teamId,
          goals: 1,
        });
      }
    }

    const scorers = Array.from(goalMap.values())
      .sort((a, b) => b.goals - a.goals)
      .map((s) => {
        const team = teamById.get(s.teamId);
        const assign = assignByTeam.get(s.teamId);
        const owner = assign ? playerById.get(assign.playerId) : null;
        return {
          playerName: s.playerName,
          teamName: team?.name ?? "?",
          flagEmoji: team?.flagEmoji ?? "",
          goals: s.goals,
          ownerName: owner?.name ?? null,
          ownerColor: owner?.color ?? null,
        };
      });

    // Assists: group by assistPlayerName + teamId
    const assistEvents = allEvents.filter(
      (e) =>
        e.eventType === "goal" &&
        e.assistPlayerName &&
        e.assistPlayerName.trim() !== ""
    );

    const assistMap = new Map<
      string,
      { playerName: string; teamId: number; assists: number }
    >();

    for (const e of assistEvents) {
      const key = `${e.assistPlayerName}|${e.teamId}`;
      const existing = assistMap.get(key);
      if (existing) {
        existing.assists++;
      } else {
        assistMap.set(key, {
          playerName: e.assistPlayerName!,
          teamId: e.teamId,
          assists: 1,
        });
      }
    }

    const assists = Array.from(assistMap.values())
      .sort((a, b) => b.assists - a.assists)
      .map((a) => {
        const team = teamById.get(a.teamId);
        const assign = assignByTeam.get(a.teamId);
        const owner = assign ? playerById.get(assign.playerId) : null;
        return {
          playerName: a.playerName,
          teamName: team?.name ?? "?",
          flagEmoji: team?.flagEmoji ?? "",
          assists: a.assists,
          ownerName: owner?.name ?? null,
          ownerColor: owner?.color ?? null,
        };
      });

    return NextResponse.json({ scorers, assists });
  } catch (err) {
    console.error("[GoldenBoot]", err);
    return NextResponse.json(
      { error: "Failed to load golden boot data" },
      { status: 500 }
    );
  }
}
