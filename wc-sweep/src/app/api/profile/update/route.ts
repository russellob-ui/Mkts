import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { players } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

let tablesEnsured = false;

export async function POST(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const { playerId, passcode, email, phone } = await request.json();
    if (!playerId || !passcode) {
      return NextResponse.json({ error: "playerId and passcode required" }, { status: 400 });
    }

    const [player] = await db.select().from(players).where(eq(players.id, playerId));
    if (!player || player.passcode !== passcode) {
      return NextResponse.json({ error: "Invalid passcode" }, { status: 403 });
    }

    const updates: string[] = [];
    if (email) updates.push(`email = '${email.replace(/'/g, "''")}'`);
    if (phone) updates.push(`phone = '${phone.replace(/'/g, "''")}'`);

    if (updates.length > 0) {
      await db.execute(sql.raw(`UPDATE players SET ${updates.join(", ")} WHERE id = ${playerId}`));
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Profile Update]", err);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
