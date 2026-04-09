import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { records, players, golfers } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureTables();

    const allRecords = await db.select().from(records);
    const allPlayers = await db.select().from(players);
    const allGolfers = await db.select().from(golfers);

    const enrich = (record: (typeof allRecords)[0]) => ({
      id: record.id,
      recordType: record.recordType,
      playerId: record.playerId,
      playerName: record.playerId
        ? allPlayers.find((p) => p.id === record.playerId)?.name ?? null
        : null,
      golferId: record.golferId,
      golferName: record.golferId
        ? allGolfers.find((g) => g.id === record.golferId)?.name ?? null
        : null,
      tournamentId: record.tournamentId,
      seasonId: record.seasonId,
      scope: record.scope,
      numericValue: record.numericValue,
      displayValue: record.displayValue,
      description: record.description,
      setAt: record.setAt.toISOString(),
      supersededAt: record.supersededAt?.toISOString() ?? null,
    });

    const current = allRecords
      .filter((r) => r.supersededAt === null)
      .map(enrich);

    const history = allRecords
      .filter((r) => r.supersededAt !== null)
      .map(enrich);

    return NextResponse.json({ current, history });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
