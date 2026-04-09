import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  real,
  boolean,
  uniqueIndex,
  jsonb,
  date,
} from "drizzle-orm/pg-core";

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  avatarEmoji: text("avatar_emoji"),
  passcode: text("passcode"),
  color: text("color"),
  rowColor: text("row_color"), // tailwind class e.g. "bg-red-900/20"
});

export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("tournament_slug").unique(),
  slashTournId: text("slash_tourn_id"),
  oddsApiSportKey: text("odds_api_sport_key"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  status: text("status").notNull().default("upcoming"),
  lastPolledAt: timestamp("last_polled_at"),
  lastOddsPolledAt: timestamp("last_odds_polled_at"),
  lastPollResult: text("last_poll_result"),
});

export const golfers = pgTable("golfers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  country: text("country"),
  flagEmoji: text("flag_emoji"),
  slashPlayerId: text("slash_player_id"),
});

export const picks = pgTable(
  "picks",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    tournamentId: integer("tournament_id")
      .notNull()
      .references(() => tournaments.id),
    golferId: integer("golfer_id")
      .notNull()
      .references(() => golfers.id),
    openingOdds: text("opening_odds"),
    openingOddsDecimal: real("opening_odds_decimal"),
    draftPickOrder: integer("draft_pick_order"),
  },
  (table) => [
    uniqueIndex("picks_player_tournament_idx").on(
      table.playerId,
      table.tournamentId
    ),
  ]
);

export const rounds = pgTable("rounds", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id),
  roundNumber: integer("round_number").notNull(),
  status: text("status").notNull().default("upcoming"),
});

export const roundScores = pgTable(
  "round_scores",
  {
    id: serial("id").primaryKey(),
    golferId: integer("golfer_id")
      .notNull()
      .references(() => golfers.id),
    roundId: integer("round_id")
      .notNull()
      .references(() => rounds.id),
    scoreToPar: integer("score_to_par"),
    thru: text("thru"),
    position: text("position"),
    roundScore: integer("round_score"), // absolute score e.g. 68
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("round_scores_golfer_round_idx").on(
      table.golferId,
      table.roundId
    ),
  ]
);

export const tournamentResults = pgTable(
  "tournament_results",
  {
    id: serial("id").primaryKey(),
    golferId: integer("golfer_id")
      .notNull()
      .references(() => golfers.id),
    tournamentId: integer("tournament_id")
      .notNull()
      .references(() => tournaments.id),
    finalPosition: text("final_position"),
    finalPositionDisplay: text("final_position_display"),
    finalScoreToPar: integer("final_score_to_par"),
    madeCut: boolean("made_cut"),
  },
  (table) => [
    uniqueIndex("tournament_results_golfer_tournament_idx").on(
      table.golferId,
      table.tournamentId
    ),
  ]
);

export const liveOdds = pgTable("live_odds", {
  id: serial("id").primaryKey(),
  golferId: integer("golfer_id")
    .notNull()
    .references(() => golfers.id),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id),
  fractional: text("fractional"), // "12/1"
  decimal: real("decimal"), // 13.0
  bookmaker: text("bookmaker"), // "average" or specific book
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const pointsLog = pgTable("points_log", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id),
  source: text("source").notNull(),
  points: real("points").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const scoreSnapshots = pgTable("score_snapshots", {
  id: serial("id").primaryKey(),
  golferId: integer("golfer_id")
    .notNull()
    .references(() => golfers.id),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id),
  roundNumber: integer("round_number").notNull(),
  totalScoreToPar: integer("total_score_to_par"),
  roundScoreToPar: integer("round_score_to_par"),
  position: text("position"),
  positionNumeric: integer("position_numeric"),
  thru: text("thru"),
  thruNumeric: integer("thru_numeric"),
  capturedAt: timestamp("captured_at").defaultNow().notNull(),
});

export const banterEvents = pgTable("banter_events", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id),
  roundNumber: integer("round_number"),
  playerId: integer("player_id").references(() => players.id),
  golferId: integer("golfer_id").references(() => golfers.id),
  eventType: text("event_type").notNull(),
  headline: text("headline").notNull(),
  detail: text("detail"),
  emoji: text("emoji"),
  importance: integer("importance").notNull().default(5),
  source: text("source").notNull().default("auto"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const seasonSnapshots = pgTable("season_snapshots", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id),
  cumulativePoints: real("cumulative_points").notNull(),
  throughTournamentId: integer("through_tournament_id")
    .notNull()
    .references(() => tournaments.id),
  capturedAt: timestamp("captured_at").defaultNow().notNull(),
});

export const draftState = pgTable("draft_state", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id)
    .unique(),
  status: text("status").notNull().default("not_started"),
  currentPickIndex: integer("current_pick_index"),
  pickOrder: jsonb("pick_order"), // array of player_ids
  deadline: timestamp("deadline"),
});
