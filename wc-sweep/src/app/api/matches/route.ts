import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  matches,
  matchEvents,
  wcTeams,
  teamAssignments,
  players,
} from "@/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { pollLiveMatches } from "@/lib/poll-matches";

let tablesEnsured = false;

export async function GET(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");

    // Preload lookup tables
    const allTeams = await db.select().from(wcTeams);
    const allAssignments = await db.select().from(teamAssignments);
    const allPlayers = await db.select().from(players);

    type Team = (typeof allTeams)[number];
    type Assignment = (typeof allAssignments)[number];
    type Player = (typeof allPlayers)[number];

    const teamById = new Map<number, Team>(allTeams.map((t) => [t.id, t]));
    const assignmentByTeamId = new Map<number, Assignment>(
      allAssignments.map((a) => [a.teamId, a])
    );
    const playerById = new Map<number, Player>(allPlayers.map((p) => [p.id, p]));

    // Check if any live matches need re-polling (lastPolledAt > 30s ago)
    const staleThreshold = new Date(Date.now() - 30_000);
    const staleLive = await db
      .select({ id: matches.id })
      .from(matches)
      .where(
        and(
          eq(matches.status, "live"),
          lte(matches.lastPolledAt, staleThreshold)
        )
      );

    // Also catch live matches that have never been polled
    const neverPolled = await db
      .select({ id: matches.id })
      .from(matches)
      .where(
        and(
          eq(matches.status, "live"),
          sql`${matches.lastPolledAt} IS NULL`
        )
      );

    if (staleLive.length > 0 || neverPolled.length > 0) {
      try {
        await pollLiveMatches();
      } catch (err) {
        console.error("[Matches] Poll error:", err);
      }
    }

    // Build date ranges for query
    const now = new Date();

    if (dateParam) {
      // Specific date requested
      const dayStart = new Date(`${dateParam}T00:00:00.000Z`);
      const dayEnd = new Date(`${dateParam}T23:59:59.999Z`);

      const dayMatches = await db
        .select()
        .from(matches)
        .where(and(gte(matches.kickoff, dayStart), lte(matches.kickoff, dayEnd)));

      const enriched = await enrichMatches(
        dayMatches,
        teamById,
        assignmentByTeamId,
        playerById
      );

      return NextResponse.json({ matches: enriched });
    }

    // No date param — return today + upcoming 48h + recent 48h
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const past48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const next48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const [todayRows, recentRows, upcomingRows] = await Promise.all([
      db
        .select()
        .from(matches)
        .where(
          and(gte(matches.kickoff, todayStart), lte(matches.kickoff, todayEnd))
        ),
      db
        .select()
        .from(matches)
        .where(
          and(
            gte(matches.kickoff, past48h),
            lte(matches.kickoff, todayStart),
            eq(matches.status, "finished")
          )
        ),
      db
        .select()
        .from(matches)
        .where(
          and(
            gte(matches.kickoff, todayEnd),
            lte(matches.kickoff, next48h),
            eq(matches.status, "scheduled")
          )
        ),
    ]);

    const [todayEnriched, recentEnriched, upcomingEnriched] = await Promise.all(
      [
        enrichMatches(todayRows, teamById, assignmentByTeamId, playerById),
        enrichMatches(recentRows, teamById, assignmentByTeamId, playerById),
        enrichMatches(upcomingRows, teamById, assignmentByTeamId, playerById),
      ]
    );

    return NextResponse.json({
      today: todayEnriched,
      recent: recentEnriched,
      upcoming: upcomingEnriched,
    });
  } catch (err) {
    console.error("[Matches]", err);
    return NextResponse.json(
      { error: "Failed to load matches" },
      { status: 500 }
    );
  }
}

// ---- Helpers ----

async function enrichMatches(
  rows: (typeof matches.$inferSelect)[],
  teamById: Map<number, typeof wcTeams.$inferSelect>,
  assignmentByTeamId: Map<number, typeof teamAssignments.$inferSelect>,
  playerById: Map<number, typeof players.$inferSelect>
) {
  const enriched = [];

  for (const m of rows) {
    const home = teamById.get(m.homeTeamId);
    const away = teamById.get(m.awayTeamId);
    const homeAssign = assignmentByTeamId.get(m.homeTeamId);
    const awayAssign = assignmentByTeamId.get(m.awayTeamId);
    const homeOwner = homeAssign
      ? playerById.get(homeAssign.playerId)?.name ?? null
      : null;
    const awayOwner = awayAssign
      ? playerById.get(awayAssign.playerId)?.name ?? null
      : null;

    // Fetch events for live/finished matches
    let events: {
      eventType: string;
      playerName: string | null;
      minute: number | null;
      detail: string | null;
      teamName: string | null;
    }[] = [];

    if (m.status === "live" || m.status === "finished") {
      const eventRows = await db
        .select()
        .from(matchEvents)
        .where(eq(matchEvents.matchId, m.id));

      events = eventRows.map((e) => ({
        eventType: e.eventType,
        playerName: e.playerName,
        minute: e.minute,
        detail: e.detail,
        teamName: teamById.get(e.teamId)?.name ?? null,
      }));
    }

    enriched.push({
      id: m.id,
      apiFixtureId: m.apiFixtureId,
      homeTeam: home?.name ?? "?",
      awayTeam: away?.name ?? "?",
      homeFlag: home?.flagEmoji ?? "🏳️",
      awayFlag: away?.flagEmoji ?? "🏳️",
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      homePenalties: m.homePenalties,
      awayPenalties: m.awayPenalties,
      status: m.status,
      minute: m.minute,
      kickoff: m.kickoff?.toISOString() ?? "",
      homeOwner,
      awayOwner,
      stage: m.stage,
      groupLetter: m.groupLetter,
      venue: m.venue,
      city: m.city,
      events,
    });
  }

  return enriched.sort(
    (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
  );
}
