import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";

let tablesEnsured = false;

const DEFAULT_PREFS = {
  emailDigest: true,
  pushGoals: true,
  pushMatchStart: true,
  pushDailyReminder: true,
};

export async function GET(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const url = new URL(request.url);
    const playerIdStr = url.searchParams.get("playerId");

    if (!playerIdStr) {
      return NextResponse.json(
        { error: "playerId is required" },
        { status: 400 }
      );
    }

    const playerId = parseInt(playerIdStr, 10);
    const rows = await db
      .select({
        email: players.email,
        phone: players.phone,
        pushSubscription: players.pushSubscription,
        notificationPrefs: players.notificationPrefs,
      })
      .from(players)
      .where(eq(players.id, playerId));

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    const row = rows[0];
    let prefs = { ...DEFAULT_PREFS };
    try {
      if (row.notificationPrefs) {
        prefs = { ...prefs, ...JSON.parse(row.notificationPrefs) };
      }
    } catch {
      // use defaults
    }

    return NextResponse.json({
      email: row.email,
      phone: row.phone,
      hasPushSubscription: !!row.pushSubscription,
      preferences: prefs,
    });
  } catch (err) {
    console.error("[Notification Prefs GET]", err);
    return NextResponse.json(
      { error: "Failed to load preferences" },
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

    const body = await request.json();
    const { playerId, preferences, passcode } = body as {
      playerId?: number;
      preferences?: Record<string, boolean>;
      passcode?: string;
    };

    if (!playerId) {
      return NextResponse.json(
        { error: "playerId is required" },
        { status: 400 }
      );
    }

    if (!preferences || typeof preferences !== "object") {
      return NextResponse.json(
        { error: "preferences object is required" },
        { status: 400 }
      );
    }

    // Validate player exists and verify passcode
    const existing = await db
      .select({ id: players.id, passcode: players.passcode })
      .from(players)
      .where(eq(players.id, playerId));

    if (existing.length === 0) {
      return NextResponse.json(
        { error: "Player not found" },
        { status: 404 }
      );
    }

    if (existing[0].passcode && existing[0].passcode !== passcode) {
      return NextResponse.json(
        { error: "Invalid passcode" },
        { status: 403 }
      );
    }

    // Merge with existing prefs
    let currentPrefs = { ...DEFAULT_PREFS };
    const currentRows = await db
      .select({ notificationPrefs: players.notificationPrefs })
      .from(players)
      .where(eq(players.id, playerId));

    if (currentRows[0]?.notificationPrefs) {
      try {
        currentPrefs = { ...currentPrefs, ...JSON.parse(currentRows[0].notificationPrefs) };
      } catch {
        // use defaults
      }
    }

    const mergedPrefs = { ...currentPrefs, ...preferences };

    await db
      .update(players)
      .set({ notificationPrefs: JSON.stringify(mergedPrefs) })
      .where(eq(players.id, playerId));

    return NextResponse.json({ ok: true, preferences: mergedPrefs });
  } catch (err) {
    console.error("[Notification Prefs POST]", err);
    return NextResponse.json(
      { error: "Failed to save preferences" },
      { status: 500 }
    );
  }
}
