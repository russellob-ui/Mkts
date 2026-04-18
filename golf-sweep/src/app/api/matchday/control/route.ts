import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    await ensureTables();
    const { matchId, action, minute, homeScore, awayScore, totalCorners, totalCards } =
      await request.json();

    if (!matchId || !action) {
      return NextResponse.json(
        { error: "matchId and action required" },
        { status: 400 }
      );
    }

    if (action === "kickoff") {
      await db.execute(
        sql`UPDATE football_matches SET status = 'live', current_minute = 0 WHERE id = ${matchId}`
      );
    } else if (action === "half_time") {
      await db.execute(
        sql`UPDATE football_matches SET current_minute = 45 WHERE id = ${matchId}`
      );
    } else if (action === "second_half") {
      await db.execute(
        sql`UPDATE football_matches SET current_minute = 46 WHERE id = ${matchId}`
      );
    } else if (action === "update_minute") {
      await db.execute(
        sql`UPDATE football_matches SET current_minute = ${minute ?? 0} WHERE id = ${matchId}`
      );
    } else if (action === "full_time") {
      await db.execute(
        sql`UPDATE football_matches SET status = 'finished',
            current_minute = 90,
            final_home_score = COALESCE(${homeScore ?? null}::int, final_home_score),
            final_away_score = COALESCE(${awayScore ?? null}::int, final_away_score),
            total_corners = COALESCE(${totalCorners ?? null}::int, total_corners),
            total_cards = COALESCE(${totalCards ?? null}::int, total_cards)
          WHERE id = ${matchId}`
      );
    }

    return NextResponse.json({ success: true, action });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
