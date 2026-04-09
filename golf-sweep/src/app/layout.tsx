import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "London Banter & Woody — Major Sweep 2026",
  description:
    "8 friends, 4 majors, 1 champion. Masters, PGA, US Open, The Open.",
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
      </head>
      <body className="min-h-dvh flex flex-col bg-dark text-cream">
        <nav className="border-b border-dark-border bg-dark/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link
              href="/"
              className="font-serif text-lg font-bold text-augusta-light hover:text-cream transition-colors"
            >
              LB&amp;W
            </Link>
            <div className="flex gap-4 text-sm">
              <Link
                href="/leaderboard"
                className="hover:text-augusta-light transition-colors"
              >
                Leaderboard
              </Link>
              <Link
                href="/season"
                className="hover:text-augusta-light transition-colors"
              >
                Season
              </Link>
            </div>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-dark-border py-4 text-center text-xs text-cream/40">
          London Banter &amp; Woody &middot; Major Sweep 2026
        </footer>
      </body>
    </html>
  );
}
