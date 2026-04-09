import { getDb } from "./index";
import { sql } from "drizzle-orm";

export async function ensureTables() {
  const db = getDb();

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      avatar_emoji TEXT,
      passcode TEXT,
      color TEXT,
      row_color TEXT
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tournaments (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      tournament_slug TEXT UNIQUE,
      slash_tourn_id TEXT,
      odds_api_sport_key TEXT,
      start_date TEXT,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'upcoming',
      last_polled_at TIMESTAMP,
      last_odds_polled_at TIMESTAMP,
      last_poll_result TEXT
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS golfers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      country TEXT,
      flag_emoji TEXT,
      slash_player_id TEXT
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS picks (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id),
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      golfer_id INTEGER NOT NULL REFERENCES golfers(id),
      opening_odds TEXT,
      opening_odds_decimal REAL,
      draft_pick_order INTEGER
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS picks_player_tournament_idx ON picks(player_id, tournament_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS rounds (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      round_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'upcoming'
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS round_scores (
      id SERIAL PRIMARY KEY,
      golfer_id INTEGER NOT NULL REFERENCES golfers(id),
      round_id INTEGER NOT NULL REFERENCES rounds(id),
      score_to_par INTEGER,
      thru TEXT,
      position TEXT,
      round_score INTEGER,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS round_scores_golfer_round_idx ON round_scores(golfer_id, round_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tournament_results (
      id SERIAL PRIMARY KEY,
      golfer_id INTEGER NOT NULL REFERENCES golfers(id),
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      final_position TEXT,
      final_position_display TEXT,
      final_score_to_par INTEGER,
      made_cut BOOLEAN
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS tournament_results_golfer_tournament_idx ON tournament_results(golfer_id, tournament_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS live_odds (
      id SERIAL PRIMARY KEY,
      golfer_id INTEGER NOT NULL REFERENCES golfers(id),
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      fractional TEXT,
      "decimal" REAL,
      bookmaker TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS points_log (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id),
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      source TEXT NOT NULL,
      points REAL NOT NULL,
      note TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS draft_state (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id) UNIQUE,
      status TEXT NOT NULL DEFAULT 'not_started',
      current_pick_index INTEGER,
      pick_order JSONB,
      deadline TIMESTAMP
    )
  `);

  // Add columns that might be missing from older schema versions
  const safeAdd = async (table: string, column: string, type: string) => {
    try {
      await db.execute(sql.raw(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${type}`));
    } catch {}
  };
  await safeAdd("players", "row_color", "TEXT");
  await safeAdd("tournaments", "tournament_slug", "TEXT");
  await safeAdd("tournaments", "odds_api_sport_key", "TEXT");
  await safeAdd("tournaments", "last_odds_polled_at", "TIMESTAMP");
  await safeAdd("picks", "opening_odds_decimal", "REAL");
  await safeAdd("picks", "draft_pick_order", "INTEGER");
  await safeAdd("round_scores", "round_score", "INTEGER");
  await safeAdd("tournament_results", "final_position_display", "TEXT");

  console.log("[DB] All tables ensured");
}
