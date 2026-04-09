export const PLAYERS = [
  { name: "Ian", slug: "ian", color: "#1e40af", avatarEmoji: "🏌️" },
  { name: "Matt Haigh", slug: "matt-haigh", color: "#9333ea", avatarEmoji: "🏌️" },
  { name: "Paul", slug: "paul", color: "#dc2626", avatarEmoji: "🏌️" },
  { name: "John", slug: "john", color: "#ea580c", avatarEmoji: "🏌️" },
  { name: "James", slug: "james", color: "#ca8a04", avatarEmoji: "🏌️" },
  { name: "Russell", slug: "russell", color: "#16a34a", avatarEmoji: "🏌️" },
  { name: "Woody", slug: "woody", color: "#0891b2", avatarEmoji: "🏌️" },
  { name: "Stuart", slug: "stuart", color: "#be185d", avatarEmoji: "🏌️" },
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
  { playerSlug: "ian", golferName: "Scottie Scheffler", odds: "11/2" },
  { playerSlug: "matt-haigh", golferName: "Jon Rahm", odds: "10/1" },
  { playerSlug: "paul", golferName: "Rory McIlroy", odds: "12/1" },
  { playerSlug: "john", golferName: "Ludvig Åberg", odds: "16/1" },
  { playerSlug: "james", golferName: "Matt Fitzpatrick", odds: "22/1" },
  { playerSlug: "russell", golferName: "Robert MacIntyre", odds: "28/1" },
  { playerSlug: "woody", golferName: "Justin Rose", odds: "30/1" },
  { playerSlug: "stuart", golferName: "Shane Lowry", odds: "66/1" },
] as const;

export const MAJORS_2026 = [
  { name: "The Masters", searchTerms: ["masters"] },
  { name: "PGA Championship", searchTerms: ["pga championship", "pga champ"] },
  { name: "U.S. Open", searchTerms: ["us open", "u.s. open"] },
  { name: "The Open Championship", searchTerms: ["the open", "open championship", "british open"] },
] as const;
