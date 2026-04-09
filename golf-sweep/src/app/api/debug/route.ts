import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tournaments, golfers } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const passcode = request.nextUrl.searchParams.get("p");
  if (passcode !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  // 1. Check tournament state
  const allTournaments = await db.select().from(tournaments);
  results.tournaments = allTournaments;

  // 2. Check golfer state
  const allGolfers = await db.select().from(golfers);
  results.golfers = allGolfers;

  // 3. Try to call schedule API
  try {
    const apiKey = process.env.RAPIDAPI_KEY;
    results.hasApiKey = !!apiKey;
    results.apiKeyPreview = apiKey ? apiKey.slice(0, 10) + "..." : "NOT SET";

    const scheduleRes = await fetch(
      "https://live-golf-data.p.rapidapi.com/schedule?orgId=1&year=2026",
      {
        headers: {
          "x-rapidapi-host": "live-golf-data.p.rapidapi.com",
          "x-rapidapi-key": apiKey!,
        },
      }
    );
    results.scheduleStatus = scheduleRes.status;
    const scheduleBody = await scheduleRes.text();
    results.scheduleResponse = scheduleBody.slice(0, 3000);
  } catch (err) {
    results.scheduleError = String(err);
  }

  return NextResponse.json(results, { status: 200 });
}
