/**
 * API-Football v3 wrapper (via RapidAPI).
 *
 * Uses the same RAPIDAPI_KEY as the golf data. The user needs to subscribe
 * to "API-Football" on RapidAPI (free tier = 100 req/day, enough for one
 * match with 30-second caching).
 *
 * Docs: https://www.api-football.com/documentation-v3
 * RapidAPI: https://rapidapi.com/api-sports/api/api-football
 */

const BASE_URL = "https://v3.football.api-sports.io";
const PREMIER_LEAGUE_ID = 39;

function getHeaders(): Record<string, string> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) throw new Error("RAPIDAPI_KEY env var is required");
  return {
    "x-rapidapi-host": "v3.football.api-sports.io",
    "x-rapidapi-key": apiKey,
  };
}

async function apiFetch(endpoint: string, params: Record<string, string>): Promise<unknown> {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}${endpoint}?${qs}`;
  console.log(`[FootballAPI] Fetching: ${url}`);
  const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
  if (!res.ok) {
    throw new Error(`API-Football error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  if (data.errors && Object.keys(data.errors).length > 0) {
    console.error("[FootballAPI] API errors:", data.errors);
  }
  return data;
}

// --- Types ------------------------------------------------------------------

export interface Fixture {
  fixture: {
    id: number;
    date: string;
    timestamp: number;
    venue: { name: string; city: string } | null;
    status: {
      long: string; // "Not Started", "First Half", "Halftime", "Second Half", "Match Finished", etc.
      short: string; // "NS", "1H", "HT", "2H", "FT", "ET", "P", "PEN", "BT", "SUSP", "INT"
      elapsed: number | null;
    };
  };
  league: { id: number; name: string; season: number; round: string };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
  };
}

export interface MatchEvent {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string };
  player: { id: number; name: string };
  assist: { id: number | null; name: string | null };
  type: string; // "Goal", "Card", "subst", "Var"
  detail: string; // "Normal Goal", "Penalty", "Own Goal", "Yellow Card", "Red Card", "Substitution 1", etc.
  comments: string | null;
}

export interface LineupPlayer {
  id: number;
  name: string;
  number: number;
  pos: string; // "G", "D", "M", "F"
}

export interface TeamLineup {
  team: { id: number; name: string; logo: string };
  formation: string | null;
  startXI: Array<{ player: LineupPlayer }>;
  substitutes: Array<{ player: LineupPlayer }>;
  coach: { id: number; name: string } | null;
}

export interface TeamStats {
  team: { id: number; name: string };
  statistics: Array<{ type: string; value: number | string | null }>;
}

// --- Fetchers ---------------------------------------------------------------

/**
 * Find fixtures for a given date + league.
 * Default: Premier League (39), current season.
 */
export async function getFixturesByDate(
  date: string,
  season: number = 2024,
  league: number = PREMIER_LEAGUE_ID
): Promise<Fixture[]> {
  const data = (await apiFetch("/fixtures", {
    date,
    league: String(league),
    season: String(season),
  })) as { response: Fixture[] };
  return data.response ?? [];
}

/**
 * Get a single fixture by ID (includes score, status).
 */
export async function getFixtureById(fixtureId: number): Promise<Fixture | null> {
  const data = (await apiFetch("/fixtures", {
    id: String(fixtureId),
  })) as { response: Fixture[] };
  return data.response?.[0] ?? null;
}

/**
 * Get match events (goals, cards, subs, VAR).
 */
export async function getFixtureEvents(fixtureId: number): Promise<MatchEvent[]> {
  const data = (await apiFetch("/fixtures/events", {
    fixture: String(fixtureId),
  })) as { response: MatchEvent[] };
  return data.response ?? [];
}

/**
 * Get team lineups (starting XI + subs).
 */
export async function getFixtureLineups(fixtureId: number): Promise<TeamLineup[]> {
  const data = (await apiFetch("/fixtures/lineups", {
    fixture: String(fixtureId),
  })) as { response: TeamLineup[] };
  return data.response ?? [];
}

/**
 * Get match statistics (corners, shots, fouls, possession, etc.).
 */
export async function getFixtureStats(fixtureId: number): Promise<TeamStats[]> {
  const data = (await apiFetch("/fixtures/statistics", {
    fixture: String(fixtureId),
  })) as { response: TeamStats[] };
  return data.response ?? [];
}

// --- Helpers ----------------------------------------------------------------

export function fixtureStatus(
  short: string
): "upcoming" | "live" | "finished" | "other" {
  if (short === "NS" || short === "TBD" || short === "PST") return "upcoming";
  if (["1H", "2H", "ET", "BT", "P", "LIVE", "HT"].includes(short))
    return "live";
  if (["FT", "AET", "PEN", "AWD", "WO"].includes(short)) return "finished";
  return "other"; // SUSP, INT, CANC, ABD
}

export function getStatValue(
  stats: TeamStats[],
  teamId: number,
  statType: string
): number | null {
  const teamStats = stats.find((s) => s.team.id === teamId);
  if (!teamStats) return null;
  const stat = teamStats.statistics.find((s) => s.type === statType);
  if (!stat || stat.value == null) return null;
  const v = typeof stat.value === "string" ? parseInt(stat.value) : stat.value;
  return isNaN(v) ? null : v;
}
