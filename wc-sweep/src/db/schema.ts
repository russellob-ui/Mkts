import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  real,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ---- Players (flexible roster, join via invite) ----

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  avatarEmoji: text("avatar_emoji"),
  passcode: text("passcode"),
  color: text("color"),
  rowColor: text("row_color"),
  isCommissioner: boolean("is_commissioner").default(false),
  email: text("email"),
  phone: text("phone"), // WhatsApp number with country code e.g. +447548442766
  pushSubscription: text("push_subscription"), // Web push subscription JSON
  notificationPrefs: text("notification_prefs"), // JSON preferences
  createdAt: timestamp("created_at").defaultNow(),
});

// ---- Invite Codes ----

export const inviteCodes = pgTable("invite_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  usedByPlayerId: integer("used_by_player_id").references(() => players.id),
  createdAt: timestamp("created_at").defaultNow(),
  usedAt: timestamp("used_at"),
});

// ---- 48 World Cup Teams ----

export const wcTeams = pgTable("wc_teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  fifaCode: text("fifa_code").notNull(),
  groupLetter: text("group_letter").notNull(),
  flagEmoji: text("flag_emoji"),
  apiTeamId: integer("api_team_id"),
  fifaRanking: integer("fifa_ranking"),
  tier: integer("tier").notNull().default(1),
  eliminated: boolean("eliminated").default(false),
  eliminatedAt: text("eliminated_at"),
  bestFinish: text("best_finish"),
});

// ---- Team Assignments (1:many — each player gets N teams) ----

export const teamAssignments = pgTable(
  "team_assignments",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    teamId: integer("team_id")
      .notNull()
      .references(() => wcTeams.id),
    drawOrder: integer("draw_order"),
    assignedAt: timestamp("assigned_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("team_assignments_team_idx").on(table.teamId),
  ]
);

// ---- Matches (all 104 fixtures) ----

export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    apiFixtureId: integer("api_fixture_id"),
    homeTeamId: integer("home_team_id")
      .notNull()
      .references(() => wcTeams.id),
    awayTeamId: integer("away_team_id")
      .notNull()
      .references(() => wcTeams.id),
    stage: text("stage").notNull(),
    groupLetter: text("group_letter"),
    kickoff: timestamp("kickoff").notNull(),
    status: text("status").notNull().default("scheduled"),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    homePenalties: integer("home_penalties"),
    awayPenalties: integer("away_penalties"),
    minute: integer("minute"),
    winnerTeamId: integer("winner_team_id").references(() => wcTeams.id),
    lastPolledAt: timestamp("last_polled_at"),
    venue: text("venue"),
    city: text("city"),
  },
  (table) => [
    uniqueIndex("matches_api_fixture_idx").on(table.apiFixtureId),
    index("matches_kickoff_idx").on(table.kickoff),
    index("matches_status_idx").on(table.status),
  ]
);

// ---- Match Events (goals, cards, subs — for banter + detail) ----

export const matchEvents = pgTable(
  "match_events",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id),
    teamId: integer("team_id")
      .notNull()
      .references(() => wcTeams.id),
    eventType: text("event_type").notNull(),
    playerName: text("player_name"),
    assistPlayerName: text("assist_player_name"),
    minute: integer("minute"),
    detail: text("detail"),
    apiEventId: text("api_event_id"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("match_events_dedup_idx").on(
      table.matchId,
      table.eventType,
      table.minute,
      table.playerName
    ),
    index("match_events_match_idx").on(table.matchId),
  ]
);

// ---- Points Log (idempotent ledger) ----

export const pointsLog = pgTable(
  "points_log",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    teamId: integer("team_id")
      .notNull()
      .references(() => wcTeams.id),
    matchId: integer("match_id").references(() => matches.id),
    source: text("source").notNull(),
    points: real("points").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("points_dedup_idx").on(
      table.playerId,
      table.teamId,
      table.matchId,
      table.source
    ),
  ]
);

// ---- Group Standings ----

