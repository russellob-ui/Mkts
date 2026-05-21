import type { Metadata } from "next";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "WC Sweep 2026 ⚽🏆",
  description: "Friends. Teams. Glory. Join the FIFA World Cup 2026 sweepstake — pick your teams, predict matches, win bragging rights.",
  openGraph: {
    type: "website",
    title: "WC Sweep 2026 ⚽🏆",
    description: "Join the FIFA World Cup 2026 sweepstake. Pick teams. Predict matches. Win bragging rights.",
    siteName: "WC Sweep 2026",
  },
  twitter: {
    card: "summary_large_image",
    title: "WC Sweep 2026 ⚽🏆",
    description: "Join the FIFA World Cup 2026 sweepstake. Pick teams. Predict matches. Win bragging rights.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </head>
      <body className="min-h-dvh flex flex-col bg-dark text-cream">
        <Nav />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-dark-border py-4 text-center text-xs text-cream/40">
          World Cup Sweep 2026 &middot; Bragging rights only
        </footer>
      </body>
    </html>
  );
}
