import { getDb } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Guard against destructive operations.
 * Refuses to proceed unless ALLOW_DESTRUCTIVE_OPS=true.
 */
export function assertNonDestructive(operation: string, tableName: string) {
  if (process.env.ALLOW_DESTRUCTIVE_OPS === "true") return;
  throw new Error(
    `[DB Safety] Destructive operation "${operation}" on "${tableName}" blocked. ` +
    `Set ALLOW_DESTRUCTIVE_OPS=true to proceed.`
  );
}

/**
 * Run on server boot: verify all critical tables exist and have expected minimum rows.
 */
export async function assertDataIntegrity(): Promise<{
  status: "ok" | "warning" | "critical";
  details: Record<string, unknown>;
}> {
  const db = getDb();
  const details: Record<string, unknown> = {};

  const tables = [
    { name: "players", minRows: 8 },
    { name: "tournaments", minRows: 1 },
    { name: "golfers", minRows: 8 },
    { name: "picks", minRows: 1 },
    { name: "rounds", minRows: 1 },
  ];

  let status: "ok" | "warning" | "critical" = "ok";

  for (const { name, minRows } of tables) {
    try {
      const result = await db.execute(sql.raw(`SELECT count(*) as c FROM ${name}`));
      const count = Number((result as unknown as Array<{ c: string }>)[0]?.c ?? 0);
      details[name] = count;
      if (count < minRows) {
        status = count === 0 ? "critical" : "warning";
        console.warn(`[DB Safety] Table ${name} has ${count} rows (expected >= ${minRows})`);
      }
    } catch {
      details[name] = "TABLE_MISSING";
      status = "critical";
    }
  }

  // Log to system_health
  try {
    await db.execute(
      sql`INSERT INTO system_health (check_type, status, details) VALUES ('boot_integrity', ${status}, ${JSON.stringify(details)}::jsonb)`
    );
  } catch {
    // Table might not exist yet on first boot
  }

  console.log(`[DB Safety] Integrity check: ${status}`, details);
  return { status, details };
}

/**
 * Export entire database as JSON for backup.
 */
export async function exportFullDatabase(): Promise<Record<string, unknown[]>> {
  const db = getDb();
  const tables = [
    "players", "tournaments", "golfers", "picks", "rounds", "round_scores",
    "tournament_results", "live_odds", "points_log", "score_snapshots",
    "banter_events", "season_snapshots", "draft_state", "seasons",
    "commissioner_actions", "round_predictions", "hot_takes", "records",
    "yearbook_overrides", "chat_messages", "chat_archive",
  ];

  const backup: Record<string, unknown[]> = {};
  for (const table of tables) {
    try {
      const rows = await db.execute(sql.raw(`SELECT * FROM ${table}`));
      backup[table] = rows as unknown as unknown[];
    } catch {
      backup[table] = [];
    }
  }
  return backup;
}
