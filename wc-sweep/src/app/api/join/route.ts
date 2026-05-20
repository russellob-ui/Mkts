import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { players, inviteCodes } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";

let tablesEnsured = false;

export async function POST(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const body = await request.json();
    const { name, passcode, color, avatarEmoji, inviteCode } = body as {
      name?: string;
      passcode?: string;
      color?: string;
      avatarEmoji?: string;
      inviteCode?: string;
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

    if (!inviteCode || !inviteCode.trim()) {
      return NextResponse.json(
        { error: "Invite code is required" },
        { status: 400 }
      );
    }

    // Validate invite code exists and is unused
    const codeRows = await db
      .select()
      .from(inviteCodes)
      .where(
        and(
          eq(inviteCodes.code, inviteCode.trim().toUpperCase()),
          isNull(inviteCodes.usedByPlayerId)
        )
      );

    if (codeRows.length === 0) {
      return NextResponse.json(
        { error: "Invalid or already used invite code" },
        { status: 400 }
      );
    }

    const codeRow = codeRows[0];

    // Generate slug
    let slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");

    // Check if slug exists, if so append random chars
    const existingSlugs = await db
      .select({ slug: players.slug })
      .from(players)
      .where(eq(players.slug, slug));

    if (existingSlugs.length > 0) {
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      let suffix = "";
      for (let i = 0; i < 3; i++) {
        suffix += chars[Math.floor(Math.random() * chars.length)];
      }
      slug = `${slug}-${suffix}`;
    }

    // Create the player
    const newPlayer = await db
      .insert(players)
      .values({
        name: name.trim(),
        slug,
        passcode: passcode.trim(),
        color: color?.trim() || null,
        avatarEmoji: avatarEmoji?.trim() || null,
      })
      .returning();

    if (newPlayer.length === 0) {
      return NextResponse.json(
        { error: "Failed to create player" },
        { status: 500 }
      );
    }

    // Mark the invite code as used
    await db
      .update(inviteCodes)
      .set({
        usedByPlayerId: newPlayer[0].id,
        usedAt: new Date(),
      })
      .where(eq(inviteCodes.id, codeRow.id));

    return NextResponse.json({ player: newPlayer[0] }, { status: 201 });
  } catch (err) {
    console.error("[Join POST]", err);
    return NextResponse.json(
      { error: "Failed to join" },
      { status: 500 }
    );
  }
}
