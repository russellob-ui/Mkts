const BASE_URL = "https://live-golf-data.p.rapidapi.com";

/**
 * Slash Golf returns MongoDB Extended JSON, which wraps numbers in objects:
 *   { "$numberInt": "1" }   { "$numberLong": "-7" }   { "$numberDouble": "3.5" }
 * This unwraps them to raw primitives so parseScoreStr etc. just work.
 */
export function unwrapBson(v: unknown): unknown {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    if ("$numberInt" in o) return Number(o.$numberInt);
    if ("$numberLong" in o) return Number(o.$numberLong);
    if ("$numberDouble" in o) return Number(o.$numberDouble);
    if ("$numberDecimal" in o) return Number(o.$numberDecimal);
  }
  return v;
}

/**
 * Parse a Slash Golf score field. Accepts:
 *   - raw strings: "E", "even", "-3", "+2", "0"
 *   - raw numbers: 0, -3, 2
 *   - BSON-wrapped numbers: { "$numberInt": "-3" }
 * Returns a number or null.
 */
export function parseScoreStr(raw: unknown): number | null {
  const v = unwrapBson(raw);
  if (v === "E" || v === "even" || v === 0 || v === "0") return 0;
  if (v == null || v === "" || v === "-") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function getHeaders(): Record<string, string> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error("RAPIDAPI_KEY environment variable is required");
  }
  return {
    "x-rapidapi-host": "live-golf-data.p.rapidapi.com",
    "x-rapidapi-key": apiKey,
  };
}

export interface ScheduleResponse {
  // Shape discovered at runtime — we parse defensively
  [key: string]: unknown;
}

export interface LeaderboardResponse {
  [key: string]: unknown;
}

