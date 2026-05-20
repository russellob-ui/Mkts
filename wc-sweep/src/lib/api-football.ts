const BASE_URL = "https://v3.football.api-sports.io";

function getHeaders(): Record<string, string> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY not set");
  return {
    "x-apisports-key": key,
  };
}

const cache = new Map<string, { data: unknown; ts: number }>();

async function cachedFetch<T>(url: string, ttlMs: number): Promise<T> {
  const now = Date.now();
  const hit = cache.get(url);
  if (hit && now - hit.ts < ttlMs) return hit.data as T;

  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) {
    throw new Error(`API-Football ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  cache.set(url, { data: json, ts: now });
  return json as T;
}

// ---- Fixtures ----

export interface ApiFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null };
    venue: { name: string; city: string } | null;
  };
  league: { id: number; round: string };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
  score: {
    penalty: { home: number | null; away: number | null };
  };
}

export async function getLiveFixtures(): Promise<ApiFixture[]> {
  const data = await cachedFetch<{ response: ApiFixture[] }>(
    `${BASE_URL}/fixtures?live=all`,
    25_000
  );
  return (data.response ?? []).filter(
    (f) => f.league.id === 1
  );
}

export async function getFixturesByLeague(
  season: number
): Promise<ApiFixture[]> {
  const data = await cachedFetch<{ response: ApiFixture[] }>(
    `${BASE_URL}/fixtures?league=1&season=${season}`,
    3_600_000
  );
  return data.response ?? [];
}

export async function getFixtureById(
  fixtureId: number
): Promise<ApiFixture | null> {
  const data = await cachedFetch<{ response: ApiFixture[] }>(
    `${BASE_URL}/fixtures?id=${fixtureId}`,
    30_000
  );
  return data.response?.[0] ?? null;
}

// ---- Events (goals, cards) ----

export interface ApiEvent {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string };
  player: { id: number; name: string };
  assist: { id: number | null; name: string | null };
  type: string;
  detail: string;
}

export async function getFixtureEvents(
  fixtureId: number
): Promise<ApiEvent[]> {
  const data = await cachedFetch<{ response: ApiEvent[] }>(
    `${BASE_URL}/fixtures/events?fixture=${fixtureId}`,
    30_000
  );
  return data.response ?? [];
}

// ---- Standings ----

export interface ApiStandingRow {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  group: string;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
}

export async function getStandings(
  season: number
): Promise<ApiStandingRow[][]> {
  const data = await cachedFetch<{
    response: Array<{
      league: { standings: ApiStandingRow[][] };
    }>;
  }>(`${BASE_URL}/standings?league=1&season=${season}`, 300_000);
  return data.response?.[0]?.league?.standings ?? [];
}

// ---- Teams ----

export interface ApiTeam {
  team: { id: number; name: string; code: string; logo: string; country: string };
}

export async function getTeams(season: number): Promise<ApiTeam[]> {
  const data = await cachedFetch<{ response: ApiTeam[] }>(
    `${BASE_URL}/teams?league=1&season=${season}`,
    86_400_000
  );
  return data.response ?? [];
}

// ---- Status mapping ----

const LIVE_STATUSES = new Set(["1H", "2H", "HT", "ET", "BT", "P", "SUSP", "INT"]);
const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

export function mapStatus(
  short: string
): "scheduled" | "live" | "finished" | "postponed" {
  if (LIVE_STATUSES.has(short)) return "live";
  if (FINISHED_STATUSES.has(short)) return "finished";
  if (short === "PST" || short === "CANC" || short === "ABD") return "postponed";
  return "scheduled";
}

// ---- Multiplier by tier ----

export function getTierMultiplier(tier: number): number {
  switch (tier) {
    case 1: return 1.0;
    case 2: return 1.25;
    case 3: return 1.5;
    case 4: return 2.0;
    default: return 1.0;
  }
}
