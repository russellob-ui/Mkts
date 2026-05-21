import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { players, teamAssignments } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { verifyAdminRequest } from "@/lib/admin-auth";

let tablesEnsured = false;

export async function GET(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const allPlayers = await db.select().from(players);

    const allAssignments = await db.select().from(teamAssignments);
    const assignmentCounts = new Map<number, number>();
    for (const a of allAssignments) {
      assignmentCounts.set(a.playerId, (assignmentCounts.get(a.playerId) ?? 0) + 1);
    }

    // Strip sensitive PII — only return safe fields
    const result = allPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      avatarEmoji: p.avatarEmoji,
      color: p.color,
      teamCount: assignmentCounts.get(p.id) ?? 0,
    }));

    return NextResponse.json({ players: result });
  } catch (err) {
    console.error("[Admin Players GET]", err);
    return NextResponse.json(
      { error: "Failed to load players" },
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

    const body = await request.json();
    const { name, passcode, color, avatarEmoji } = body as {
      name?: string;
      passcode?: string;
      color?: string;
      avatarEmoji?: string;
    };

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (!passcode || !passcode.trim()) {
      return NextResponse.json(
        { error: "Passcode is required" },
        { status: 400 }
      );
    }

    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");

    const result = await db
      .insert(players)
      .values({
        name: name.trim(),
        slug,
        passcode: passcode.trim(),
        color: color?.trim() || null,
        avatarEmoji: avatarEmoji?.trim() || null,
      })
      .onConflictDoNothing({ target: players.slug })
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { error: `Player with slug "${slug}" already exists` },
        { status: 409 }
      );
    }

    return NextResponse.json({ player: result[0] }, { status: 201 });
  } catch (err) {
    console.error("[Admin Players POST]", err);
    return NextResponse.json(
      { error: "Failed to create player" },
      { status: 500 }
    );
  }
}
