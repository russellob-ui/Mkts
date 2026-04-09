import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  real,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  avatarEmoji: text("avatar_emoji"),
  passcode: text("passcode"),
  color: text("color"),
});

export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slashTournId: text("slash_tourn_id"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  status: text("status").notNull().default("upcoming"), // upcoming|live|finished
  lastPolledAt: timestamp("last_polled_at"),
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
  status: text("status").notNull().default("upcoming"), // upcoming|live|finished
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

export const pointsLog = pgTable("points_log", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id),
  source: text("source").notNull(), // finish|rotd|bor
  points: real("points").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});
