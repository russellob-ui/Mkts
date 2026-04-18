/**
 * Sofascore API wrapper (via RapidAPI, by Api Dojo).
 *
 * Endpoint naming convention discovered from the API docs:
 *   teams/get-last-matches, teams/get-next-matches, teams/search
 *   matches/detail, matches/get-lineups, matches/get-incidents,
 *   matches/get-statistics
 *   tournaments/get-scheduled-events, tournaments/get-featured-events
 *
 * Host: sofascore.p.rapidapi.com
 * Auth: x-rapidapi-key (same key as golf)
 *
 * RATE LIMIT: Free tier is strict. We cache for 60s and make requests
 * sequentially (never parallel) to avoid 429s.
 */

const HOST = "sofascore.p.rapidapi.com";
const BASE = `https://${HOST}`;

function getHeaders(): Record<string, string> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY env var is required");
  return {
    "x-rapidapi-host": HOST,
    "x-rapidapi-key": key,
    "Content-Type": "application/json",
  };
}

async function apiFetch(path: string): Promise<unknown> {
  const url = `${BASE}/${path}`;
  console.log(`[Sofascore] ${url}`);
  const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sofascore ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// --- Types ------------------------------------------------------------------

export interface SofaEvent {
  id: number;
  tournament?: { uniqueTournament?: { id: number; name: string }; name?: string };
  season?: { id: number; name: string };
  homeTeam: { id: number; name: string; nameCode?: string };
  awayTeam: { id: number; name: string; nameCode?: string };
  homeScore?: { current?: number; period1?: number; period2?: number };
  awayScore?: { current?: number; period1?: number; period2?: number };
  status: { code: number; description: string; type: string };
  startTimestamp: number;
  venue?: { stadium?: { name: string }; city?: { name: string } };
  time?: { currentPeriodStartTimestamp?: number };
  roundInfo?: { round: number };
}

export interface SofaIncident {
  incidentType: string;
  time: number;
  addedTime?: number;
  player?: { id: number; name: string; shortName?: string };
  playerIn?: { name: string; shortName?: string };
  playerOut?: { name: string; shortName?: string };
  assist1?: { name: string; shortName?: string };
  incidentClass?: string;
  isHome?: boolean;
  homeScore?: number;
  awayScore?: number;
  rescinded?: boolean;
  description?: string;
  text?: string;
}

export interface SofaLineupPlayer {
  player: { id: number; name: string; shortName?: string; position?: string; jerseyNumber?: string };
  shirtNumber: number;
  position?: string;
  substitute?: boolean;
}

export interface SofaLineup {
  players: SofaLineupPlayer[];
  formation?: string;
}

export interface SofaStatItem {
  name: string;
  home: string;
  away: string;
  homeValue?: number;
  awayValue?: number;
}

// --- Fetchers ---------------------------------------------------------------

/** Get a team's upcoming matches. Brentford = 38, Fulham = 43. */
export async function getTeamNextMatches(
  teamId: number,
  page = 0
): Promise<SofaEvent[]> {
  const data = (await apiFetch(
    `teams/get-next-matches?teamId=${teamId}&pageIndex=${page}`
  )) as { events?: SofaEvent[] };
  return data.events ?? [];
}

/** Get a team's recent matches. */
export async function getTeamLastMatches(
  teamId: number,
  page = 0
): Promise<SofaEvent[]> {
  const data = (await apiFetch(
    `teams/get-last-matches?teamId=${teamId}&pageIndex=${page}`
  )) as { events?: SofaEvent[] };
  return data.events ?? [];
}

/** Get match details (score, status, teams). Tries multiple paths. */
export async function getMatchDetail(
  matchId: number
): Promise<SofaEvent | null> {
  const paths = [
    `matches/detail?matchId=${matchId}`,
    `matches/detail?eventId=${matchId}`,
    `matches/detail?id=${matchId}`,
    `events/detail?eventId=${matchId}`,
  ];
  for (const path of paths) {
    try {
      const data = (await apiFetch(path)) as { event?: SofaEvent };
      if (data.event) {
        console.log(`[Sofascore] Detail found via: ${path}`);
        return data.event;
      }
    } catch (err) {
      console.log(`[Sofascore] Detail ${path} failed: ${err}`);
    }
  }
  return null;
}

/** Get match incidents (goals, cards, subs, VAR). Tries multiple paths. */
export async function getMatchIncidents(
  matchId: number
): Promise<SofaIncident[]> {
  const paths = [
    `matches/get-incidents?matchId=${matchId}`,
    `matches/get-incidents?eventId=${matchId}`,
    `events/get-incidents?eventId=${matchId}`,
  ];
  for (const path of paths) {
    try {
      const data = (await apiFetch(path)) as { incidents?: SofaIncident[] };
      if (data.incidents) {
        console.log(`[Sofascore] Incidents found via: ${path}`);
        return data.incidents;
      }
    } catch (err) {
      console.log(`[Sofascore] Incidents ${path} failed: ${err}`);
    }
  }
  return [];
}

/** Get team lineups (starting XI + subs). Tries multiple param names. */
export async function getMatchLineups(
  matchId: number
): Promise<{ home: SofaLineup | null; away: SofaLineup | null; error?: string }> {
  // Try different parameter names — RapidAPI wrappers aren't consistent
  const attempts = [
    `matches/get-lineups?matchId=${matchId}`,
    `matches/get-lineups?eventId=${matchId}`,
    `matches/get-lineups?id=${matchId}`,
    `events/get-lineups?eventId=${matchId}`,
  ];
  for (const path of attempts) {
    try {
      const data = (await apiFetch(path)) as {
        home?: SofaLineup;
        away?: SofaLineup;
        confirmed?: boolean;
      };
      if (data.home || data.away) {
        console.log(`[Sofascore] Lineups found via: ${path}`);
        return { home: data.home ?? null, away: data.away ?? null };
      }
    } catch (err) {
      console.log(`[Sofascore] Lineups ${path} failed: ${err}`);
    }
  }
  return { home: null, away: null, error: "All lineup endpoint attempts failed" };
}

/** Get match statistics (corners, shots, possession, etc.). */
export async function getMatchStatistics(
  matchId: number
): Promise<SofaStatItem[]> {
  try {
    const data = (await apiFetch(
      `matches/get-statistics?matchId=${matchId}`
    )) as {
      statistics?: Array<{
        period: string;
        groups: Array<{
          groupName: string;
          statisticsItems: SofaStatItem[];
        }>;
      }>;
    };
    const allPeriod = data.statistics?.find((s) => s.period === "ALL");
    const period = allPeriod ?? data.statistics?.[0];
    if (!period) return [];
    return period.groups.flatMap((g) => g.statisticsItems);
  } catch {
    return [];
  }
}

/** Search for scheduled events in a tournament. PL uniqueTournament = 17. */
export async function getTournamentScheduledEvents(
  tournamentId: number,
  seasonId?: number
): Promise<SofaEvent[]> {
  try {
    let path = `tournaments/get-scheduled-events?tournamentId=${tournamentId}`;
    if (seasonId) path += `&seasonId=${seasonId}`;
    const data = (await apiFetch(path)) as { events?: SofaEvent[] };
    return data.events ?? [];
  } catch {
    return [];
  }
}

// --- Helpers ----------------------------------------------------------------

export function sofaStatus(
  event: SofaEvent
): "upcoming" | "live" | "finished" | "other" {
  const t = event.status?.type?.toLowerCase();
  if (t === "notstarted") return "upcoming";
  if (t === "inprogress") return "live";
  if (t === "finished") return "finished";
  return "other";
}

export function computeMinute(event: SofaEvent): number | null {
  if (event.status?.type === "notstarted") return null;
  if (event.status?.type === "finished") return 90;
  if (!event.time?.currentPeriodStartTimestamp) return null;
  const now = Math.floor(Date.now() / 1000);
  const elapsed = Math.floor((now - event.time.currentPeriodStartTimestamp) / 60);
  const desc = (event.status?.description ?? "").toLowerCase();
  if (desc.includes("2nd") || desc.includes("second")) return 45 + elapsed;
  if (desc.includes("halftime")) return 45;
  return elapsed;
}

export function getStatNum(
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
