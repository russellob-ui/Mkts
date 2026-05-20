import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { inviteCodes, players } from "@/db/schema";
import { eq, isNull, isNotNull } from "drizzle-orm";
import { verifyAdminRequest } from "@/lib/admin-auth";

let tablesEnsured = false;

export async function GET() {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const codes = await db
      .select({
        id: inviteCodes.id,
        code: inviteCodes.code,
        usedByPlayerId: inviteCodes.usedByPlayerId,
        createdAt: inviteCodes.createdAt,
        usedAt: inviteCodes.usedAt,
      })
      .from(inviteCodes);

    // Enrich with player name for used codes
    const allPlayers = await db.select().from(players);
    const playerMap = new Map(allPlayers.map((p) => [p.id, p.name]));

    const result = codes.map((c) => ({
      id: c.id,
      code: c.code,
      used: c.usedByPlayerId !== null,
      usedBy: c.usedByPlayerId ? playerMap.get(c.usedByPlayerId) ?? null : null,
      createdAt: c.createdAt,
      usedAt: c.usedAt,
    }));

    return NextResponse.json({ codes: result });
  } catch (err) {
    console.error("[Invite GET]", err);
    return NextResponse.json(
      { error: "Failed to load invite codes" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const authError = await verifyAdminRequest(request);
    if (authError) return authError;

    // Generate a random 6-char uppercase code
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1 to avoid confusion
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    const result = await db
      .insert(inviteCodes)
      .values({ code })
      .returning();

    return NextResponse.json({ code: result[0].code }, { status: 201 });
  } catch (err) {
    console.error("[Invite POST]", err);
    return NextResponse.json(
      { error: "Failed to generate invite code" },
      { status: 500 }
    );
  }
}
