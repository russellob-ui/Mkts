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
  const key = process.env.API_FOOTBALL_KEY;
  const keyInfo = {
    set: Boolean(key),
    length: key?.length ?? 0,
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

  // Plus a few likely alternatives
  results.fixtures_l1_s2025 = await rawFetch(
    "/fixtures?league=1&season=2025",
    key
  );
  results.fixtures_l1_s2022 = await rawFetch(
    "/fixtures?league=1&season=2022",
    key
  );

  return NextResponse.json(results);
}
