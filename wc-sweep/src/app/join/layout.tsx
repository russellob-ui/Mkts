import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join WC Sweep 2026 ⚽🏆",
  description: "You're invited! Join the FIFA World Cup 2026 sweepstake. 48 teams, random draw, tier multipliers, predictions, banter, bragging rights.",
  openGraph: {
    title: "You're Invited — WC Sweep 2026 ⚽🏆",
    description: "48 teams. Random draw. Tier multipliers. Predictions. Banter. Bragging rights only.",
  },
};

export default function JoinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
