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
import { resolvePredictions } from "@/lib/resolve-predictions";
import { sendWhatsAppGroupMessage } from "@/lib/whatsapp";

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

  // Check if either player activated a wildcard on this match
  const wildcardRows = await db.select().from(pointsLog).where(
    and(eq(pointsLog.matchId, matchId), eq(pointsLog.source, "wildcard_activated"))
  );
  const wildcardPlayerIds = new Set(wildcardRows.map((r) => r.playerId));

  // Award points for home team
  if (homeAssignment) {
    const homeWildcard = wildcardPlayerIds.has(homeAssignment.playerId);
    const multiplier = homeWildcard ? 2 : 1;
    const homePoints = calcMatchPoints(
      homeScore,
      awayScore,
      homeTeam.id,
      match.homeTeamId,
      match.awayTeamId,
      homeTeam.tier
    );
    for (const entry of homePoints) {
      const pts = entry.points * multiplier;
      const note = homeWildcard ? `${entry.note} [WILDCARD x2]` : entry.note;
      await db.execute(sql`
        INSERT INTO points_log (player_id, team_id, match_id, source, points, note)
        VALUES (
          ${homeAssignment.playerId},
          ${homeTeam.id},
          ${matchId},
          ${entry.source},
          ${pts},
          ${note}
        )
        ON CONFLICT (player_id, team_id, match_id, source) DO NOTHING
      `);
    }
  }

  // Award points for away team
  if (awayAssignment) {
    const awayWildcard = wildcardPlayerIds.has(awayAssignment.playerId);
    const multiplier = awayWildcard ? 2 : 1;
    const awayPoints = calcMatchPoints(
      homeScore,
      awayScore,
      awayTeam.id,
      match.homeTeamId,
      match.awayTeamId,
      awayTeam.tier
    );
    for (const entry of awayPoints) {
      const pts = entry.points * multiplier;
      const note = awayWildcard ? `${entry.note} [WILDCARD x2]` : entry.note;
      await db.execute(sql`
        INSERT INTO points_log (player_id, team_id, match_id, source, points, note)
        VALUES (
          ${awayAssignment.playerId},
          ${awayTeam.id},
          ${matchId},
          ${entry.source},
          ${pts},
          ${note}
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
    const drawNames = [homeOwner, awayOwner].filter(Boolean).join(" & ");
    headline = `FT: ${scoreLine} — honours even${drawNames ? ` for ${drawNames}` : ""}`;
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

  // Send rich full-time WhatsApp message
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "mkts-dun.vercel.app";
  const hFlag = homeTeam.flagEmoji ?? "";
  const aFlag = awayTeam.flagEmoji ?? "";
  const ftMsg = `🏁 *FULL TIME*\n\n${hFlag} *${homeTeam.name} ${homeScore}* - ${awayScore} ${awayTeam.name} ${aFlag}\n\n*Points:*\n${homeOwner ?? "Unowned"}: +pts\n${awayOwner ?? "Unowned"}: +pts\n\n📊 Standings → ${appUrl}`;
  try {
    await sendWhatsAppGroupMessage(ftMsg);
  } catch { /* non-fatal */ }

  // Resolve predictions for this match
  try {
    await resolvePredictions(matchId);
  } catch (err) {
    console.error(`[settleMatch] Failed to resolve predictions for match ${matchId}:`, err);
  }
}

// ---- Helpers ----

function mapEventType(type: string, detail: string): string {
  const t = type.toLowerCase();
  if (t === "goal") {
    if (detail === "Missed Penalty") return "penalty_miss";
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

  const homeFlag = (homeTeam as Record<string, unknown>).flagEmoji as string ?? "";
  const awayFlag = (awayTeam as Record<string, unknown>).flagEmoji as string ?? "";
  const homeScore = fixture.goals.home ?? 0;
  const awayScore = fixture.goals.away ?? 0;
  const ownerName = owner?.name ?? "Unowned";
  const tierMult = assignment ? `x${((scoringTeam as Record<string, unknown>).tier as number) ?? 1}.0` : "";

  let waMsg: string;
  if (isOwnGoal) {
    waMsg = `😬 *OWN GOAL!* ${minute}'\n\n${homeFlag} *${homeTeam.name} ${homeScore}* - ${awayScore} ${awayTeam.name} ${awayFlag}\n\n😬 ${playerName} puts it in his own net\n\n_${ownerName} affected_`;
  } else if (isPenalty) {
    waMsg = `🎯 *PENALTY GOAL!* ${minute}'\n\n${homeFlag} *${homeTeam.name} ${homeScore}* - ${awayScore} ${awayTeam.name} ${awayFlag}\n\n🎯 ${playerName} converts from the spot${evt.assist?.name ? ` (Won by: ${evt.assist.name})` : ""}\n\n_${ownerName} picks up pts (${tierMult})_`;
  } else {
    waMsg = `⚽ *GOAL!* ${minute}'\n\n${homeFlag} *${homeTeam.name} ${homeScore}* - ${awayScore} ${awayTeam.name} ${awayFlag}\n\n⚽ ${playerName}${evt.assist?.name ? ` (Assist: ${evt.assist.name})` : ""}\n\n_${ownerName} picks up pts (${tierMult})_`;
  }

  try {
    await db.insert(banterEvents).values({
      matchId,
      playerId: assignment?.playerId ?? null,
      teamId: scoringTeam.id,
      eventType: isOwnGoal ? "own_goal" : "goal",
      headline,
      detail: `${homeTeam.name} ${homeScore}-${awayScore} ${awayTeam.name}`,
      emoji,
      importance,
      source: "auto",
    });
    try {
      await sendWhatsAppGroupMessage(waMsg);
    } catch { /* non-fatal */ }
    return true;
  } catch {
    return false;
  }
}
