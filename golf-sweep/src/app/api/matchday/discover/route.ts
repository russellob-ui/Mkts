import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/matchday/discover
 *
 * Probes the Sofascore RapidAPI to discover which endpoint paths work.
 * Tries multiple naming patterns and reports results.
 */
export async function GET() {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "No RAPIDAPI_KEY" });
  }

  const host = "sofascore.p.rapidapi.com";
  const headers: Record<string, string> = {
    "x-rapidapi-host": host,
    "x-rapidapi-key": apiKey,
  };

  // Brentford team ID on Sofascore = 38
  // A known recent PL event ID (we'll discover one from teams endpoint)
  const brentfordId = 38;
  const today = new Date().toISOString().split("T")[0];

  const paths = [
    // Finding matches by date
    `/sport/football/scheduled-events/${today}`,
    `/api/v1/sport/football/scheduled-events/${today}`,
    `/sport/get-scheduled-events?date=${today}&sportId=1`,
    `/sports/get-scheduled-events?date=${today}`,

    // Team matches (we know this one works)
    `/teams/get-last-matches?teamId=${brentfordId}&pageIndex=0`,
    `/teams/get-next-matches?teamId=${brentfordId}&pageIndex=0`,

    // Event details (need an event ID — we'll get one from teams endpoint)
    // These will be tried once we have an eventId
  ];

  const results: Array<{
    path: string;
    status: number;
    ok: boolean;
    keys?: string[];
    sample?: unknown;
  }> = [];

  // First, get a real event ID from the working teams endpoint
  let sampleEventId: number | null = null;
  try {
    const teamsRes = await fetch(
      `https://${host}/teams/get-last-matches?teamId=${brentfordId}&pageIndex=0`,
      { headers }
    );
    if (teamsRes.ok) {
      const teamsData = (await teamsRes.json()) as Record<string, unknown>;
      results.push({
        path: `/teams/get-last-matches?teamId=${brentfordId}`,
        status: teamsRes.status,
        ok: true,
        keys: Object.keys(teamsData),
        sample: JSON.stringify(teamsData).slice(0, 500),
      });

      // Try to find an event ID
      const events = teamsData.events as Array<Record<string, unknown>> | undefined;
      if (events?.[0]?.id) {
        sampleEventId = Number(events[0].id);
      }
    }

    // Also try next matches
    const nextRes = await fetch(
      `https://${host}/teams/get-next-matches?teamId=${brentfordId}&pageIndex=0`,
      { headers }
    );
    if (nextRes.ok) {
      const nextData = (await nextRes.json()) as Record<string, unknown>;
      results.push({
        path: `/teams/get-next-matches?teamId=${brentfordId}`,
        status: nextRes.status,
        ok: true,
        keys: Object.keys(nextData),
        sample: JSON.stringify(nextData).slice(0, 500),
      });

      const nextEvents = nextData.events as Array<Record<string, unknown>> | undefined;
      if (nextEvents?.[0]?.id && !sampleEventId) {
        sampleEventId = Number(nextEvents[0].id);
      }
    }
  } catch (err) {
    results.push({
      path: `/teams/get-last-matches`,
      status: 0,
      ok: false,
      keys: [String(err)],
    });
  }

  // Try the scheduled events paths
  for (const path of paths.filter((p) => !p.includes("teams/"))) {
    try {
      const res = await fetch(`https://${host}${path}`, { headers });
      const body = res.ok
        ? ((await res.json()) as Record<string, unknown>)
        : null;
      results.push({
        path,
        status: res.status,
        ok: res.ok,
        keys: body ? Object.keys(body) : undefined,
        sample: body ? JSON.stringify(body).slice(0, 300) : undefined,
      });
    } catch (err) {
      results.push({ path, status: 0, ok: false, keys: [String(err)] });
    }
  }

  // If we found an event ID, try event-specific endpoints
  if (sampleEventId) {
    const eventPaths = [
      `/events/get-lineups?eventId=${sampleEventId}`,
      `/events/get-incidents?eventId=${sampleEventId}`,
      `/events/get-statistics?eventId=${sampleEventId}`,
      `/events/get-details?eventId=${sampleEventId}`,
      `/events/detail?eventId=${sampleEventId}`,
      `/matches/get-lineups?matchId=${sampleEventId}`,
      `/matches/get-incidents?matchId=${sampleEventId}`,
      `/matches/get-statistics?matchId=${sampleEventId}`,
      `/api/v1/event/${sampleEventId}`,
      `/api/v1/event/${sampleEventId}/lineups`,
      `/api/v1/event/${sampleEventId}/incidents`,
      `/api/v1/event/${sampleEventId}/statistics`,
    ];

    for (const path of eventPaths) {
      try {
        const res = await fetch(`https://${host}${path}`, { headers });
        const body = res.ok
          ? ((await res.json()) as Record<string, unknown>)
          : null;
        results.push({
          path,
          status: res.status,
          ok: res.ok,
          keys: body ? Object.keys(body) : undefined,
          sample: body ? JSON.stringify(body).slice(0, 300) : undefined,
        });
      } catch (err) {
        results.push({ path, status: 0, ok: false, keys: [String(err)] });
      }
    }
  }

  return NextResponse.json({
    sampleEventId,
    brentfordTeamId: brentfordId,
    discovered: results.filter((r) => r.ok),
    failed: results.filter((r) => !r.ok).map((r) => ({
      path: r.path,
      status: r.status,
    })),
    allResults: results,
  });
}
