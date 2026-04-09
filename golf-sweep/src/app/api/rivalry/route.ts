import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { players, tournaments, pointsLog } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await ensureTables();

    const playerASlug = request.nextUrl.searchParams.get("playerA");
    const playerBSlug = request.nextUrl.searchParams.get("playerB");

    if (!playerASlug || !playerBSlug) {
      return NextResponse.json(
        { error: "playerA and playerB query params (slugs) are required" },
        { status: 400 }
      );
    }

    const allPlayers = await db.select().from(players);
    const playerA = allPlayers.find((p) => p.slug === playerASlug);
    const playerB = allPlayers.find((p) => p.slug === playerBSlug);

    if (!playerA || !playerB) {
      return NextResponse.json(
        { error: "One or both players not found" },
        { status: 404 }
      );
    }

    const allTournaments = await db.select().from(tournaments);
    const allPoints = await db.select().from(pointsLog);

    const pointsA = allPoints.filter((p) => p.playerId === playerA.id);
    const pointsB = allPoints.filter((p) => p.playerId === playerB.id);

    // Per-tournament comparison
    const tournamentComparisons = allTournaments.map((tournament) => {
      const aTotal = pointsA
        .filter((p) => p.tournamentId === tournament.id)
        .reduce((sum, p) => sum + p.points, 0);
      const bTotal = pointsB
        .filter((p) => p.tournamentId === tournament.id)
        .reduce((sum, p) => sum + p.points, 0);

      return {
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        playerAPoints: aTotal,
        playerBPoints: bTotal,
        winner:
          aTotal > bTotal
            ? playerA.slug
            : bTotal > aTotal
              ? playerB.slug
              : "tie",
      };
    });

    // Only include tournaments where at least one player scored
    const activeTournaments = tournamentComparisons.filter(
      (t) => t.playerAPoints > 0 || t.playerBPoints > 0
    );

    const totalA = pointsA.reduce((sum, p) => sum + p.points, 0);
    const totalB = pointsB.reduce((sum, p) => sum + p.points, 0);

    const winsA = activeTournaments.filter(
      (t) => t.winner === playerA.slug
    ).length;
    const winsB = activeTournaments.filter(
      (t) => t.winner === playerB.slug
    ).length;
    const ties = activeTournaments.filter((t) => t.winner === "tie").length;

    return NextResponse.json({
      playerA: {
        id: playerA.id,
        name: playerA.name,
        slug: playerA.slug,
        color: playerA.color,
        avatarEmoji: playerA.avatarEmoji,
        totalPoints: totalA,
        wins: winsA,
      },
      playerB: {
        id: playerB.id,
        name: playerB.name,
        slug: playerB.slug,
        color: playerB.color,
        avatarEmoji: playerB.avatarEmoji,
        totalPoints: totalB,
        wins: winsB,
      },
      ties,
      seasonGap: totalA - totalB,
      tournaments: activeTournaments,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
