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
  rowColor: text("row_color"),
  avatarImageBase64: text("avatar_image_base64"),
  avatarMimeType: text("avatar_mime_type"),
  avatarUploadedAt: timestamp("avatar_uploaded_at"),
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
  seasonId: integer("season_id"),
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

// ═══ v3: Social Layer ═══

export const seasons = pgTable("seasons", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull().unique(),
  status: text("status").notNull().default("upcoming"), // upcoming|current|complete
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  championPlayerId: integer("champion_player_id").references(() => players.id),
  championTotalPoints: real("champion_total_points"),
  notes: text("notes"),
});

export const commissionerActions = pgTable("commissioner_actions", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").references(() => tournaments.id),
  affectedPlayerId: integer("affected_player_id").references(() => players.id),
  actionType: text("action_type").notNull(),
  pointsDelta: real("points_delta"),
  headline: text("headline").notNull(),
  reason: text("reason"),
  emoji: text("emoji"),
  visible: boolean("visible").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const roundPredictions = pgTable(
  "round_predictions",
  {
    id: serial("id").primaryKey(),
    predictorPlayerId: integer("predictor_player_id")
      .notNull()
      .references(() => players.id),
    subjectPlayerId: integer("subject_player_id")
      .notNull()
      .references(() => players.id),
    tournamentId: integer("tournament_id")
      .notNull()
      .references(() => tournaments.id),
    roundNumber: integer("round_number").notNull(),
    predictedScoreToPar: integer("predicted_score_to_par").notNull(),
    predictedOutcome: text("predicted_outcome").notNull(), // red|even|over
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
    actualScoreToPar: integer("actual_score_to_par"),
    actualOutcome: text("actual_outcome"),
    outcomeCorrect: boolean("outcome_correct"),
    exactCorrect: boolean("exact_correct"),
    pointsAwarded: real("points_awarded"),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => [
    uniqueIndex("predictions_unique_idx").on(
      table.predictorPlayerId,
      table.subjectPlayerId,
      table.tournamentId,
      table.roundNumber
    ),
  ]
);

export const hotTakes = pgTable("hot_takes", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id),
  takeText: text("take_text").notNull(),
  category: text("category"), // winner|miss_cut|score|playoff|other
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  gradedAt: timestamp("graded_at"),
  outcome: text("outcome"), // correct|wrong|partial|ungraded
  pointsAwarded: real("points_awarded"),
  gradingNotes: text("grading_notes"),
});

export const records = pgTable("records", {
  id: serial("id").primaryKey(),
  recordType: text("record_type").notNull(),
  playerId: integer("player_id").references(() => players.id),
  golferId: integer("golfer_id").references(() => golfers.id),
  tournamentId: integer("tournament_id").references(() => tournaments.id),
  seasonId: integer("season_id").references(() => seasons.id),
  scope: text("scope").notNull().default("season"), // all_time|season
  numericValue: real("numeric_value"),
  displayValue: text("display_value"),
  description: text("description").notNull(),
  setAt: timestamp("set_at").defaultNow().notNull(),
  supersededAt: timestamp("superseded_at"),
});

export const yearbookOverrides = pgTable(
  "yearbook_overrides",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    fieldName: text("field_name").notNull(),
    overrideValue: text("override_value").notNull(),
    setByCommissioner: boolean("set_by_commissioner").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("yearbook_overrides_player_field_idx").on(
      table.playerId,
      table.fieldName
    ),
  ]
);

// ═══ v3.5: Chat + Persistence ═══

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").references(() => players.id),
  playerNameSnapshot: text("player_name_snapshot").notNull(),
  playerAvatarSnapshot: text("player_avatar_snapshot"),
  body: text("body").notNull(),
  contextType: text("context_type").default("general"), // general|tournament|round
  contextId: integer("context_id"),
  replyToMessageId: integer("reply_to_message_id"),
  reactions: jsonb("reactions").default("{}"),
  editedAt: timestamp("edited_at"),
  deletedAt: timestamp("deleted_at"), // soft delete ONLY — NEVER hard delete
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatArchive = pgTable("chat_archive", {
  id: serial("id").primaryKey(),
  archiveDate: text("archive_date").notNull().unique(), // YYYY-MM-DD
  messageCount: integer("message_count").notNull(),
  archiveData: jsonb("archive_data").notNull(),
  archivedAt: timestamp("archived_at").defaultNow().notNull(),
});

export const systemHealth = pgTable("system_health", {
  id: serial("id").primaryKey(),
  checkType: text("check_type").notNull(),
  status: text("status").notNull(), // ok|warning|critical
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const backupSnapshots = pgTable("backup_snapshots", {
  id: serial("id").primaryKey(),
  snapshotData: jsonb("snapshot_data").notNull(),
  sizeBytes: integer("size_bytes"),
  triggeredBy: text("triggered_by"), // cron|manual|pre_migration
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
