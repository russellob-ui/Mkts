import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    await ensureTables();
    const { matchId, eventType, minute, detail, team } = await request.json();

    if (!matchId || !eventType) {
      return NextResponse.json(
        { error: "matchId and eventType required" },
        { status: 400 }
      );
    }

    await db.execute(
      sql`INSERT INTO football_events (match_id, event_type, minute, detail, team)
          VALUES (${matchId}, ${eventType}, ${minute ?? null}, ${detail ?? null}, ${team ?? null})`
    );

    // If it's a goal event, auto-update match state
    if (eventType === "goal") {
      // Update first scorer if this is the first goal
      const goals = await db.execute(
        sql`SELECT * FROM football_events WHERE match_id = ${matchId} AND event_type = 'goal' ORDER BY minute ASC, id ASC`
      );
      const goalRows = Array.from(goals as Iterable<Record<string, unknown>>) as Array<Record<string, unknown>>;
      if (goalRows.length === 1) {
        await db.execute(
          sql`UPDATE football_matches SET first_scorer = ${detail ?? null}, first_goal_minute = ${minute ?? null} WHERE id = ${matchId}`
        );
      }

      // Update score count
      const homeGoals = goalRows.filter((g) => String(g.team) === "home").length;
      const awayGoals = goalRows.filter((g) => String(g.team) === "away").length;
      await db.execute(
        sql`UPDATE football_matches SET final_home_score = ${homeGoals}, final_away_score = ${awayGoals} WHERE id = ${matchId}`
      );
    }

    // Count corners and cards for live totals
    if (eventType === "corner") {
      const corners = await db.execute(
        sql`SELECT COUNT(*) as cnt FROM football_events WHERE match_id = ${matchId} AND event_type = 'corner'`
      );
      const cnt = Number(Array.from(corners as Iterable<Record<string, unknown>>)[0].cnt);
      await db.execute(
        sql`UPDATE football_matches SET total_corners = ${cnt} WHERE id = ${matchId}`
      );
    }

    if (eventType === "yellow_card" || eventType === "red_card") {
      const cards = await db.execute(
        sql`SELECT COUNT(*) as cnt FROM football_events WHERE match_id = ${matchId} AND (event_type = 'yellow_card' OR event_type = 'red_card')`
      );
      const cnt = Number(Array.from(cards as Iterable<Record<string, unknown>>)[0].cnt);
      await db.execute(
        sql`UPDATE football_matches SET total_cards = ${cnt} WHERE id = ${matchId}`
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
