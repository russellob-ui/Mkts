export const BINGO_POOL = [
  { key: "goal_before_15", text: "Goal before 15th min" },
  { key: "goal_first_half", text: "Goal in first half" },
  { key: "goal_second_half", text: "Goal in second half" },
  { key: "both_teams_score", text: "Both teams score" },
  { key: "3plus_goals", text: "3+ goals in the match" },
  { key: "header_goal", text: "Goal from a header" },
  { key: "set_piece_goal", text: "Goal from a set piece" },
  { key: "yellow_before_ht", text: "Yellow card before HT" },
  { key: "3plus_yellows", text: "3+ yellow cards total" },
  { key: "red_card", text: "Red card in the match" },
  { key: "corner_first_5", text: "Corner in first 5 mins" },
  { key: "5plus_corners_fh", text: "5+ corners in first half" },
  { key: "10plus_corners", text: "10+ corners total" },
  { key: "var_review", text: "VAR review" },
  { key: "penalty", text: "Penalty awarded" },
  { key: "woodwork", text: "Shot hits the woodwork" },
  { key: "sub_before_60", text: "Sub before 60th min" },
  { key: "offside_goal", text: "Goal disallowed (offside)" },
  { key: "injury_2min", text: "Injury stoppage > 2 mins" },
  { key: "4plus_added_time", text: "4+ mins added time" },
  { key: "fk_edge_of_box", text: "Free kick edge of box" },
  { key: "gk_great_save", text: "Keeper makes a great save" },
  { key: "home_win", text: "Home team wins" },
  { key: "away_win", text: "Away team wins" },
  { key: "draw", text: "Match ends in a draw" },
  { key: "clean_sheet", text: "Either team keeps clean sheet" },
  { key: "goal_last_10", text: "Goal in last 10 mins" },
];

export function generateBingoCard(): Array<{
  key: string;
  text: string;
  marked: boolean;
}> {
  const shuffled = [...BINGO_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 9).map((e) => ({ ...e, marked: false }));
}

export const MINUTE_BLOCKS = [
  { label: "1–11", start: 1, end: 11 },
  { label: "12–22", start: 12, end: 22 },
  { label: "23–33", start: 23, end: 33 },
  { label: "34–45", start: 34, end: 45 },
  { label: "46–56", start: 46, end: 56 },
  { label: "57–67", start: 57, end: 67 },
  { label: "68–78", start: 68, end: 78 },
  { label: "79–90+", start: 79, end: 99 },
];

export function draftBlocks(
  playerIds: number[]
): Array<{ playerId: number; block: (typeof MINUTE_BLOCKS)[number] }> {
  const shuffled = [...MINUTE_BLOCKS].sort(() => Math.random() - 0.5);
  const result: Array<{
    playerId: number;
    block: (typeof MINUTE_BLOCKS)[number];
  }> = [];
  // Snake draft: 1,2,3,4,4,3,2,1
  const order = [...playerIds, ...[...playerIds].reverse()];
  for (let i = 0; i < shuffled.length && i < order.length; i++) {
    result.push({ playerId: order[i], block: shuffled[i] });
  }
  return result;
}

export interface PredictionScoring {
  exactScore: number;
  correctResult: number;
  firstScorer: number;
  firstGoalMinute: number;
  totalCorners: number;
  totalCards: number;
  total: number;
}

export function scorePrediction(
  pred: {
    predictedHomeScore: number | null;
    predictedAwayScore: number | null;
    firstScorer: string | null;
    firstGoalMinute: number | null;
    totalCorners: number | null;
    totalCards: number | null;
  },
  actual: {
    homeScore: number | null;
    awayScore: number | null;
    firstScorer: string | null;
    firstGoalMinute: number | null;
    totalCorners: number | null;
    totalCards: number | null;
  }
): PredictionScoring {
  const r: PredictionScoring = {
    exactScore: 0,
    correctResult: 0,
    firstScorer: 0,
    firstGoalMinute: 0,
    totalCorners: 0,
    totalCards: 0,
    total: 0,
  };

  if (
    pred.predictedHomeScore != null &&
    pred.predictedAwayScore != null &&
    actual.homeScore != null &&
    actual.awayScore != null
  ) {
    if (
      pred.predictedHomeScore === actual.homeScore &&
      pred.predictedAwayScore === actual.awayScore
    ) {
      r.exactScore = 10;
    } else {
      const pResult =
        pred.predictedHomeScore > pred.predictedAwayScore
          ? "H"
          : pred.predictedHomeScore < pred.predictedAwayScore
            ? "A"
            : "D";
      const aResult =
        actual.homeScore > actual.awayScore
          ? "H"
          : actual.homeScore < actual.awayScore
            ? "A"
            : "D";
      if (pResult === aResult) r.correctResult = 3;
    }
  }

  if (
    pred.firstScorer &&
    actual.firstScorer &&
    pred.firstScorer.toLowerCase().trim() ===
      actual.firstScorer.toLowerCase().trim()
  ) {
    r.firstScorer = 5;
  }

  if (
    pred.firstGoalMinute != null &&
    actual.firstGoalMinute != null
  ) {
    const diff = Math.abs(pred.firstGoalMinute - actual.firstGoalMinute);
    if (diff <= 5) r.firstGoalMinute = 3;
    else if (diff <= 10) r.firstGoalMinute = 1;
  }

  if (pred.totalCorners != null && actual.totalCorners != null) {
    if (Math.abs(pred.totalCorners - actual.totalCorners) <= 2)
      r.totalCorners = 2;
  }

  if (pred.totalCards != null && actual.totalCards != null) {
    if (Math.abs(pred.totalCards - actual.totalCards) <= 1) r.totalCards = 2;
  }

  r.total =
    r.exactScore +
    r.correctResult +
    r.firstScorer +
    r.firstGoalMinute +
    r.totalCorners +
    r.totalCards;
  return r;
}

export function scoreBingo(
  squares: Array<{ key: string; text: string; marked: boolean }>
): { squares: number; lines: number; fullHouse: boolean; total: number } {
  const markedCount = squares.filter((s) => s.marked).length;
  const grid = [
    [squares[0]?.marked, squares[1]?.marked, squares[2]?.marked],
    [squares[3]?.marked, squares[4]?.marked, squares[5]?.marked],
    [squares[6]?.marked, squares[7]?.marked, squares[8]?.marked],
  ];
  let lines = 0;
  // Rows
  for (let r = 0; r < 3; r++) {
    if (grid[r][0] && grid[r][1] && grid[r][2]) lines++;
  }
  // Columns
  for (let c = 0; c < 3; c++) {
    if (grid[0][c] && grid[1][c] && grid[2][c]) lines++;
  }
  // Diagonals
  if (grid[0][0] && grid[1][1] && grid[2][2]) lines++;
  if (grid[0][2] && grid[1][1] && grid[2][0]) lines++;

  const fullHouse = markedCount === 9;
  const total = markedCount + lines * 5 + (fullHouse ? 15 : 0);
  return { squares: markedCount, lines, fullHouse, total };
}
