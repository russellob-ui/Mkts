import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "London Banter & Woody — Major Sweep 2026",
  description:
    "8 friends, 4 majors, 1 champion. Masters, PGA, US Open, The Open.",
};

const NAV_LINKS = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/trajectory", label: "Trajectory" },
  { href: "/banter", label: "Banter" },
  { href: "/season", label: "Season" },
  { href: "/season-chart", label: "Chart" },
  { href: "/archive", label: "Archive" },
  { href: "/draft", label: "Draft" },
];

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
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="min-h-dvh flex flex-col bg-dark text-cream">
        <nav className="border-b border-dark-border bg-dark/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 pt-3 pb-0 flex items-center justify-between">
            <Link
              href="/"
              className="font-serif text-lg font-bold text-augusta-light hover:text-cream transition-colors shrink-0"
            >
              LB&amp;W
            </Link>
          </div>
          {/* Horizontal scroll strip */}
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-1 px-4 py-2 max-w-5xl mx-auto min-w-max">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-1.5 text-xs font-medium text-cream/60 hover:text-cream hover:bg-dark-border/40 rounded-full transition-colors whitespace-nowrap"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-dark-border py-4 text-center text-xs text-cream/40">
          Bragging rights only. No money. Wooden spoon forfeit applies. &middot; London Banter &amp; Woody 2026
        </footer>
      </body>
    </html>
  );
}
