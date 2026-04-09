const BASE_URL = "https://live-golf-data.p.rapidapi.com";

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
  console.log(
    "[SlashGolf] Leaderboard response shape (first 2000 chars):",
    JSON.stringify(data, null, 2).slice(0, 2000)
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

    return items.map((item) => {
      const obj = item as Record<string, unknown>;
      const firstName = String(obj.firstName ?? obj.first_name ?? obj.fname ?? "");
      const lastName = String(obj.lastName ?? obj.last_name ?? obj.lname ?? "");
      const fullName = String(
        obj.name ?? obj.playerName ?? obj.player_name ?? `${firstName} ${lastName}`
      ).trim();

      // Parse round scores — handle array of round objects
      const roundScores: Record<number, number | null> = {};
      const roundsArr = obj.rounds;
      if (Array.isArray(roundsArr)) {
        for (const rd of roundsArr) {
          const rdObj = rd as Record<string, unknown>;
          const rNum = Number(rdObj.roundNumber ?? rdObj.round_number ?? rdObj.round ?? 0);
          const scoreToPar = rdObj.scoreToPar ?? rdObj.score_to_par ?? rdObj.strokes ?? null;
          if (rNum >= 1 && rNum <= 4 && scoreToPar != null && scoreToPar !== "" && scoreToPar !== "-") {
            roundScores[rNum] = Number(scoreToPar);
          }
        }
      } else {
        for (let r = 1; r <= 4; r++) {
          const val = obj[`round${r}`] ?? obj[`r${r}`];
          roundScores[r] = val != null && val !== "" && val !== "-" ? Number(val) : null;
        }
      }

      // Parse score to par
      let scoreToPar = 0;
      const rawScore = obj.total ?? obj.scoreToPar ?? obj.score_to_par ?? obj.totalToPar ?? obj.toPar;
      if (rawScore === "E" || rawScore === "even" || rawScore === "0") {
        scoreToPar = 0;
      } else if (rawScore != null && rawScore !== "" && rawScore !== "-") {
        scoreToPar = Number(rawScore);
      }

      // Parse thru
      const thruVal = obj.thru ?? obj.hole ?? obj.holes;
      let thru = "";
      if (thruVal != null && thruVal !== "") {
        thru = String(thruVal);
      }
      // Check if round is complete
      if (obj.roundComplete === true || thru === "18" || thru === "F") {
        thru = "F";
      }

      return {
        playerId: String(obj.playerId ?? obj.player_id ?? obj.id ?? ""),
        name: fullName,
        firstName,
        lastName,
        position: String(obj.position ?? obj.pos ?? obj.rank ?? ""),
        scoreToPar,
        thru,
        currentRound: Number(obj.currentRound ?? obj.current_round ?? obj.round ?? 1),
        roundScores,
        madeCut: obj.madeCut !== false && obj.made_cut !== false && obj.status !== "CUT" && obj.status !== "MC",
      };
    });
  } catch (err) {
    console.error("[SlashGolf] Error parsing leaderboard:", err);
    return [];
  }
}
