export const PLAYERS = [
  { name: "Ian", slug: "ian", color: "#1e40af", rowColor: "bg-blue-900/15", avatarEmoji: "🏌️" },
  { name: "Matt Haigh", slug: "matt-haigh", color: "#9333ea", rowColor: "bg-purple-900/15", avatarEmoji: "🏌️" },
  { name: "Paul", slug: "paul", color: "#dc2626", rowColor: "bg-red-900/15", avatarEmoji: "🏌️" },
  { name: "John", slug: "john", color: "#ea580c", rowColor: "bg-orange-900/15", avatarEmoji: "🏌️" },
  { name: "James", slug: "james", color: "#ca8a04", rowColor: "bg-yellow-900/15", avatarEmoji: "🏌️" },
  { name: "Russell", slug: "russell", color: "#16a34a", rowColor: "bg-green-900/15", avatarEmoji: "🏌️" },
  { name: "Woody", slug: "woody", color: "#0891b2", rowColor: "bg-cyan-900/15", avatarEmoji: "🏌️" },
  { name: "Stuart", slug: "stuart", color: "#be185d", rowColor: "bg-pink-900/15", avatarEmoji: "🏌️" },
] as const;

export const GOLFERS = [
  { name: "Scottie Scheffler", country: "USA", flagEmoji: "🇺🇸" },
  { name: "Jon Rahm", country: "Spain", flagEmoji: "🇪🇸" },
  { name: "Rory McIlroy", country: "Northern Ireland", flagEmoji: "🇬🇧" },
  { name: "Ludvig Åberg", country: "Sweden", flagEmoji: "🇸🇪" },
  { name: "Matt Fitzpatrick", country: "England", flagEmoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "Robert MacIntyre", country: "Scotland", flagEmoji: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { name: "Justin Rose", country: "England", flagEmoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "Shane Lowry", country: "Ireland", flagEmoji: "🇮🇪" },
] as const;

export const PICKS = [
  { playerSlug: "ian", golferName: "Scottie Scheffler", odds: "11/2", oddsDecimal: 6.5 },
  { playerSlug: "matt-haigh", golferName: "Jon Rahm", odds: "10/1", oddsDecimal: 11.0 },
  { playerSlug: "paul", golferName: "Rory McIlroy", odds: "12/1", oddsDecimal: 13.0 },
  { playerSlug: "john", golferName: "Ludvig Åberg", odds: "16/1", oddsDecimal: 17.0 },
  { playerSlug: "james", golferName: "Matt Fitzpatrick", odds: "22/1", oddsDecimal: 23.0 },
  { playerSlug: "russell", golferName: "Robert MacIntyre", odds: "28/1", oddsDecimal: 29.0 },
  { playerSlug: "woody", golferName: "Justin Rose", odds: "30/1", oddsDecimal: 31.0 },
  { playerSlug: "stuart", golferName: "Shane Lowry", odds: "66/1", oddsDecimal: 67.0 },
] as const;

export const TOURNAMENTS = [
  {
    name: "The Masters",
    slug: "masters",
    startDate: "2026-04-09",
    endDate: "2026-04-12",
    status: "live" as const,
    oddsApiSportKey: "golf_masters_tournament_winner",
  },
  {
    name: "PGA Championship",
    slug: "pga",
    startDate: "2026-05-14",
    endDate: "2026-05-17",
    status: "upcoming" as const,
    oddsApiSportKey: "golf_pga_championship_winner",
  },
  {
    name: "U.S. Open",
    slug: "us-open",
    startDate: "2026-06-18",
    endDate: "2026-06-21",
    status: "upcoming" as const,
    oddsApiSportKey: "golf_us_open_winner",
  },
  {
    name: "The Open Championship",
    slug: "open",
    startDate: "2026-07-16",
    endDate: "2026-07-19",
    status: "upcoming" as const,
    oddsApiSportKey: "golf_the_open_championship_winner",
  },
] as const;
