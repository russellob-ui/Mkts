import { db } from "@/db";
import {
  matches,
  matchEvents,
  wcTeams,
  teamAssignments,
  players,
  pointsLog,
  banterEvents,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  getLiveFixtures,
  getFixtureEvents,
  mapStatus,
  type ApiFixture,
  type ApiEvent,
} from "@/lib/api-football";
import { calcMatchPoints } from "@/lib/points";

// ---- Types ----

interface PollSummary {
  matchesPolled: number;
  eventsInserted: number;
  matchesSettled: number;
  banterGenerated: number;
  errors: string[];
}

// ---- Core polling engine ----

export async function pollLiveMatches(): Promise<PollSummary> {
  const summary: PollSummary = {
    matchesPolled: 0,
    eventsInserted: 0,
    matchesSettled: 0,
    banterGenerated: 0,
    errors: [],
  };

  let liveFixtures: ApiFixture[];
  try {
    liveFixtures = await getLiveFixtures();
  } catch (err) {
    summary.errors.push(
      `Failed to fetch live fixtures: ${err instanceof Error ? err.message : String(err)}`
    );
    return summary;
  }

  if (liveFixtures.length === 0) return summary;

  // Preload lookup tables once
  const allTeams = await db.select().from(wcTeams);
  const allAssignments = await db.select().from(teamAssignments);
  const allPlayers = await db.select().from(players);

  type Team = (typeof allTeams)[number];
  type Assignment = (typeof allAssignments)[number];
  type Player = (typeof allPlayers)[number];

  const teamById = new Map<number, Team>(allTeams.map((t) => [t.id, t]));
  const teamByApiId = new Map<number | null, Team>(allTeams.map((t) => [t.apiTeamId, t]));
  const assignmentByTeamId = new Map<number, Assignment>(allAssignments.map((a) => [a.teamId, a]));
  const playerById = new Map<number, Player>(allPlayers.map((p) => [p.id, p]));

  for (const fixture of liveFixtures) {
    try {
      const apiFixtureId = fixture.fixture.id;
      const newStatus = mapStatus(fixture.fixture.status.short);
      const homeApiTeamId = fixture.teams.home.id;
      const awayApiTeamId = fixture.teams.away.id;
      const homeTeam = teamByApiId.get(homeApiTeamId);
      const awayTeam = teamByApiId.get(awayApiTeamId);

      if (!homeTeam || !awayTeam) {
        summary.errors.push(
          `Fixture ${apiFixtureId}: unknown team(s) home=${homeApiTeamId} away=${awayApiTeamId}`
        );
        continue;
      }

      // Upsert the match row
      const existingMatches = await db
        .select()
        .from(matches)
        .where(eq(matches.apiFixtureId, apiFixtureId));

      const previousStatus = existingMatches[0]?.status;

      await db.execute(sql`
        INSERT INTO matches (api_fixture_id, home_team_id, away_team_id, stage, group_letter, kickoff, status, home_score, away_score, home_penalties, away_penalties, minute, venue, city, last_polled_at)
        VALUES (
          ${apiFixtureId},
          ${homeTeam.id},
          ${awayTeam.id},
          ${existingMatches[0]?.stage ?? "GS"},
          ${existingMatches[0]?.groupLetter ?? null},
          ${fixture.fixture.date},
          ${newStatus},
          ${fixture.goals.home ?? null},
          ${fixture.goals.away ?? null},
          ${fixture.score.penalty.home ?? null},
          ${fixture.score.penalty.away ?? null},
          ${fixture.fixture.status.elapsed ?? null},
          ${fixture.fixture.venue?.name ?? null},
          ${fixture.fixture.venue?.city ?? null},
          NOW()
        )
        ON CONFLICT (api_fixture_id) DO UPDATE SET
          status = EXCLUDED.status,
          home_score = EXCLUDED.home_score,
          away_score = EXCLUDED.away_score,
          home_penalties = EXCLUDED.home_penalties,
          away_penalties = EXCLUDED.away_penalties,
          minute = EXCLUDED.minute,
          last_polled_at = NOW()
      `);

      summary.matchesPolled++;

      // Re-read the match to get its DB id
      const [matchRow] = await db
        .select()
        .from(matches)
        .where(eq(matches.apiFixtureId, apiFixtureId));

      if (!matchRow) continue;

      // Fetch and upsert events
      let events: ApiEvent[];
      try {
        events = await getFixtureEvents(apiFixtureId);
      } catch (err) {
        summary.errors.push(
          `Fixture ${apiFixtureId} events: ${err instanceof Error ? err.message : String(err)}`
        );
        events = [];
      }

      for (const evt of events) {
        const evtTeam = teamByApiId.get(evt.team.id);
        if (!evtTeam) continue;

        // Map API event type to our schema
        const eventType = mapEventType(evt.type, evt.detail);

        try {
          await db.execute(sql`
            INSERT INTO match_events (match_id, team_id, event_type, player_name, assist_player_name, minute, detail)
            VALUES (
              ${matchRow.id},
              ${evtTeam.id},
              ${eventType},
              ${evt.player?.name ?? null},
              ${evt.assist?.name ?? null},
              ${evt.time.elapsed + (evt.time.extra ?? 0)},
              ${evt.detail}
            )
            ON CONFLICT (match_id, event_type, minute, player_name) DO NOTHING
          `);
          summary.eventsInserted++;
        } catch {
          // Dedup conflict — expected
        }

        // Generate banter for goals
        if (eventType === "goal" || eventType === "penalty_goal") {
          const banterResult = await generateGoalBanter(
            matchRow.id,
            evtTeam,
            evt,
            assignmentByTeamId,
            playerById,
            homeTeam,
            awayTeam,
            fixture
          );
          if (banterResult) summary.banterGenerated++;
        }
      }

      // Settle match if status just changed to finished
      if (newStatus === "finished" && previousStatus !== "finished") {
        try {
          await settleMatch(matchRow.id);
          summary.matchesSettled++;
        } catch (err) {
          summary.errors.push(
            `Settle match ${matchRow.id}: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
    } catch (err) {
      summary.errors.push(
        `Fixture loop error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return summary;
}

// ---- Settle a finished match ----

export async function settleMatch(matchId: number): Promise<void> {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId));

  if (!match) throw new Error(`Match ${matchId} not found`);
  if (match.homeScore == null || match.awayScore == null) {
    throw new Error(`Match ${matchId} has no score`);
  }

  const homeScore = match.homeScore;
  const awayScore = match.awayScore;

  // Look up teams and their tiers
  const [homeTeam] = await db
    .select()
    .from(wcTeams)
    .where(eq(wcTeams.id, match.homeTeamId));
  const [awayTeam] = await db
    .select()
    .from(wcTeams)
    .where(eq(wcTeams.id, match.awayTeamId));

  if (!homeTeam || !awayTeam) {
    throw new Error(`Match ${matchId}: team(s) not found`);
  }

  // Look up owners
  const [homeAssignment] = await db
    .select()
    .from(teamAssignments)
    .where(eq(teamAssignments.teamId, match.homeTeamId));
  const [awayAssignment] = await db
    .select()
    .from(teamAssignments)
    .where(eq(teamAssignments.teamId, match.awayTeamId));

  // Award points for home team
  if (homeAssignment) {
    const homePoints = calcMatchPoints(
      homeScore,
      awayScore,
      homeTeam.id,
      match.homeTeamId,
      match.awayTeamId,
      homeTeam.tier
    );
    for (const entry of homePoints) {
      await db.execute(sql`
        INSERT INTO points_log (player_id, team_id, match_id, source, points, note)
        VALUES (
          ${homeAssignment.playerId},
          ${homeTeam.id},
          ${matchId},
          ${entry.source},
          ${entry.points},
          ${entry.note}
        )
        ON CONFLICT (player_id, team_id, match_id, source) DO NOTHING
      `);
    }
  }

  // Award points for away team
  if (awayAssignment) {
    const awayPoints = calcMatchPoints(
      homeScore,
      awayScore,
      awayTeam.id,
      match.homeTeamId,
      match.awayTeamId,
      awayTeam.tier
    );
    for (const entry of awayPoints) {
      await db.execute(sql`
        INSERT INTO points_log (player_id, team_id, match_id, source, points, note)
        VALUES (
          ${awayAssignment.playerId},
          ${awayTeam.id},
          ${matchId},
          ${entry.source},
          ${entry.points},
          ${entry.note}
        )
        ON CONFLICT (player_id, team_id, match_id, source) DO NOTHING
      `);
    }
  }

  // Determine winner (regulation score — penalties only affect who advances)
  let winnerTeamId: number | null = null;
  if (homeScore > awayScore) {
    winnerTeamId = match.homeTeamId;
  } else if (awayScore > homeScore) {
    winnerTeamId = match.awayTeamId;
  }
  // For penalty shootouts, use penalties to determine winner
  if (
    winnerTeamId == null &&
    match.homePenalties != null &&
    match.awayPenalties != null
  ) {
    if (match.homePenalties > match.awayPenalties) {
      winnerTeamId = match.homeTeamId;
    } else if (match.awayPenalties > match.homePenalties) {
      winnerTeamId = match.awayTeamId;
    }
  }

  await db
    .update(matches)
    .set({ winnerTeamId, status: "finished" })
    .where(eq(matches.id, matchId));

  // Generate match-settled banter
  const homeOwner = homeAssignment
    ? (
        await db
          .select()
          .from(players)
          .where(eq(players.id, homeAssignment.playerId))
      )[0]?.name
    : null;
  const awayOwner = awayAssignment
    ? (
        await db
          .select()
          .from(players)
          .where(eq(players.id, awayAssignment.playerId))
      )[0]?.name
    : null;

  const scoreLine = `${homeTeam.name} ${homeScore}-${awayScore} ${awayTeam.name}`;
  let headline: string;
  let emoji: string;
  let importance: number;

  if (winnerTeamId === match.homeTeamId) {
    headline = `FT: ${scoreLine}! ${homeOwner ?? "Unowned"} picks up points`;
    emoji = "🎉";
    importance = 7;
  } else if (winnerTeamId === match.awayTeamId) {
    headline = `FT: ${scoreLine}! ${awayOwner ?? "Unowned"} picks up points`;
    emoji = "🎉";
    importance = 7;
  } else {
    headline = `FT: ${scoreLine} — honours even`;
    emoji = "🤝";
    importance = 5;
  }

  await db.insert(banterEvents).values({
    matchId,
    playerId:
      winnerTeamId === match.homeTeamId
        ? (homeAssignment?.playerId ?? null)
        : winnerTeamId === match.awayTeamId
          ? (awayAssignment?.playerId ?? null)
          : null,
    teamId: winnerTeamId,
    eventType: "match_settled",
    headline,
    emoji,
    importance,
    source: "auto",
  });
}

// ---- Helpers ----

function mapEventType(type: string, detail: string): string {
  const t = type.toLowerCase();
  if (t === "goal") {
    if (detail === "Penalty") return "penalty_goal";
    if (detail === "Own Goal") return "own_goal";
    return "goal";
  }
  if (t === "card") {
    if (detail === "Yellow Card") return "yellow_card";
    if (detail === "Red Card") return "red_card";
    if (detail === "Second Yellow card") return "second_yellow";
    return "card";
  }
  if (t === "subst") return "substitution";
  if (t === "var") return "var_decision";
  return t;
}

async function generateGoalBanter(
  matchId: number,
  scoringTeam: { id: number; name: string; flagEmoji: string | null; [key: string]: unknown },
  evt: ApiEvent,
  assignmentByTeamId: Map<number, { playerId: number; teamId: number; [key: string]: unknown }>,
  playerById: Map<number, { id: number; name: string; [key: string]: unknown }>,
  homeTeam: { id: number; name: string; [key: string]: unknown },
  awayTeam: { id: number; name: string; [key: string]: unknown },
  fixture: ApiFixture
): Promise<boolean> {
  const assignment = assignmentByTeamId.get(scoringTeam.id);
  const owner = assignment ? playerById.get(assignment.playerId) : null;
  const ownerTag = owner ? ` [${owner.name} +pts]` : "";
  const minute = evt.time.elapsed + (evt.time.extra ?? 0);
  const playerName = evt.player?.name ?? "Unknown";

  const isOwnGoal = evt.detail === "Own Goal";
  const isPenalty = evt.detail === "Penalty";

  let headline: string;
  let emoji: string;
  let importance: number;

  if (isOwnGoal) {
    headline = `OG! ${playerName} puts it in his own net (${minute}')${ownerTag}`;
    emoji = "😬";
    importance = 7;
  } else if (isPenalty) {
    headline = `${scoringTeam.flagEmoji ?? "⚽"} PENALTY! ${playerName} scores for ${scoringTeam.name} (${minute}')${ownerTag}`;
    emoji = "🎯";
    importance = 7;
  } else {
    headline = `${scoringTeam.flagEmoji ?? "⚽"} GOAL! ${playerName} scores for ${scoringTeam.name} (${minute}')${ownerTag}`;
    emoji = "⚽";
    importance = 8;
  }

  const score = `${fixture.goals.home ?? 0}-${fixture.goals.away ?? 0}`;
  const detail = `${homeTeam.name} ${score} ${awayTeam.name}`;

  try {
    await db.insert(banterEvents).values({
      matchId,
      playerId: assignment?.playerId ?? null,
      teamId: scoringTeam.id,
      eventType: isOwnGoal ? "own_goal" : "goal",
      headline,
      detail,
      emoji,
      importance,
      source: "auto",
    });
    return true;
  } catch {
    return false;
  }
}
