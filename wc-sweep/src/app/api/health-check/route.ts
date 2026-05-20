import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  wcTeams,
  players,
  drawState,
  matches,
  teamAssignments,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getTeams } from "@/lib/api-football";

export const dynamic = "force-dynamic";

interface Check {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

let tablesEnsured = false;

export async function GET() {
  const checks: Check[] = [];
  let overall: "healthy" | "warning" | "critical" = "healthy";

  function addCheck(name: string, status: "pass" | "warn" | "fail", detail: string) {
    checks.push({ name, status, detail });
    if (status === "fail" && overall !== "critical") overall = "critical";
    if (status === "warn" && overall === "healthy") overall = "warning";
  }

  // Ensure tables exist
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }
  } catch (err) {
    addCheck("Database connection", "fail", String(err));
    return NextResponse.json({
      status: "critical" as const,
      checks,
      timestamp: new Date().toISOString(),
    });
  }

  // 1. Database connection
  try {
    await db.execute(sql`SELECT 1`);
    addCheck("Database connection", "pass", "Connected successfully");
  } catch (err) {
    addCheck("Database connection", "fail", `Cannot connect: ${String(err)}`);
    return NextResponse.json({
      status: "critical" as const,
      checks,
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Teams seeded (should be 48)
  try {
    const allTeams = await db.select().from(wcTeams);
    if (allTeams.length === 48) {
      addCheck("Teams seeded", "pass", `${allTeams.length} teams found`);
    } else if (allTeams.length > 0) {
      addCheck("Teams seeded", "warn", `${allTeams.length}/48 teams found`);
    } else {
      addCheck("Teams seeded", "fail", "No teams seeded");
    }
  } catch (err) {
    addCheck("Teams seeded", "fail", String(err));
  }

  // 3. Players exist
  try {
    const allPlayers = await db.select().from(players);
    if (allPlayers.length >= 1) {
      addCheck("Players exist", "pass", `${allPlayers.length} players found`);
    } else {
      addCheck("Players exist", "warn", "No players registered yet");
    }
  } catch (err) {
    addCheck("Players exist", "fail", String(err));
  }

  // 4. Draw completed
  try {
    const draws = await db
      .select()
      .from(drawState)
      .where(eq(drawState.status, "complete"));
    if (draws.length >= 1) {
      addCheck("Draw completed", "pass", "Draw is complete");
    } else {
      addCheck("Draw completed", "warn", "Draw not yet completed");
    }
  } catch (err) {
    addCheck("Draw completed", "fail", String(err));
  }

  // 5. Matches exist
  try {
    const allMatches = await db.select({ id: matches.id }).from(matches);
    if (allMatches.length > 0) {
      addCheck("Matches exist", "pass", `${allMatches.length} matches found`);
    } else {
      addCheck("Matches exist", "warn", "No matches synced yet");
    }
  } catch (err) {
    addCheck("Matches exist", "fail", String(err));
  }

  // 6. API-Football responds
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const teams = await getTeams(2026);
    clearTimeout(timeout);
    if (teams.length > 0) {
      addCheck("API-Football", "pass", `API returned ${teams.length} teams`);
    } else {
      addCheck("API-Football", "warn", "API returned 0 teams");
    }
  } catch (err) {
    addCheck("API-Football", "warn", `API unreachable: ${String(err)}`);
  }

  // 7. No duplicate team assignments
  try {
    const dupes = await db.execute(sql`
      SELECT team_id, COUNT(*) as cnt
      FROM team_assignments
      GROUP BY team_id
      HAVING COUNT(*) > 1
    `);
    const dupeRows = Array.isArray(dupes) ? dupes : (dupes as { rows?: unknown[] }).rows ?? [];
    if ((dupeRows as unknown[]).length === 0) {
      addCheck("No duplicate assignments", "pass", "All team assignments are unique");
    } else {
      addCheck(
        "No duplicate assignments",
        "fail",
        `${(dupeRows as unknown[]).length} teams assigned to multiple players`
      );
    }
  } catch (err) {
    addCheck("No duplicate assignments", "fail", String(err));
  }

  return NextResponse.json({
    status: overall,
    checks,
    timestamp: new Date().toISOString(),
  });
}
