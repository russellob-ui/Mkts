const BANTER_LINES: Array<{
  text: string;
  condition?: (leader: string, worst: string) => boolean;
}> = [
  {
    text: "Rory charging \u{1f525}",
    condition: (leader) => leader.includes("McIlroy"),
  },
  {
    text: "Rahm in the pine straw \u{1f480}",
    condition: (_, worst) => worst.includes("Rahm"),
  },
  {
    text: "Stuart looking like a genius \u{1f9e0}",
    condition: (leader) => leader.includes("Lowry"),
  },
  {
    text: "Scheffler doing Scheffler things \u{1f916}",
    condition: (leader) => leader.includes("Scheffler"),
  },
  {
    text: "Rose always there, never quite there \u{1fae0}",
    condition: (leader) => leader.includes("Rose"),
  },
  {
    text: "Bobby Mac grinding it out \u{1f3f4}\u{e0067}\u{e0062}\u{e0073}\u{e0063}\u{e0074}\u{e007f}",
    condition: (leader) => leader.includes("MacIntyre"),
  },
  {
    text: "Fitz level, Yorkshire grit required \u{1f610}",
    condition: (leader) => leader.includes("Fitzpatrick"),
  },
  {
    text: "\u{c5}berg showing the Swedes how it's done \u{1f1f8}\u{1f1ea}",
    condition: (leader) => leader.includes("berg"),
  },
  { text: "The green jacket awaits... \u{1f9e5}" },
  { text: "Amen Corner incoming \u{26ea}" },
  { text: "Azaleas in bloom, pressure on \u{1f338}" },
  { text: "WhatsApp going mental right now \u{1f4f1}" },
];

export function getBanterLine(
  leaderGolfer: string,
  worstGolfer: string
): string {
  // Try condition-matched lines first
  const matched = BANTER_LINES.filter(
    (b) => b.condition && b.condition(leaderGolfer, worstGolfer)
  );
  if (matched.length > 0) {
    return matched[Math.floor(Math.random() * matched.length)].text;
  }
  // Fallback to generic
  const generic = BANTER_LINES.filter((b) => !b.condition);
  return generic[Math.floor(Math.random() * generic.length)].text;
}

export function formatScore(score: number | null): string {
  if (score === null || score === undefined) return "-";
  if (score === 0) return "E";
  if (score > 0) return `+${score}`;
  return String(score);
}

export function scoreClass(score: number | null): string {
  if (score === null || score === undefined) return "";
  if (score < 0) return "score-under";
  if (score > 0) return "score-over";
  return "score-even";
}

export function timeAgo(date: string | null): string {
  if (!date) return "never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m ago`;
}
