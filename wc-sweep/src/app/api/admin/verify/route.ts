import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";

let tablesEnsured = false;

export async function POST(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const body = await request.json();
    const { passcode } = body as { passcode?: string };

    if (!passcode || !passcode.trim()) {
      return NextResponse.json(
        { verified: false, error: "Passcode required" },
        { status: 400 }
      );
    }

    const allPlayers = await db.select().from(players);
    const player = allPlayers.find((p) => p.passcode === passcode.trim());

    if (!player) {
      return NextResponse.json({ verified: false });
    }

    if (!player.isCommissioner) {
      return NextResponse.json({ verified: false });
    }

    return NextResponse.json({
      verified: true,
      playerName: player.name,
    });
  } catch (err) {
    console.error("[Admin Verify POST]", err);
    return NextResponse.json(
      { verified: false, error: "Verification failed" },
      { status: 500 }
    );
  }
}
