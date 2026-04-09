const BASE_URL = "https://api.the-odds-api.com/v4";

export interface OddsOutcome {
  name: string; // golfer name
  price: number; // decimal odds
  fractional?: string;
}

export interface OddsBookmaker {
  key: string;
  title: string;
  outcomes: OddsOutcome[];
}

/**
 * Fetch outright winner odds for a golf tournament.
 * Returns averaged odds across all bookmakers for each golfer.
 */
export async function getOutrightOdds(
  sportKey: string
): Promise<{
  golferOdds: Map<string, { fractional: string; decimal: number; bookmaker: string }>;
  raw: unknown;
}> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    console.warn("[OddsAPI] ODDS_API_KEY not set");
    return { golferOdds: new Map(), raw: null };
  }

  const url = `${BASE_URL}/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=uk&oddsFormat=decimal&markets=outrights`;
  console.log(`[OddsAPI] Fetching: ${sportKey}`);

  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) {
      console.error(`[OddsAPI] Error: ${res.status} ${res.statusText}`);
      return { golferOdds: new Map(), raw: null };
    }

    const data = await res.json();
    const golferOdds = new Map<string, { fractional: string; decimal: number; bookmaker: string }>();

    // data is an array of events, each with bookmakers
    const events = Array.isArray(data) ? data : [];
    if (events.length === 0) {
      console.warn("[OddsAPI] No events returned");
      return { golferOdds, raw: data };
    }

    // Aggregate odds across bookmakers
    const oddsAccum = new Map<string, { total: number; count: number }>();

    for (const event of events) {
      const bookmakers = event.bookmakers ?? [];
      for (const bm of bookmakers) {
        const markets = bm.markets ?? [];
        for (const market of markets) {
          if (market.key !== "outrights") continue;
          const outcomes = market.outcomes ?? [];
          for (const outcome of outcomes) {
            const name = outcome.name as string;
            const price = Number(outcome.price);
            if (!name || isNaN(price)) continue;
            const existing = oddsAccum.get(name) ?? { total: 0, count: 0 };
            existing.total += price;
            existing.count += 1;
            oddsAccum.set(name, existing);
          }
        }
      }
    }

    // Calculate averages and convert to fractional
    for (const [name, { total, count }] of oddsAccum) {
      const avgDecimal = Math.round((total / count) * 10) / 10;
      const fractional = decimalToFractional(avgDecimal);
      golferOdds.set(name, { fractional, decimal: avgDecimal, bookmaker: "average" });
    }

    console.log(`[OddsAPI] Got odds for ${golferOdds.size} golfers`);
    return { golferOdds, raw: data };
  } catch (err) {
    console.error("[OddsAPI] Fetch error:", err);
    return { golferOdds: new Map(), raw: null };
  }
}

/** Convert decimal odds to UK fractional format */
function decimalToFractional(decimal: number): string {
  if (decimal <= 1) return "1/1";
  const profit = decimal - 1;

  // Common fractional odds lookup
  const common: [number, string][] = [
    [1.5, "1/2"], [1.67, "2/3"], [1.8, "4/5"], [1.91, "10/11"],
    [2.0, "1/1"], [2.1, "11/10"], [2.25, "5/4"], [2.5, "6/4"],
    [2.75, "7/4"], [3.0, "2/1"], [3.5, "5/2"], [4.0, "3/1"],
    [4.5, "7/2"], [5.0, "4/1"], [5.5, "9/2"], [6.0, "5/1"],
    [6.5, "11/2"], [7.0, "6/1"], [8.0, "7/1"], [9.0, "8/1"],
    [10.0, "9/1"], [11.0, "10/1"], [12.0, "11/1"], [13.0, "12/1"],
    [15.0, "14/1"], [17.0, "16/1"], [21.0, "20/1"], [23.0, "22/1"],
    [26.0, "25/1"], [29.0, "28/1"], [31.0, "30/1"], [34.0, "33/1"],
    [41.0, "40/1"], [51.0, "50/1"], [67.0, "66/1"], [81.0, "80/1"],
    [101.0, "100/1"], [151.0, "150/1"], [201.0, "200/1"],
  ];

  // Find closest match
  let best = common[0];
  let bestDiff = Math.abs(decimal - common[0][0]);
  for (const entry of common) {
    const diff = Math.abs(decimal - entry[0]);
    if (diff < bestDiff) {
      best = entry;
      bestDiff = diff;
    }
  }
  if (bestDiff < 1) return best[1];

  // Fallback: approximate
  const num = Math.round(profit);
  return `${num}/1`;
}

/** Normalize golfer name for matching (same as slashgolf.ts) */
export function normalizeOddsName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .trim();
}
