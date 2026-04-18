/**
 * Sofascore API wrapper (via RapidAPI).
 *
 * Uses the same RAPIDAPI_KEY as the golf data. Subscribe to "Sofascore"
 * by Api Dojo on RapidAPI (it's right in the search results).
 *
 * RapidAPI host: sofascore.p.rapidapi.com
 * Base path:     /api/v1/...
 */

const BASE_URL = "https://sofascore.p.rapidapi.com";

function getHeaders(): Record<string, string> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) throw new Error("RAPIDAPI_KEY env var is required");
  return {
    "x-rapidapi-host": "sofascore.p.rapidapi.com",
    "x-rapidapi-key": apiKey,
  };
}

async function apiFetch(path: string): Promise<unknown> {
  const url = `${BASE_URL}${path}`;
  console.log(`[Sofascore] Fetching: ${url}`);
  const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sofascore API error: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
  }
  return res.json();
}

// --- Types ------------------------------------------------------------------

export interface SofaEvent {
  id: number;
  tournament: {
    uniqueTournament?: { id: number; name: string };
    name: string;
  };
  season?: { id: number; name: string; year: string };
  homeTeam: { id: number; name: string; nameCode?: string };
  awayTeam: { id: number; name: string; nameCode?: string };
  homeScore: { current?: number; period1?: number; period2?: number; normaltime?: number };
  awayScore: { current?: number; period1?: number; period2?: number; normaltime?: number };
  status: {
    code: number;
    description: string;
    type: string; // "notstarted", "inprogress", "finished"
  };
  startTimestamp: number;
  venue?: { stadium?: { name: string }; city?: { name: string } };
  time?: { currentPeriodStartTimestamp?: number };
}

export interface SofaIncident {
  incidentType: string; // "goal", "card", "substitution", "period", "varDecision", "injuryTime"
  time: number;
  addedTime?: number;
  player?: { id: number; name: string; shortName: string };
  playerIn?: { id: number; name: string; shortName: string };
  playerOut?: { id: number; name: string; shortName: string };
  assist1?: { id: number; name: string; shortName: string };
  incidentClass?: string; // "regular", "ownGoal", "penalty", "yellow", "yellowRed", "red"
  isHome?: boolean;
  homeScore?: number;
  awayScore?: number;
  rescinded?: boolean;
  description?: string;
  text?: string;
}

export interface SofaLineupPlayer {
  player: {
    id: number;
    name: string;
    shortName: string;
    position: string; // "G", "D", "M", "F"
    jerseyNumber?: string;
    shirtNumber?: number;
  };
  shirtNumber: number;
  position: string;
  substitute: boolean;
}

export interface SofaLineup {
  players: SofaLineupPlayer[];
  formation: string;
  playerColor?: { primary: string };
  goalkeeperColor?: { primary: string };
}

export interface SofaStatItem {
  name: string;
  home: string;
  away: string;
  compareCode?: number;
  statisticsType?: string;
  valueType?: string;
  homeValue?: number;
  awayValue?: number;
  homeTotal?: number;
  awayTotal?: number;
}

// --- Fetchers ---------------------------------------------------------------

/**
 * Get all football events for a given date.
 * Date format: YYYY-MM-DD
 */
export async function getScheduledEvents(
  date: string
): Promise<SofaEvent[]> {
  const data = (await apiFetch(
    `/api/v1/sport/football/scheduled-events/${date}`
  )) as { events?: SofaEvent[] };
  return data.events ?? [];
}

/**
 * Get Premier League events for a date.
 * PL uniqueTournament.id = 17 in Sofascore.
 */
export async function getPremierLeagueEvents(
  date: string
): Promise<SofaEvent[]> {
  const all = await getScheduledEvents(date);
  return all.filter(
    (e) =>
      e.tournament?.uniqueTournament?.id === 17 ||
      e.tournament?.name?.toLowerCase().includes("premier league")
  );
}

/**
 * Get single event details by ID.
 */
export async function getEventDetails(
  eventId: number
): Promise<SofaEvent | null> {
  const data = (await apiFetch(`/api/v1/event/${eventId}`)) as {
    event?: SofaEvent;
  };
  return data.event ?? null;
}

/**
 * Get match incidents (goals, cards, subs, VAR).
 */
export async function getEventIncidents(
  eventId: number
): Promise<SofaIncident[]> {
  const data = (await apiFetch(
    `/api/v1/event/${eventId}/incidents`
  )) as { incidents?: SofaIncident[] };
  return data.incidents ?? [];
}

/**
 * Get team lineups for a match.
 * Returns { home, away } each with formation + players.
 */
export async function getEventLineups(
  eventId: number
): Promise<{ home: SofaLineup | null; away: SofaLineup | null }> {
  try {
    const data = (await apiFetch(
      `/api/v1/event/${eventId}/lineups`
    )) as { home?: SofaLineup; away?: SofaLineup; confirmed?: boolean };
    return { home: data.home ?? null, away: data.away ?? null };
  } catch {
    return { home: null, away: null };
  }
}

/**
 * Get match statistics (corners, shots, possession, etc.).
 */
export async function getEventStatistics(
  eventId: number
): Promise<SofaStatItem[]> {
  try {
    const data = (await apiFetch(
      `/api/v1/event/${eventId}/statistics`
    )) as {
      statistics?: Array<{
        period: string;
        groups: Array<{
          groupName: string;
          statisticsItems: SofaStatItem[];
        }>;
      }>;
    };
    // Flatten ALL period stats into a single list (prefer "ALL" period)
    const allPeriod = data.statistics?.find((s) => s.period === "ALL");
    const period = allPeriod ?? data.statistics?.[0];
    if (!period) return [];
    return period.groups.flatMap((g) => g.statisticsItems);
  } catch {
    return [];
  }
}

// --- Helpers ----------------------------------------------------------------

export function sofaEventStatus(
  event: SofaEvent
): "upcoming" | "live" | "finished" | "other" {
  const type = event.status?.type?.toLowerCase();
  if (type === "notstarted") return "upcoming";
  if (type === "inprogress") return "live";
  if (type === "finished") return "finished";
  return "other";
}

export function computeElapsedMinute(event: SofaEvent): number | null {
  if (event.status?.type === "notstarted") return null;
  if (event.status?.type === "finished") return 90;
  if (!event.time?.currentPeriodStartTimestamp) return null;
  const now = Math.floor(Date.now() / 1000);
  const periodStart = event.time.currentPeriodStartTimestamp;
  const elapsed = Math.floor((now - periodStart) / 60);
  // Second half starts at 45'
  const desc = event.status?.description?.toLowerCase() ?? "";
  if (desc.includes("2nd half") || desc.includes("second half")) {
    return 45 + elapsed;
  }
  if (desc.includes("halftime")) return 45;
  return elapsed;
}

export function getStatByName(
  stats: SofaStatItem[],
  name: string
): { home: number; away: number } {
  const item = stats.find(
    (s) => s.name.toLowerCase() === name.toLowerCase()
  );
  if (!item) return { home: 0, away: 0 };
  return {
    home: parseInt(String(item.home ?? item.homeValue ?? 0)) || 0,
    away: parseInt(String(item.away ?? item.awayValue ?? 0)) || 0,
  };
}
