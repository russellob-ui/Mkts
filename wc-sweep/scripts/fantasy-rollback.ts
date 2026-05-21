// Sweep isolation rollback (see docs/fantasy/FINAL_PLAN.md §2).
// Drops every fantasy_* table + footballers + footballer_events, removes
// fantasy columns from matches. Leaves sweep schema untouched.
// Usage: tsx scripts/fantasy-rollback.ts

import { getDb } from "@/db";
import { sql } from "drizzle-orm";

async function main() {
  const db = getDb();

  const tables = [
    "fantasy_error_log",
    "fantasy_score_corrections",
    "fantasy_squad_gw_scores",
    "fantasy_footballer_gw_points",
    "fantasy_chips",
    "fantasy_transfers",
    "fantasy_squad_slots",
    "fantasy_squads",
    "fantasy_gameweeks",
    "footballer_events",
    "footballers",
  ];

  for (const t of tables) {
    console.log(`DROP TABLE IF EXISTS ${t} CASCADE`);
    await db.execute(sql.raw(`DROP TABLE IF EXISTS ${t} CASCADE`));
  }

  await db.execute(sql`ALTER TABLE matches DROP COLUMN IF EXISTS fantasy_finalised`);
  await db.execute(sql`ALTER TABLE matches DROP COLUMN IF EXISTS fantasy_finalised_at`);

  console.log("Fantasy schema rolled back.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