export const groupStandings = pgTable(
  "group_standings",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => wcTeams.id),
    groupLetter: text("group_letter").notNull(),
    played: integer("played").notNull().default(0),
    won: integer("won").notNull().default(0),
    drawn: integer("drawn").notNull().default(0),
    lost: integer("lost").notNull().default(0),
    goalsFor: integer("goals_for").notNull().default(0),
    goalsAgainst: integer("goals_against").notNull().default(0),
    goalDifference: integer("goal_difference").notNull().default(0),
    points: integer("points").notNull().default(0),
    position: integer("position"),
    qualified: boolean("qualified").default(false),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("group_standings_team_idx").on(table.teamId),
    index("group_standings_group_idx").on(table.groupLetter),
  ]
);

// ---- Draw State ----

export const drawState = pgTable("draw_state", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("not_started"),
  seed: text("seed"),
  revealOrder: jsonb("reveal_order"),
  currentIndex: integer("current_index").default(0),
  drawLog: jsonb("draw_log"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

// ---- Chat Messages (copied from golf-sweep) ----

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id").references(() => players.id),
    playerNameSnapshot: text("player_name_snapshot").notNull(),
    playerAvatarSnapshot: text("player_avatar_snapshot"),
    body: text("body").notNull(),
    contextType: text("context_type").default("general"),
    contextId: integer("context_id"),
    replyToMessageId: integer("reply_to_message_id"),
    reactions: jsonb("reactions").default("{}"),
    editedAt: timestamp("edited_at"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("chat_messages_time_idx").on(table.createdAt)]
);

// ---- Banter Events ----

export const banterEvents = pgTable(
  "banter_events",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id").references(() => matches.id),
    playerId: integer("player_id").references(() => players.id),
    teamId: integer("team_id").references(() => wcTeams.id),
    eventType: text("event_type").notNull(),
    headline: text("headline").notNull(),
    detail: text("detail"),
    emoji: text("emoji"),
    importance: integer("importance").notNull().default(5),
    source: text("source").notNull().default("auto"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("banter_events_time_idx").on(table.createdAt)]
);

// ---- Predictions ----

export const predictions = pgTable(
  "predictions",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    matchId: integer("match_id").references(() => matches.id),
    predictionType: text("prediction_type").notNull(),
    predictionValue: text("prediction_value").notNull(),
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
    resolved: boolean("resolved").default(false),
    correct: boolean("correct"),
    pointsAwarded: real("points_awarded"),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => [
    uniqueIndex("predictions_unique_idx").on(
      table.playerId,
      table.matchId,
      table.predictionType
    ),
  ]
);

// ---- Commissioner Actions ----

export const commissionerActions = pgTable("commissioner_actions", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").references(() => matches.id),
  affectedPlayerId: integer("affected_player_id").references(() => players.id),
  actionType: text("action_type").notNull(),
  pointsDelta: real("points_delta"),
  headline: text("headline").notNull(),
  reason: text("reason"),
  emoji: text("emoji"),
  visible: boolean("visible").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---- System Health ----

export const systemHealth = pgTable("system_health", {
  id: serial("id").primaryKey(),
  checkType: text("check_type").notNull(),
  status: text("status").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---- Quiz Results ----

export const quizResults = pgTable(
  "quiz_results",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    quizDate: text("quiz_date").notNull(),
    answers: jsonb("answers").notNull(),
    score: integer("score").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("quiz_results_unique_idx").on(table.playerId, table.quizDate),
  ]
);

// ---- Superlative Votes ----

export const superlativeVotes = pgTable(
  "superlative_votes",
  {
    id: serial("id").primaryKey(),
    voterId: integer("voter_id")
      .notNull()
      .references(() => players.id),
    category: text("category").notNull(),
    nomineePlayerSlug: text("nominee_player_slug").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("superlative_votes_unique_idx").on(
      table.voterId,
      table.category
    ),
  ]
);

// ---- Forfeit Spins ----

export const forfeitSpins = pgTable("forfeit_spins", {
  id: serial("id").primaryKey(),
  spinnerId: integer("spinner_id").references(() => players.id),
  forfeit: text("forfeit").notNull(),
  targetPlayerSlug: text("target_player_slug"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
