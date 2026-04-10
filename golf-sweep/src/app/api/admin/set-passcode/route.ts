import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const passcode = request.headers.get("x-admin-passcode");
  if (passcode !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { playerId, newPasscode } = await request.json();

    if (!playerId || !newPasscode) {
      return NextResponse.json({ error: "playerId and newPasscode required" }, { status: 400 });
    }

    if (!/^\d{4}$/.test(newPasscode)) {
      return NextResponse.json({ error: "Passcode must be 4 digits" }, { status: 400 });
    }

    await db
      .update(players)
      .set({ passcode: newPasscode })
      .where(eq(players.id, playerId));

    return NextResponse.json({ message: "Passcode updated" });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const passcode = request.headers.get("x-admin-passcode");
  if (passcode !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const allPlayers = await db.select().from(players);
    return NextResponse.json({
      players: allPlayers.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        hasPasscode: !!p.passcode,
        passcodePreview: p.passcode ? `${p.passcode.slice(0, 1)}***` : "none",
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
