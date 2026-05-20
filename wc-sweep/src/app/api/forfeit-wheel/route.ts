import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { players, pointsLog, forfeitSpins } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

let tablesEnsured = false;

const FORFEITS = [
  "Buy everyone a drink",
  "Wear the winner's team shirt for a day",
  "Post an embarrassing photo on social media",
  "Do 20 press-ups at the pub",
  "Sing the winner's national anthem",
  "Change your WhatsApp photo to wooden spoon for a week",
  "Cook dinner for the winner",
  "Write a 200-word essay praising the winner",
  "Eat something spicy chosen by the group",
  "Do a lap of the pub in a silly hat",
  "Be the designated driver next night out",
  "Carry the winner's bags next trip",
  "Make everyone tea/coffee for a week",
  "Wear a rival team shirt to work",
  "Post a congratulations video to the group chat",
];

export async function GET() {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const allPlayers = await db.select().from(players);

    // Get total points per player from points_log
    const pointsTotals = await db
      .select({
        playerId: pointsLog.playerId,
        total: sql<number>`COALESCE(SUM(${pointsLog.points}), 0)`.as("total"),
      })
      .from(pointsLog)
      .groupBy(pointsLog.playerId);

    const pointsMap = new Map(pointsTotals.map((p) => [p.playerId, p.total]));

    // Sort players by points ascending — last place is the wooden spoon
    const ranked = allPlayers
      .map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        color: p.color,
        avatarEmoji: p.avatarEmoji,
        totalPoints: pointsMap.get(p.id) ?? 0,
      }))
      .sort((a, b) => a.totalPoints - b.totalPoints);

    const woodenSpoon = ranked.length > 0 ? ranked[0] : null;

    // Get past spins
    const pastSpins = await db
      .select()
      .from(forfeitSpins)
      .orderBy(desc(forfeitSpins.createdAt))
      .limit(10);

    return NextResponse.json({
      forfeits: FORFEITS,
      woodenSpoon,
      leaderboard: ranked,
      pastSpins,
    });
  } catch (error) {
    console.error("[Forfeit Wheel GET] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const body = await request.json();
    const { spinnerPasscode } = body;

    if (!spinnerPasscode) {
      return NextResponse.json(
        { error: "spinnerPasscode is required" },
        { status: 400 }
      );
    }

    // Verify commissioner passcode
    const allPlayers = await db.select().from(players);
    const commissioner = allPlayers.find(
      (p) => p.isCommissioner && p.passcode === spinnerPasscode
    );

    if (!commissioner) {
      return NextResponse.json(
        { error: "Only the commissioner can spin the wheel" },
        { status: 401 }
      );
    }

    // Random forfeit
    const randomIndex = Math.floor(Math.random() * FORFEITS.length);
    const forfeit = FORFEITS[randomIndex];

    // Get wooden spoon holder
    const pointsTotals = await db
      .select({
        playerId: pointsLog.playerId,
        total: sql<number>`COALESCE(SUM(${pointsLog.points}), 0)`.as("total"),
      })
      .from(pointsLog)
      .groupBy(pointsLog.playerId);

    const pointsMap = new Map(pointsTotals.map((p) => [p.playerId, p.total]));
    const ranked = allPlayers
      .map((p) => ({ ...p, total: pointsMap.get(p.id) ?? 0 }))
      .sort((a, b) => a.total - b.total);
    const woodenSpoon = ranked.length > 0 ? ranked[0] : null;

    // Store the spin
    const [spin] = await db
      .insert(forfeitSpins)
      .values({
        spinnerId: commissioner.id,
        forfeit,
        targetPlayerSlug: woodenSpoon?.slug ?? null,
      })
      .returning();

    return NextResponse.json({
      spin,
      forfeit,
      forfeitIndex: randomIndex,
      woodenSpoonName: woodenSpoon?.name ?? "Unknown",
    });
  } catch (error) {
    console.error("[Forfeit Wheel POST] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
