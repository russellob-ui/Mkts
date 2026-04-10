import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { tournaments } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const passcode = request.nextUrl.searchParams.get("p");
  if (passcode !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureTables();

  const results: Record<string, unknown> = {};

  // Get live tournament
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.status, "live"));

  if (!tournament || !tournament.slashTournId) {
    return NextResponse.json({ error: "No live tournament with slashTournId" });
  }

  results.tournament = {
    id: tournament.id,
    name: tournament.name,
    slashTournId: tournament.slashTournId,
    lastPolledAt: tournament.lastPolledAt,
  };

  // Fetch raw leaderboard
  try {
    const apiKey = process.env.RAPIDAPI_KEY;
    const res = await fetch(
      `https://live-golf-data.p.rapidapi.com/leaderboard?orgId=1&tournId=${tournament.slashTournId}&year=2026`,
      {
        headers: {
          "x-rapidapi-host": "live-golf-data.p.rapidapi.com",
          "x-rapidapi-key": apiKey!,
        },
      }
    );
    const raw = await res.json();

    // Find the leaderboard rows array
    const rowsKey = Object.keys(raw).find(
      (k) => Array.isArray((raw as Record<string, unknown>)[k]) && ((raw as Record<string, unknown>)[k] as unknown[]).length > 0
    );
    results.topLevelKeys = Object.keys(raw);
    results.rowsKey = rowsKey;

    if (rowsKey) {
      const rows = (raw as Record<string, unknown[]>)[rowsKey];
      // Find Rose specifically
      const rose = (rows as Array<Record<string, unknown>>).find((r) => {
        const name = String(r.lastName ?? r.lname ?? "").toLowerCase();
        const first = String(r.firstName ?? r.fname ?? "").toLowerCase();
        return name.includes("rose") || first.includes("justin");
      });
      results.roseRaw = rose ?? "Rose not found";
      results.firstRowRaw = rows[0];
      results.rowCount = rows.length;

      // Show keys on first row
      if (rows[0]) {
        results.fieldsOnFirstRow = Object.keys(rows[0] as object);
      }
    }
  } catch (err) {
    results.error = String(err);
  }

  return NextResponse.json(results);
}
