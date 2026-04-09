import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { tournaments, golfers, roundScores, tournamentResults } from "@/db/schema";
import { eq } from "drizzle-orm";
import { normalizeGolferName } from "@/lib/slashgolf";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const passcode = request.nextUrl.searchParams.get("p");
  if (passcode !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = request.nextUrl.searchParams.get("action");
  const results: Record<string, unknown> = {};
  const apiKey = process.env.RAPIDAPI_KEY;
  const headers = {
    "x-rapidapi-host": "live-golf-data.p.rapidapi.com",
    "x-rapidapi-key": apiKey!,
  };

  // Show DB state
  const allTournaments = await db.select().from(tournaments);
  results.tournaments = allTournaments;
  const allGolfers = await db.select().from(golfers);
  results.golfers = allGolfers;

  if (action === "fix") {
    // AUTO-FIX: Find Masters in schedule, set tournId, fetch leaderboard, match golfers
    try {
      // 1. Fetch full schedule
      const schedRes = await fetch(
        "https://live-golf-data.p.rapidapi.com/schedule?orgId=1&year=2026",
        { headers }
      );
      const schedData = await schedRes.json();

      // Find all tournament names and IDs
      let tournList: Array<{ tournId: string; name: string }> = [];
      const items = schedData.schedule ?? schedData.tournaments ?? schedData.results ?? schedData;
      if (Array.isArray(items)) {
        tournList = items.map((t: Record<string, unknown>) => ({
          tournId: String(t.tournId ?? t.tourn_id ?? t.id ?? ""),
          name: String(t.name ?? t.tournName ?? ""),
        }));
      }

      results.allTournamentNames = tournList.map((t) => `${t.tournId}: ${t.name}`);

      // Find Masters
      const masters = tournList.find((t) =>
        t.name.toLowerCase().includes("masters") && !t.name.toLowerCase().includes("par 3")
      );
      results.mastersFound = masters ?? "NOT FOUND";

      if (masters && allTournaments[0]) {
        // Update tournament with tournId
        await db
          .update(tournaments)
          .set({ slashTournId: masters.tournId })
          .where(eq(tournaments.id, allTournaments[0].id));
        results.updatedTournId = masters.tournId;

        // 2. Fetch leaderboard
        const lbRes = await fetch(
          `https://live-golf-data.p.rapidapi.com/leaderboard?orgId=1&tournId=${masters.tournId}&year=2026`,
          { headers }
        );
        const lbData = await lbRes.json();

        // Parse leaderboard - try different structures
        const lbItems =
          lbData.leaderboard ?? lbData.results ?? lbData.players ?? lbData.rows ?? lbData;
        const playerList: unknown[] = Array.isArray(lbItems)
          ? lbItems
          : Array.isArray((lbItems as Record<string, unknown>)?.rows)
            ? ((lbItems as Record<string, unknown>).rows as unknown[])
            : [];

        results.leaderboardCount = playerList.length;
        results.leaderboardSample = playerList.slice(0, 3);

        // 3. Match our golfers
        const matched: string[] = [];
        for (const golfer of allGolfers) {
          const normalized = normalizeGolferName(golfer.name);

          for (const lbEntry of playerList) {
            const obj = lbEntry as Record<string, unknown>;
            const firstName = String(obj.firstName ?? obj.first_name ?? obj.fname ?? "");
            const lastName = String(obj.lastName ?? obj.last_name ?? obj.lname ?? "");
            const fullName = String(
              obj.name ?? obj.playerName ?? obj.player_name ?? `${firstName} ${lastName}`
            ).trim();
            const playerId = String(obj.playerId ?? obj.player_id ?? obj.id ?? "");
            const pNorm = normalizeGolferName(fullName);
            const pLastNorm = normalizeGolferName(lastName);

            const isMatch =
              pNorm === normalized ||
              pNorm.includes(normalized) ||
              normalized.includes(pNorm) ||
              normalized.includes(pLastNorm) ||
              (pLastNorm.length > 3 && pLastNorm.includes(normalized.split(" ").pop() ?? "____"));

            if (isMatch) {
              await db
                .update(golfers)
                .set({ slashPlayerId: playerId })
                .where(eq(golfers.id, golfer.id));
              matched.push(`${golfer.name} → ${fullName} (${playerId})`);

              // Also update scores
              const scoreToPar = obj.scoreToPar ?? obj.score_to_par ?? obj.total ?? obj.totalToPar ?? obj.toPar;
              const position = String(obj.position ?? obj.pos ?? obj.rank ?? "");
              let scoreNum = 0;
              if (scoreToPar === "E" || scoreToPar === "even") scoreNum = 0;
              else if (scoreToPar != null && scoreToPar !== "" && scoreToPar !== "-")
                scoreNum = Number(scoreToPar);

              // Update tournament result
              const existingResult = await db
                .select()
                .from(tournamentResults)
                .where(
                  eq(tournamentResults.golferId, golfer.id)
                );
              if (existingResult.length > 0) {
                await db
                  .update(tournamentResults)
                  .set({
                    finalPosition: position,
                    finalScoreToPar: scoreNum,
                    madeCut: !["MC", "WD", "DQ", "CUT"].includes(position.toUpperCase()),
                  })
                  .where(eq(tournamentResults.id, existingResult[0].id));
              }

              break;
            }
          }
        }

        results.matched = matched;
        results.message = `Fixed! Matched ${matched.length}/8 golfers. Hit Poll Now to update scores.`;
      }
    } catch (err) {
      results.error = String(err);
    }
  } else {
    // Just show schedule tournament names
    try {
      const schedRes = await fetch(
        "https://live-golf-data.p.rapidapi.com/schedule?orgId=1&year=2026",
        { headers }
      );
      const schedData = await schedRes.json();
      const items = schedData.schedule ?? schedData.tournaments ?? schedData.results ?? schedData;
      if (Array.isArray(items)) {
        results.allTournamentNames = items.map((t: Record<string, unknown>) =>
          `${t.tournId ?? t.id}: ${t.name ?? t.tournName}`
        );
      }
    } catch (err) {
      results.scheduleError = String(err);
    }
  }

  return NextResponse.json(results, { status: 200 });
}
