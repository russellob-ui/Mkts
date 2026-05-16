/**
 * Banter lines — the one-liner strip on the home page.
 *
 * Split into golfer-specific (fire when that golfer is leading/trailing)
 * and generic lines. Generic lines are tournament-aware — no "Amen Corner"
 * at the PGA Championship.
 */

// Golfer-specific banter (works across any tournament)
const GOLFER_BANTER: Array<{
  text: string;
  condition: (leader: string, worst: string) => boolean;
}> = [
  // Masters picks
  { text: "Rory charging \u{1f525}", condition: (l) => l.includes("McIlroy") },
  { text: "Scheffler doing Scheffler things \u{1f916}", condition: (l) => l.includes("Scheffler") },
  { text: "Bobby Mac grinding it out \u{1f3f4}\u{e0067}\u{e0062}\u{e0073}\u{e0063}\u{e0074}\u{e007f}", condition: (l) => l.includes("MacIntyre") },
  { text: "\u{c5}berg showing the Swedes how it's done \u{1f1f8}\u{1f1ea}", condition: (l) => l.includes("berg") },
  // PGA picks
  { text: "Schauffele on a mission \u{1f3af}", condition: (l) => l.includes("Schauffele") },
  { text: "Fleetwood in the zone \u{1f3f4}\u{e0067}\u{e0062}\u{e0065}\u{e006e}\u{e0067}\u{e007f}", condition: (l) => l.includes("Fleetwood") },
  { text: "JT lurking... dangerous \u{1f440}", condition: (l) => l.includes("Thomas") },
  { text: "Potgieter — the wildcard pick paying off \u{1f0cf}", condition: (l) => l.includes("Potgieter") },
  // Trailing banter
  { text: "Stuart sweating \u{1f4a6}", condition: (_, w) => w.includes("McIlroy") },
  { text: "Matt Haigh regretting everything \u{1f62c}", condition: (_, w) => w.includes("berg") },
  { text: "Wooden spoon watch \u{1f944}", condition: () => Math.random() < 0.15 },
];

// Tournament-generic banter (safe for any major)
const GENERIC_BANTER = [
  "WhatsApp going mental right now \u{1f4f1}",
  "Pressure building \u{1f4a5}",
  "Moving day vibes \u{1f525}",
  "The leaderboard is STACKED \u{1f4ca}",
  "Someone's wooden spoon is getting closer \u{1f944}",
  "Form is temporary, class is permanent \u{1f3cc}\u{fe0f}",
  "It's all to play for \u{26f3}",
  "Back nine drama incoming \u{1f3ad}",
  "Nerves of steel required \u{1faa8}",
  "The group chat is cooking \u{1f525}",
];

// Tournament-specific generic banter
const TOURNAMENT_BANTER: Record<string, string[]> = {
  masters: [
    "The green jacket awaits... \u{1f9e5}",
    "Amen Corner incoming \u{26ea}",
    "Azaleas in bloom, pressure on \u{1f338}",
    "Augusta roars echoing \u{1f42f}",
  ],
  pga: [
    "Wanamaker Trophy is calling \u{1f3c6}",
    "Major number two, who wants it most? \u{1f4aa}",
    "PGA Championship — this is where legends are made \u{2b50}",
    "Dark horse territory \u{1f40e}",
  ],
  "us-open": [
    "U.S. Open survival mode activated \u{1f6e1}\u{fe0f}",
    "USGA setup looking brutal today \u{1f480}",
    "Over par is the new under par \u{1f4c8}",
    "Thick rough and fast greens \u{1f33f}",
  ],
  open: [
    "Links golf — expect chaos \u{1f32c}\u{fe0f}",
    "The Claret Jug beckons \u{1f3c6}",
    "Wind picking up, anything could happen \u{1f4a8}",
    "Pot bunkers claiming victims \u{26f3}",
  ],
};

export function getBanterLine(
  leaderGolfer: string,
  worstGolfer: string,
  tournamentSlug?: string
): string {
  // Try golfer-specific lines first
  const matched = GOLFER_BANTER.filter((b) =>
    b.condition(leaderGolfer, worstGolfer)
  );
  if (matched.length > 0) {
    return matched[Math.floor(Math.random() * matched.length)].text;
  }

  // Try tournament-specific generic lines
  const slug = (tournamentSlug ?? "").toLowerCase();
  const tournamentLines =
    TOURNAMENT_BANTER[slug] ??
    (slug.includes("master") ? TOURNAMENT_BANTER.masters :
     slug.includes("pga") ? TOURNAMENT_BANTER.pga :
     slug.includes("open") && slug.includes("u") ? TOURNAMENT_BANTER["us-open"] :
     slug.includes("open") ? TOURNAMENT_BANTER.open :
     []);

  const allGeneric = [...GENERIC_BANTER, ...tournamentLines];
  return allGeneric[Math.floor(Math.random() * allGeneric.length)];
}

export function formatScore(score: number | null): string {
  if (score === null || score === undefined) return "-";
  if (score === 0) return "E";
  if (score > 0) return `+${score}`;
  return String(score);
}

export function scoreColorClass(score: number | null): string {
  if (score === null || score === undefined) return "text-cream/40";
  if (score <= -3) return "text-red-500";
  if (score < 0) return "text-red-400";
  if (score === 0) return "text-gray-400";
  if (score <= 2) return "text-white";
  return "text-gray-500";
}

export function scoreColor(s: number | null): string {
  if (s === null) return "text-cream/30";
  if (s <= -3) return "text-red-500";
  if (s < 0) return "text-red-400";
  if (s === 0) return "text-gray-400";
  if (s <= 2) return "text-white";
  return "text-gray-500";
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
