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
      row_color TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wc_teams (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      fifa_code TEXT NOT NULL,
      group_letter TEXT NOT NULL,
      flag_emoji TEXT,
      api_team_id INTEGER,
      fifa_ranking INTEGER,
      tier INTEGER NOT NULL DEFAULT 1,
      eliminated BOOLEAN DEFAULT false,
      eliminated_at TEXT,
      best_finish TEXT
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS team_assignments (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id),
      team_id INTEGER NOT NULL REFERENCES wc_teams(id),
      draw_order INTEGER,
      assigned_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS team_assignments_team_idx ON team_assignments(team_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS matches (
      id SERIAL PRIMARY KEY,
      api_fixture_id INTEGER,
      home_team_id INTEGER NOT NULL REFERENCES wc_teams(id),
      away_team_id INTEGER NOT NULL REFERENCES wc_teams(id),
      stage TEXT NOT NULL,
      group_letter TEXT,
      kickoff TIMESTAMP NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      home_score INTEGER,
      away_score INTEGER,
      home_penalties INTEGER,
      away_penalties INTEGER,
      minute INTEGER,
      winner_team_id INTEGER REFERENCES wc_teams(id),
      last_polled_at TIMESTAMP,
      venue TEXT,
      city TEXT
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS matches_api_fixture_idx ON matches(api_fixture_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS matches_kickoff_idx ON matches(kickoff)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS matches_status_idx ON matches(status)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS match_events (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL REFERENCES matches(id),
      team_id INTEGER NOT NULL REFERENCES wc_teams(id),
      event_type TEXT NOT NULL,
      player_name TEXT,
      assist_player_name TEXT,
      minute INTEGER,
      detail TEXT,
      api_event_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS match_events_dedup_idx ON match_events(match_id, event_type, minute, player_name)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS match_events_match_idx ON match_events(match_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS points_log (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id),
      team_id INTEGER NOT NULL REFERENCES wc_teams(id),
      match_id INTEGER REFERENCES matches(id),
      source TEXT NOT NULL,
      points REAL NOT NULL,
      note TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS points_dedup_idx ON points_log(player_id, team_id, match_id, source)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS group_standings (
      id SERIAL PRIMARY KEY,
      team_id INTEGER NOT NULL REFERENCES wc_teams(id),
      group_letter TEXT NOT NULL,
      played INTEGER NOT NULL DEFAULT 0,
      won INTEGER NOT NULL DEFAULT 0,
      drawn INTEGER NOT NULL DEFAULT 0,
      lost INTEGER NOT NULL DEFAULT 0,
      goals_for INTEGER NOT NULL DEFAULT 0,
      goals_against INTEGER NOT NULL DEFAULT 0,
      goal_difference INTEGER NOT NULL DEFAULT 0,
      points INTEGER NOT NULL DEFAULT 0,
      position INTEGER,
      qualified BOOLEAN DEFAULT false,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS group_standings_team_idx ON group_standings(team_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS group_standings_group_idx ON group_standings(group_letter)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS draw_state (
      id SERIAL PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'not_started',
      seed TEXT,
      reveal_order JSONB,
      current_index INTEGER DEFAULT 0,
      draw_log JSONB,
      started_at TIMESTAMP,
      completed_at TIMESTAMP
    )
  `);

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
    CREATE TABLE IF NOT EXISTS banter_events (
      id SERIAL PRIMARY KEY,
      match_id INTEGER REFERENCES matches(id),
      player_id INTEGER REFERENCES players(id),
      team_id INTEGER REFERENCES wc_teams(id),
      event_type TEXT NOT NULL,
      headline TEXT NOT NULL,
      detail TEXT,
      emoji TEXT,
      importance INTEGER NOT NULL DEFAULT 5,
      source TEXT NOT NULL DEFAULT 'auto',
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS banter_events_time_idx ON banter_events(created_at DESC)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS predictions (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id),
      match_id INTEGER REFERENCES matches(id),
      prediction_type TEXT NOT NULL,
      prediction_value TEXT NOT NULL,
      submitted_at TIMESTAMP DEFAULT NOW() NOT NULL,
      resolved BOOLEAN DEFAULT false,
      correct BOOLEAN,
      points_awarded REAL,
      resolved_at TIMESTAMP
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS predictions_unique_idx ON predictions(player_id, match_id, prediction_type)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS commissioner_actions (
      id SERIAL PRIMARY KEY,
      match_id INTEGER REFERENCES matches(id),
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
    CREATE TABLE IF NOT EXISTS system_health (
      id SERIAL PRIMARY KEY,
      check_type TEXT NOT NULL,
      status TEXT NOT NULL,
      details JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // -- Add is_commissioner column to players (safe idempotent ALTER) --
  try {
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS is_commissioner BOOLEAN DEFAULT false`);
  } catch (e) {
    // column may already exist on older PG versions without IF NOT EXISTS support
    console.log("[DB] is_commissioner column may already exist:", e);
  }

  // -- Add notification columns to players --
  try {
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS email TEXT`);
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS phone TEXT`);
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS push_subscription TEXT`);
    await db.execute(sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS notification_prefs TEXT`);
  } catch (e) {
    console.log("[DB] notification columns may already exist:", e);
  }

  // -- Invite codes table --
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS invite_codes (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      used_by_player_id INTEGER REFERENCES players(id),
      created_at TIMESTAMP DEFAULT NOW(),
      used_at TIMESTAMP
    )
  `);

  // -- One-shot: make the first player the commissioner --
  try {
    await db.execute(sql`UPDATE players SET is_commissioner = true WHERE id = (SELECT MIN(id) FROM players)`);
  } catch (e) {
    console.log("[DB] Commissioner migration note:", e);
  }

  // -- Quiz Results --
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS quiz_results (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL REFERENCES players(id),
      quiz_date TEXT NOT NULL,
      answers JSONB NOT NULL,
      score INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS quiz_results_unique_idx ON quiz_results(player_id, quiz_date)`);

  // -- Superlative Votes --
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS superlative_votes (
      id SERIAL PRIMARY KEY,
      voter_id INTEGER NOT NULL REFERENCES players(id),
      category TEXT NOT NULL,
      nominee_player_slug TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS superlative_votes_unique_idx ON superlative_votes(voter_id, category)`);

  // -- Forfeit Spins --
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS forfeit_spins (
      id SERIAL PRIMARY KEY,
      spinner_id INTEGER REFERENCES players(id),
      forfeit TEXT NOT NULL,
      target_player_slug TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);

  // -- Trade Proposals --
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS trade_proposals (
      id SERIAL PRIMARY KEY,
      proposer_player_id INTEGER NOT NULL REFERENCES players(id),
      proposer_team_id INTEGER NOT NULL REFERENCES wc_teams(id),
      target_player_id INTEGER NOT NULL REFERENCES players(id),
      target_team_id INTEGER NOT NULL REFERENCES wc_teams(id),
      status TEXT NOT NULL DEFAULT 'pending',
      proposed_at TIMESTAMP DEFAULT NOW(),
      resolved_at TIMESTAMP
    )
  `);

  // ===== FANTASY FOOTBALL — additive, isolated from sweep =====
  // Per docs/fantasy/FINAL_PLAN.md. All FK references to existing tables
  // are read-only (no CASCADE into sweep tables).

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS footballers (
      id SERIAL PRIMARY KEY,
      api_player_id INTEGER UNIQUE,
      full_name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      nation TEXT NOT NULL,
      position TEXT NOT NULL CHECK (position IN ('GK','DEF','MID','FWD')),
      price_tenths INTEGER NOT NULL,
      data_source TEXT NOT NULL CHECK (data_source IN ('api-football','manual','heuristic')),
      eliminated_at TIMESTAMP,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS footballers_nation_idx ON footballers(nation)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS footballers_position_idx ON footballers(position)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS footballers_price_idx ON footballers(price_tenths)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS footballer_events (
      id SERIAL PRIMARY KEY,
      match_id INTEGER NOT NULL REFERENCES matches(id),
      footballer_id INTEGER NOT NULL REFERENCES footballers(id),
      event_type TEXT NOT NULL,
      minute INTEGER,
      value INTEGER NOT NULL DEFAULT 1,
      source TEXT NOT NULL,
      scoring_tier TEXT NOT NULL CHECK (scoring_tier IN ('LIVE','SIMPLIFIED','ADMIN')),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS footballer_events_dedupe_idx ON footballer_events(match_id, footballer_id, event_type, COALESCE(minute, -1), source)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS footballer_events_match_idx ON footballer_events(match_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS footballer_events_footballer_idx ON footballer_events(footballer_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS fantasy_gameweeks (
      id SERIAL PRIMARY KEY,
      gw_number INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      match_ids INTEGER[] NOT NULL,
      deadline_at TIMESTAMP NOT NULL,
      is_finalised BOOLEAN NOT NULL DEFAULT false,
      finalised_at TIMESTAMP,
      stage TEXT NOT NULL CHECK (stage IN ('GROUP','R16','QF','SF','F'))
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS fantasy_squads (
      id SERIAL PRIMARY KEY,
      human_id INTEGER NOT NULL REFERENCES players(id),
      gameweek_id INTEGER NOT NULL REFERENCES fantasy_gameweeks(id),
      is_free_hit BOOLEAN NOT NULL DEFAULT false,
      is_wildcard BOOLEAN NOT NULL DEFAULT false,
      is_triple_capt BOOLEAN NOT NULL DEFAULT false,
      is_bench_boost BOOLEAN NOT NULL DEFAULT false,
      locked_at TIMESTAMP,
      is_auto_applied BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (human_id, gameweek_id)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS fantasy_squad_slots (
      id SERIAL PRIMARY KEY,
      squad_id INTEGER NOT NULL REFERENCES fantasy_squads(id) ON DELETE CASCADE,
      footballer_id INTEGER NOT NULL REFERENCES footballers(id),
      slot_index INTEGER NOT NULL CHECK (slot_index BETWEEN 0 AND 14),
      is_starter BOOLEAN NOT NULL,
      bench_order INTEGER,
      is_captain BOOLEAN NOT NULL DEFAULT false,
      is_vice BOOLEAN NOT NULL DEFAULT false,
      UNIQUE (squad_id, slot_index),
      UNIQUE (squad_id, footballer_id)
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS fantasy_squad_slots_squad_idx ON fantasy_squad_slots(squad_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS fantasy_transfers (
      id SERIAL PRIMARY KEY,
      human_id INTEGER NOT NULL REFERENCES players(id),
      gameweek_id INTEGER NOT NULL REFERENCES fantasy_gameweeks(id),
      footballer_out INTEGER NOT NULL REFERENCES footballers(id),
      footballer_in INTEGER NOT NULL REFERENCES footballers(id),
      is_free BOOLEAN NOT NULL,
      is_forced BOOLEAN NOT NULL DEFAULT false,
      cost_points INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS fantasy_transfers_human_gw_idx ON fantasy_transfers(human_id, gameweek_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS fantasy_chips (
      id SERIAL PRIMARY KEY,
      human_id INTEGER NOT NULL REFERENCES players(id),
      chip_type TEXT NOT NULL CHECK (chip_type IN ('WILDCARD','FREE_HIT','TRIPLE_CAPT','BENCH_BOOST')),
      gameweek_id INTEGER REFERENCES fantasy_gameweeks(id),
      used_at TIMESTAMP,
      UNIQUE (human_id, chip_type)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS fantasy_footballer_gw_points (
      id SERIAL PRIMARY KEY,
      footballer_id INTEGER NOT NULL REFERENCES footballers(id),
      gameweek_id INTEGER NOT NULL REFERENCES fantasy_gameweeks(id),
      match_id INTEGER REFERENCES matches(id),
      minutes INTEGER NOT NULL DEFAULT 0,
      goals INTEGER NOT NULL DEFAULT 0,
      assists INTEGER NOT NULL DEFAULT 0,
      clean_sheets INTEGER NOT NULL DEFAULT 0,
      conceded INTEGER NOT NULL DEFAULT 0,
      saves INTEGER NOT NULL DEFAULT 0,
      pen_saved INTEGER NOT NULL DEFAULT 0,
      pen_missed INTEGER NOT NULL DEFAULT 0,
      yellow_cards INTEGER NOT NULL DEFAULT 0,
      red_cards INTEGER NOT NULL DEFAULT 0,
      own_goals INTEGER NOT NULL DEFAULT 0,
      total_points INTEGER NOT NULL DEFAULT 0,
      scoring_tier TEXT NOT NULL CHECK (scoring_tier IN ('LIVE','SIMPLIFIED','ADMIN')),
      is_provisional BOOLEAN NOT NULL DEFAULT true,
      computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (footballer_id, gameweek_id, match_id)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS fantasy_squad_gw_scores (
      id SERIAL PRIMARY KEY,
      squad_id INTEGER NOT NULL REFERENCES fantasy_squads(id),
      gameweek_id INTEGER NOT NULL REFERENCES fantasy_gameweeks(id),
      raw_points INTEGER NOT NULL,
      transfer_cost INTEGER NOT NULL DEFAULT 0,
      net_points INTEGER NOT NULL,
      captain_id INTEGER REFERENCES footballers(id),
      captain_played BOOLEAN NOT NULL DEFAULT false,
      vice_activated BOOLEAN NOT NULL DEFAULT false,
      is_provisional BOOLEAN NOT NULL DEFAULT true,
      computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (squad_id, gameweek_id)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS fantasy_score_corrections (
      id SERIAL PRIMARY KEY,
      footballer_id INTEGER NOT NULL REFERENCES footballers(id),
      gameweek_id INTEGER NOT NULL REFERENCES fantasy_gameweeks(id),
      reason TEXT NOT NULL,
      before_json JSONB NOT NULL,
      after_json JSONB NOT NULL,
      applied_by INTEGER REFERENCES players(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS fantasy_error_log (
      id SERIAL PRIMARY KEY,
      context TEXT NOT NULL,
      match_id INTEGER,
      gameweek_id INTEGER,
      error_message TEXT NOT NULL,
      stack TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS fantasy_finalised BOOLEAN NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE matches ADD COLUMN IF NOT EXISTS fantasy_finalised_at TIMESTAMP`);

  console.log("[DB] WC Sweep + Fantasy tables ensured");
}