export async function getSchedule(year: number): Promise<ScheduleResponse> {
  const url = `${BASE_URL}/schedule?orgId=1&year=${year}`;
  console.log(`[SlashGolf] Fetching schedule: ${url}`);

  const res = await fetch(url, {
    headers: getHeaders(),
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`SlashGolf schedule error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  console.log(
    "[SlashGolf] Schedule response shape:",
    JSON.stringify(data, null, 2).slice(0, 3000)
  );
  return data;
}

export async function getLeaderboard(
  tournId: string,
  year: number
): Promise<LeaderboardResponse> {
  const url = `${BASE_URL}/leaderboard?orgId=1&tournId=${tournId}&year=${year}`;
  console.log(`[SlashGolf] Fetching leaderboard: ${url}`);

  const res = await fetch(url, {
    headers: getHeaders(),
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(
      `SlashGolf leaderboard error: ${res.status} ${res.statusText}`
    );
  }

  const data = await res.json();
  // Log the first player's full structure so we can diagnose field names
  // from Railway logs without needing a debug endpoint hit.
  const root = data as Record<string, unknown>;
  const firstArrayKey = Object.keys(root).find((k) => Array.isArray(root[k]));
  const firstPlayer = firstArrayKey
    ? ((root[firstArrayKey] as unknown[])[0] ?? null)
    : null;
  console.log("[SlashGolf] Leaderboard top-level keys:", Object.keys(root));
  console.log("[SlashGolf] Leaderboard top-level roundId:", root.roundId);
  console.log(
    "[SlashGolf] First player (full):",
    JSON.stringify(firstPlayer, null, 2).slice(0, 3000)
  );
  return data;
}

/**
 * Find the Masters tournament from the schedule response.
 * Parses defensively — inspects the actual response structure.
 */
export function findMastersTournament(
  schedule: ScheduleResponse
): { tournId: string; name: string; startDate?: string; endDate?: string } | null {
  try {
    // Try common response shapes
    const scheduleData =
      (schedule as Record<string, unknown>).schedule ??
      (schedule as Record<string, unknown>).results ??
      (schedule as Record<string, unknown>).tournaments ??
      (schedule as Record<string, unknown>).events ??
      schedule;

    // If it's an array at top level or nested
    const items: unknown[] = Array.isArray(scheduleData)
      ? scheduleData
      : Array.isArray((scheduleData as Record<string, unknown>)?.events)
        ? ((scheduleData as Record<string, unknown>).events as unknown[])
        : Array.isArray((scheduleData as Record<string, unknown>)?.tournaments)
          ? ((scheduleData as Record<string, unknown>).tournaments as unknown[])
          : [];

    for (const item of items) {
      const obj = item as Record<string, unknown>;
      const name = String(
        obj.name ?? obj.tournName ?? obj.tournament_name ?? obj.title ?? ""
      ).toLowerCase();
      if (name.includes("masters") && !name.includes("par 3")) {
        return {
          tournId: String(
            obj.tournId ?? obj.tourn_id ?? obj.id ?? obj.tournamentId ?? ""
          ),
          name: String(obj.name ?? obj.tournName ?? obj.tournament_name ?? obj.title ?? "Masters Tournament"),
          startDate: obj.startDate
            ? String(obj.startDate)
            : obj.start_date
              ? String(obj.start_date)
              : undefined,
          endDate: obj.endDate
            ? String(obj.endDate)
            : obj.end_date
              ? String(obj.end_date)
              : undefined,
        };
      }
    }

    console.warn("[SlashGolf] Could not find Masters in schedule response");
    return null;
  } catch (err) {
    console.error("[SlashGolf] Error parsing schedule:", err);
    return null;
  }
}

/**
 * Normalize a golfer name for fuzzy matching.
 * Handles Åberg/Aberg, MacIntyre/Macintyre, etc.
 */
export function normalizeGolferName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z\s]/g, "")
    .trim();
}

/**
 * Extract leaderboard players from the API response.
 * Parses defensively.
 */
export function parseLeaderboardPlayers(
  leaderboard: LeaderboardResponse
): Array<{
  playerId: string;
  name: string;
  firstName: string;
  lastName: string;
  position: string;
  scoreToPar: number;
  thru: string;
  currentRound: number;
  roundScores: Record<number, number | null>;
  madeCut: boolean;
}> {
  try {
    const data = leaderboard as Record<string, unknown>;

    // Find the player array — try known keys
    let items: unknown[] = [];
    for (const key of ["leaderboardRows", "leaderboard", "results", "players", "rows"]) {
      if (Array.isArray(data[key])) {
        items = data[key] as unknown[];
        break;
      }
    }
    // Fallback: search all keys for the first array
    if (items.length === 0) {
      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key]) && (data[key] as unknown[]).length > 0) {
          items = data[key] as unknown[];
          break;
        }
      }
    }

    // Top-level roundId = the tournament's current round (1-4).
    // Slash Golf may wrap this in MongoDB Extended JSON.
    const currentTournamentRound = Number(unwrapBson(data.roundId) ?? 0) || 1;

    return items.map((item) => {
      const obj = item as Record<string, unknown>;
      const firstName = String(obj.firstName ?? "");
      const lastName = String(obj.lastName ?? "");
      const fullName = `${firstName} ${lastName}`.trim();

      // Parse per-round scores from the rounds array.
      // Slash Golf schema: rounds[].roundId (int), rounds[].scoreToPar (string)
      // Defensive: if roundId missing/invalid, fall back to array index.
      const roundScores: Record<number, number | null> = {};
      const roundsArr = obj.rounds;
      if (Array.isArray(roundsArr)) {
        roundsArr.forEach((rd, i) => {
          const rdObj = rd as Record<string, unknown>;
          let rNum = Number(
            unwrapBson(rdObj.roundId ?? rdObj.roundNumber ?? rdObj.round) ?? 0
          );
          if (rNum < 1 || rNum > 4) rNum = i + 1; // fallback: position
          if (rNum >= 1 && rNum <= 4) {
            roundScores[rNum] = parseScoreStr(
              rdObj.scoreToPar ?? rdObj.score ?? rdObj.toPar
            );
          }
        });
      }
      // For an in-progress round, currentRoundScore is authoritative
      const roundComplete = obj.roundComplete === true;
      if (
        currentTournamentRound >= 1 &&
        currentTournamentRound <= 4 &&
        !roundComplete
      ) {
        const liveRoundScore = parseScoreStr(
          obj.currentRoundScore ?? obj.currentRoundScoreToPar ?? obj.todayScore
        );
        if (liveRoundScore !== null) {
          roundScores[currentTournamentRound] = liveRoundScore;
        }
      }

      // Overall tournament total
      const scoreToPar =
        parseScoreStr(obj.total ?? obj.totalToPar ?? obj.scoreToPar) ?? 0;

      // Calculate thru from currentHole / startingHole
      const status = String(obj.status ?? "").toLowerCase();
      const currentHole = Number(unwrapBson(obj.currentHole) ?? 0);
      const startingHole = Number(unwrapBson(obj.startingHole) ?? 0);
      let thru = "";
      if (status === "cut") thru = "CUT";
      else if (status === "wd") thru = "WD";
      else if (status === "dq") thru = "DQ";
      else if (roundComplete || status === "complete") thru = "F";
      else if (currentHole > 0 && startingHole > 0) {
        const holesPlayed = ((currentHole - startingHole + 18) % 18);
        thru = holesPlayed === 0 ? "" : String(holesPlayed);
      }

      return {
        playerId: String(obj.playerId ?? ""),
        name: fullName,
        firstName,
        lastName,
        position: String(obj.position ?? ""),
        scoreToPar,
        thru,
        currentRound: currentTournamentRound,
        roundScores,
        madeCut: status !== "cut" && status !== "wd" && status !== "dq",
      };
    });
  } catch (err) {
    console.error("[SlashGolf] Error parsing leaderboard:", err);
    return [];
  }
}
