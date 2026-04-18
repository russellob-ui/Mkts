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

  // v2 tables
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS score_snapshots (
      id SERIAL PRIMARY KEY,
      golfer_id INTEGER NOT NULL REFERENCES golfers(id),
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      round_number INTEGER NOT NULL,
      total_score_to_par INTEGER,
      round_score_to_par INTEGER,
      position TEXT,
      position_numeric INTEGER,
      thru TEXT,
      thru_numeric INTEGER,
      captured_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS score_snapshots_tourn_golfer_idx ON score_snapshots(tournament_id, golfer_id, captured_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS score_snapshots_tourn_time_idx ON score_snapshots(tournament_id, captured_at)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS banter_events (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      round_number INTEGER,
      player_id INTEGER REFERENCES players(id),
      golfer_id INTEGER REFERENCES golfers(id),
      event_type TEXT NOT NULL,
      headline TEXT NOT NULL,
      detail TEXT,
      emoji TEXT,
      importance INTEGER NOT NULL DEFAULT 5,
      source TEXT NOT NULL DEFAULT 'auto',
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS banter_events_tourn_time_idx ON banter_events(tournament_id, created_at DESC)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS season_snapshots (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id),
      cumulative_points REAL NOT NULL,
      through_tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      captured_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS season_snapshots_player_idx ON season_snapshots(player_id, captured_at)`);

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

  // v3 avatar fields
  await safeAdd("players", "avatar_image_base64", "TEXT");
  await safeAdd("players", "avatar_mime_type", "TEXT");
  await safeAdd("players", "avatar_uploaded_at", "TIMESTAMP");

  // v3.5 season_id on tournaments
  await safeAdd("tournaments", "season_id", "INTEGER");

  // ═══ v3: Social Layer tables ═══

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS seasons (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'upcoming',
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      champion_player_id INTEGER REFERENCES players(id),
      champion_total_points REAL,
      notes TEXT
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS commissioner_actions (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER REFERENCES tournaments(id),
      affected_player_id INTEGER REFERENCES players(id),
      action_type TEXT NOT NULL,
      points_delta REAL,
      headline TEXT NOT NULL,
      reason TEXT,
      emoji TEXT,
      visible BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS round_predictions (
      id SERIAL PRIMARY KEY,
      predictor_player_id INTEGER NOT NULL REFERENCES players(id),
      subject_player_id INTEGER NOT NULL REFERENCES players(id),
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      round_number INTEGER NOT NULL,
      predicted_score_to_par INTEGER NOT NULL,
      predicted_outcome TEXT NOT NULL,
      submitted_at TIMESTAMP DEFAULT NOW() NOT NULL,
      actual_score_to_par INTEGER,
      actual_outcome TEXT,
      outcome_correct BOOLEAN,
      exact_correct BOOLEAN,
      points_awarded REAL,
      resolved_at TIMESTAMP
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS predictions_unique_idx ON round_predictions(predictor_player_id, subject_player_id, tournament_id, round_number)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS hot_takes (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id),
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      take_text TEXT NOT NULL,
      category TEXT,
      submitted_at TIMESTAMP DEFAULT NOW() NOT NULL,
      graded_at TIMESTAMP,
      outcome TEXT,
      points_awarded REAL,
      grading_notes TEXT
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS records (
      id SERIAL PRIMARY KEY,
      record_type TEXT NOT NULL,
      player_id INTEGER REFERENCES players(id),
      golfer_id INTEGER REFERENCES golfers(id),
      tournament_id INTEGER REFERENCES tournaments(id),
      season_id INTEGER REFERENCES seasons(id),
      scope TEXT NOT NULL DEFAULT 'season',
      numeric_value REAL,
      display_value TEXT,
      description TEXT NOT NULL,
      set_at TIMESTAMP DEFAULT NOW() NOT NULL,
      superseded_at TIMESTAMP
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS yearbook_overrides (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id),
      field_name TEXT NOT NULL,
      override_value TEXT NOT NULL,
      set_by_commissioner BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS yearbook_overrides_player_field_idx ON yearbook_overrides(player_id, field_name)`);

  // ═══ v3.5: Chat + Persistence ═══

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id),
      player_name_snapshot TEXT NOT NULL,
      player_avatar_snapshot TEXT,
      body TEXT NOT NULL,
      context_type TEXT DEFAULT 'general',
      context_id INTEGER,
      reply_to_message_id INTEGER,
      reactions JSONB DEFAULT '{}',
      edited_at TIMESTAMP,
      deleted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS chat_messages_time_idx ON chat_messages(created_at DESC)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS chat_archive (
      id SERIAL PRIMARY KEY,
      archive_date TEXT NOT NULL UNIQUE,
      message_count INTEGER NOT NULL,
      archive_data JSONB NOT NULL,
      archived_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS system_health (
      id SERIAL PRIMARY KEY,
      check_type TEXT NOT NULL,
      status TEXT NOT NULL,
      details JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS backup_snapshots (
      id SERIAL PRIMARY KEY,
      snapshot_data JSONB NOT NULL,
      size_bytes INTEGER,
      triggered_by TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // ═══ Matchday Madness (football) ═══

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS football_matches (
      id SERIAL PRIMARY KEY,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      match_date TIMESTAMP NOT NULL,
      venue TEXT,
      status TEXT NOT NULL DEFAULT 'upcoming',
      api_fixture_id INTEGER,
      final_home_score INTEGER,
      final_away_score INTEGER,
      first_scorer TEXT,
      first_goal_minute INTEGER,
      total_corners INTEGER,
      total_cards INTEGER,
      current_minute INTEGER DEFAULT 0
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS football_players (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL REFERENCES football_matches(id),
      name TEXT NOT NULL,
      emoji TEXT,
      color TEXT
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS football_predictions (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL REFERENCES football_matches(id),
      player_id INTEGER NOT NULL REFERENCES football_players(id),
      predicted_home_score INTEGER,
      predicted_away_score INTEGER,
      first_scorer TEXT,
      first_goal_minute INTEGER,
      total_corners INTEGER,
      total_cards INTEGER,
      submitted_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS fp_match_player_idx ON football_predictions(match_id, player_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS football_bingo_cards (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL REFERENCES football_matches(id),
      player_id INTEGER NOT NULL REFERENCES football_players(id),
      squares JSONB NOT NULL DEFAULT '[]'
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS fb_match_player_idx ON football_bingo_cards(match_id, player_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS football_blocks (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL REFERENCES football_matches(id),
      player_id INTEGER NOT NULL REFERENCES football_players(id),
      block_label TEXT NOT NULL,
      block_start INTEGER NOT NULL,
      block_end INTEGER NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS football_events (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL REFERENCES football_matches(id),
      event_type TEXT NOT NULL,
      minute INTEGER,
      detail TEXT,
      team TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log("[DB] All tables ensured (v1+v2+v3+v3.5+matchday)");
}
