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

  console.log("[DB] WC Sweep tables ensured");
}
