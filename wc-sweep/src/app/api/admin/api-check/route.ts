import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE_URL = "https://v3.football.api-sports.io";

// Raw fetch so we can see status + error body — bypasses the cached wrapper.
async function rawFetch(path: string, key: string) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      headers: { "x-apisports-key": key },
      cache: "no-store",
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      // not JSON
    }
    const j = json as
      | { results?: number; response?: unknown[]; errors?: unknown }
      | null;
    return {
      url,
      httpStatus: res.status,
      results: j?.results ?? null,
      errors: j?.errors ?? null,
      sample: Array.isArray(j?.response) ? j.response.slice(0, 2) : null,
      rawBodyPreview: text.slice(0, 400),
    };
  } catch (err) {
    return { url, error: String(err) };
  }
}

export async function GET() {
  const raw = process.env.API_FOOTBALL_KEY;
  const key = raw?.trim();
  const keyInfo = {
    set: Boolean(key),
    rawLength: raw?.length ?? 0,
    trimmedLength: key?.length ?? 0,
    hadWhitespace: raw != null && raw !== key,
    preview: key ? `${key.slice(0, 4)}...${key.slice(-4)}` : null,
  };

  if (!key) {
    return NextResponse.json({
      keyInfo,
      error: "API_FOOTBALL_KEY env var not set on this deployment",
    });
  }

  const results: Record<string, unknown> = { keyInfo };

  // /status returns plan + remaining requests — best signal for "is the key valid"
  results.status = await rawFetch("/status", key);

  // Find every league that mentions "world cup" so we know the right ID + seasons
  results.leagueSearch = await rawFetch(
    "/leagues?search=world%20cup",
    key
  );

  // Try the previously-assumed combo
  results.fixtures_l1_s2026 = await rawFetch(
    "/fixtures?league=1&season=2026",
    key
  );

  // Full team list for league=1 season=2026 — this is what sync-fixtures
  // uses to populate wc_teams.api_team_id. The "unmatched teams" list
  // returned by sync is meaningless without seeing the candidates.
  const teamsRaw = await rawFetch("/teams?league=1&season=2026", key);
  results.teams_l1_s2026 = teamsRaw;

  // Pull just the names out, sorted, so it's easy to scan in the JSON
  type RawTeam = { team?: { id?: number; name?: string } };
  const teamsArr = Array.isArray((teamsRaw as { sample?: unknown } | null)?.sample)
    ? null // sample is truncated to 2 — we want the real full list
    : null;
  void teamsArr;

  // Re-fetch (uncached, full body) so we have all names, not just the 2-row sample
  try {
    const res = await fetch(
      `${BASE_URL}/teams?league=1&season=2026`,
      { headers: { "x-apisports-key": key }, cache: "no-store" }
    );
    const json = (await res.json()) as { response?: RawTeam[] };
    const names = (json.response ?? [])
      .map((t) => t.team?.name)
      .filter((n): n is string => typeof n === "string")
      .sort((a, b) => a.localeCompare(b));
    results.teamNames_l1_s2026 = {
      count: names.length,
      names,
    };
  } catch (err) {
    results.teamNames_l1_s2026 = { error: String(err) };
  }

  return NextResponse.json(results);
}
