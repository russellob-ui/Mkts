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

// ---- Trade Proposals ----

export const tradeProposals = pgTable("trade_proposals", {
  id: serial("id").primaryKey(),
  proposerPlayerId: integer("proposer_player_id").notNull().references(() => players.id),
  proposerTeamId: integer("proposer_team_id").notNull().references(() => wcTeams.id),
  targetPlayerId: integer("target_player_id").notNull().references(() => players.id),
  targetTeamId: integer("target_team_id").notNull().references(() => wcTeams.id),
  status: text("status").notNull().default("pending"),
  proposedAt: timestamp("proposed_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// =====================================================================
// FANTASY FOOTBALL — see docs/fantasy/FINAL_PLAN.md
// `players` table above = the 8 humans. In fantasy code we alias them
// as `humans` semantically. `footballers` (below) = the WC players.
// =====================================================================

export type Human = typeof players.$inferSelect;

export const footballers = pgTable("footballers", {
  id: serial("id").primaryKey(),
  apiPlayerId: integer("api_player_id").unique(),
  fullName: text("full_name").notNull(),
  displayName: text("display_name").notNull(),
  nation: text("nation").notNull(),
  position: text("position").notNull(),
  priceTenths: integer("price_tenths").notNull(),
  dataSource: text("data_source").notNull(),
  eliminatedAt: timestamp("eliminated_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const footballerEvents = pgTable("footballer_events", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matches.id),
  footballerId: integer("footballer_id").notNull().references(() => footballers.id),
  eventType: text("event_type").notNull(),
  minute: integer("minute"),
  value: integer("value").notNull().default(1),
  source: text("source").notNull(),
  scoringTier: text("scoring_tier").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const fantasyGameweeks = pgTable("fantasy_gameweeks", {
  id: serial("id").primaryKey(),
  gwNumber: integer("gw_number").notNull().unique(),
  name: text("name").notNull(),
  matchIds: integer("match_ids").array().notNull(),
  deadlineAt: timestamp("deadline_at").notNull(),
  isFinalised: boolean("is_finalised").notNull().default(false),
  finalisedAt: timestamp("finalised_at"),
  stage: text("stage").notNull(),
});

export const fantasySquads = pgTable("fantasy_squads", {
  id: serial("id").primaryKey(),
  humanId: integer("human_id").notNull().references(() => players.id),
  gameweekId: integer("gameweek_id").notNull().references(() => fantasyGameweeks.id),
  isFreeHit: boolean("is_free_hit").notNull().default(false),
  isWildcard: boolean("is_wildcard").notNull().default(false),
  isTripleCapt: boolean("is_triple_capt").notNull().default(false),
  isBenchBoost: boolean("is_bench_boost").notNull().default(false),
  lockedAt: timestamp("locked_at"),
  isAutoApplied: boolean("is_auto_applied").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const fantasySquadSlots = pgTable("fantasy_squad_slots", {
  id: serial("id").primaryKey(),
  squadId: integer("squad_id").notNull().references(() => fantasySquads.id, { onDelete: "cascade" }),
  footballerId: integer("footballer_id").notNull().references(() => footballers.id),
  slotIndex: integer("slot_index").notNull(),
  isStarter: boolean("is_starter").notNull(),
  benchOrder: integer("bench_order"),
  isCaptain: boolean("is_captain").notNull().default(false),
  isVice: boolean("is_vice").notNull().default(false),
});

export const fantasyTransfers = pgTable("fantasy_transfers", {
  id: serial("id").primaryKey(),
  humanId: integer("human_id").notNull().references(() => players.id),
  gameweekId: integer("gameweek_id").notNull().references(() => fantasyGameweeks.id),
  footballerOut: integer("footballer_out").notNull().references(() => footballers.id),
  footballerIn: integer("footballer_in").notNull().references(() => footballers.id),
  isFree: boolean("is_free").notNull(),
  isForced: boolean("is_forced").notNull().default(false),
  costPoints: integer("cost_points").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const fantasyChips = pgTable("fantasy_chips", {
  id: serial("id").primaryKey(),
  humanId: integer("human_id").notNull().references(() => players.id),
  chipType: text("chip_type").notNull(),
  gameweekId: integer("gameweek_id").references(() => fantasyGameweeks.id),
  usedAt: timestamp("used_at"),
});

export const fantasyFootballerGwPoints = pgTable("fantasy_footballer_gw_points", {
  id: serial("id").primaryKey(),
  footballerId: integer("footballer_id").notNull().references(() => footballers.id),
  gameweekId: integer("gameweek_id").notNull().references(() => fantasyGameweeks.id),
  matchId: integer("match_id").references(() => matches.id),
  minutes: integer("minutes").notNull().default(0),
  goals: integer("goals").notNull().default(0),
  assists: integer("assists").notNull().default(0),
  cleanSheets: integer("clean_sheets").notNull().default(0),
  conceded: integer("conceded").notNull().default(0),
  saves: integer("saves").notNull().default(0),
  penSaved: integer("pen_saved").notNull().default(0),
  penMissed: integer("pen_missed").notNull().default(0),
  yellowCards: integer("yellow_cards").notNull().default(0),
  redCards: integer("red_cards").notNull().default(0),
  ownGoals: integer("own_goals").notNull().default(0),
  totalPoints: integer("total_points").notNull().default(0),
  scoringTier: text("scoring_tier").notNull(),
  isProvisional: boolean("is_provisional").notNull().default(true),
  computedAt: timestamp("computed_at").notNull().defaultNow(),
});

export const fantasySquadGwScores = pgTable("fantasy_squad_gw_scores", {
  id: serial("id").primaryKey(),
  squadId: integer("squad_id").notNull().references(() => fantasySquads.id),
  gameweekId: integer("gameweek_id").notNull().references(() => fantasyGameweeks.id),
  rawPoints: integer("raw_points").notNull(),
  transferCost: integer("transfer_cost").notNull().default(0),
  netPoints: integer("net_points").notNull(),
  captainId: integer("captain_id").references(() => footballers.id),
  captainPlayed: boolean("captain_played").notNull().default(false),
  viceActivated: boolean("vice_activated").notNull().default(false),
  isProvisional: boolean("is_provisional").notNull().default(true),
  computedAt: timestamp("computed_at").notNull().defaultNow(),
});

export const fantasyScoreCorrections = pgTable("fantasy_score_corrections", {
  id: serial("id").primaryKey(),
  footballerId: integer("footballer_id").notNull().references(() => footballers.id),
  gameweekId: integer("gameweek_id").notNull().references(() => fantasyGameweeks.id),
  reason: text("reason").notNull(),
  beforeJson: jsonb("before_json").notNull(),
  afterJson: jsonb("after_json").notNull(),
  appliedBy: integer("applied_by").references(() => players.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const fantasyErrorLog = pgTable("fantasy_error_log", {
  id: serial("id").primaryKey(),
  context: text("context").notNull(),
  matchId: integer("match_id"),
  gameweekId: integer("gameweek_id"),
  errorMessage: text("error_message").notNull(),
  stack: text("stack"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
