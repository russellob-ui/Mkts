import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    await ensureTables();
    const { matchId, playerId, squareKey, marked } = await request.json();

    if (!matchId || !playerId || !squareKey) {
      return NextResponse.json(
        { error: "matchId, playerId, squareKey required" },
        { status: 400 }
      );
    }

    // Get current card
    const result = await db.execute(
      sql`SELECT * FROM football_bingo_cards WHERE match_id = ${matchId} AND player_id = ${playerId}`
    );
    const card = Array.from(result as Iterable<Record<string, unknown>>)[0] as Record<string, unknown> | undefined;
    if (!card) {
      return NextResponse.json({ error: "No bingo card found" }, { status: 404 });
    }

    const squares = (
      typeof card.squares === "string"
        ? JSON.parse(card.squares as string)
        : card.squares
    ) as Array<{ key: string; text: string; marked: boolean }>;

    // Toggle the square
    const updated = squares.map((s) =>
      s.key === squareKey ? { ...s, marked: marked ?? !s.marked } : s
    );

    await db.execute(
      sql`UPDATE football_bingo_cards SET squares = ${JSON.stringify(updated)}::jsonb
          WHERE match_id = ${matchId} AND player_id = ${playerId}`
    );

    return NextResponse.json({ success: true, squares: updated });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
