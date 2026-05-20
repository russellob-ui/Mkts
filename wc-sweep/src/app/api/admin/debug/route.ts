import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { players } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

let tablesEnsured = false;

export async function GET() {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const allPlayers = await db.select().from(players);

    // Ensure first player is commissioner
    if (allPlayers.length > 0 && !allPlayers.some((p) => p.isCommissioner)) {
      await db.execute(
        sql`UPDATE players SET is_commissioner = true WHERE id = ${allPlayers[0].id}`
      );
    }

    return NextResponse.json({
      players: allPlayers.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        passcode: p.passcode,
        isCommissioner: p.isCommissioner,
      })),
    });
  } catch (err) {
    console.error("[Admin Debug]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const { playerId, newPasscode } = await request.json();
    if (!playerId || !newPasscode) {
      return NextResponse.json({ error: "playerId and newPasscode required" }, { status: 400 });
    }

    await db.execute(
      sql`UPDATE players SET passcode = ${newPasscode}, is_commissioner = true WHERE id = ${playerId}`
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Admin Debug]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
