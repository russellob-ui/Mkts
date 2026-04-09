import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "London Banter & Woody — Major Sweep 2026",
  description:
    "8 friends, 4 majors, 1 champion. Masters, PGA, US Open, The Open.",
};

const NAV_GROUPS = [
  {
    label: "LIVE",
    links: [
      { href: "/leaderboard", label: "Leaderboard" },
      { href: "/banter", label: "Banter" },
      { href: "/trajectory", label: "Trajectory" },
      { href: "/chat", label: "Chat" },
    ],
  },
  {
    label: "THE GAME",
    links: [
      { href: "/predictions", label: "Predictions" },
      { href: "/hot-takes", label: "Hot Takes" },
      { href: "/records", label: "Records" },
    ],
  },
  {
    label: "HEAD TO HEAD",
    links: [
      { href: "/rivalry", label: "Rivalry" },
      { href: "/season", label: "Season" },
      { href: "/season-chart", label: "Season Chart" },
    ],
  },
  {
    label: "THE ARCHIVE",
    links: [
      { href: "/archive", label: "Past Majors" },
      { href: "/yearbook", label: "Yearbook" },
      { href: "/draft", label: "Draft" },
    ],
  },
  {
    label: "ADMIN",
    links: [
      { href: "/admin", label: "Admin" },
      { href: "/commissioner", label: "Commissioner" },
    ],
  },
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
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link
              href="/"
              className="font-serif text-lg font-bold text-augusta-light hover:text-cream transition-colors shrink-0"
            >
              LB&amp;W
            </Link>
            {/* Mobile: hamburger via CSS checkbox hack */}
            <input type="checkbox" id="nav-toggle" className="hidden peer" />
            <label
              htmlFor="nav-toggle"
              className="cursor-pointer p-2 hover:bg-dark-border rounded-lg transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="text-cream/70">
                <rect y="3" width="20" height="2" rx="1" />
                <rect y="9" width="20" height="2" rx="1" />
                <rect y="15" width="20" height="2" rx="1" />
              </svg>
            </label>
            {/* Dropdown menu */}
            <div className="hidden peer-checked:block fixed inset-0 top-14 bg-dark/95 backdrop-blur-md z-50 overflow-y-auto">
              <div className="max-w-5xl mx-auto px-4 py-4">
                {NAV_GROUPS.map((group) => (
                  <div key={group.label} className="mb-4">
                    <div className="text-[10px] uppercase tracking-widest text-cream/30 mb-2 px-2">
                      {group.label}
                    </div>
                    {group.links.map((link) => (
                      <label key={link.href} htmlFor="nav-toggle">
                        <Link
                          href={link.href}
                          className="block px-3 py-2.5 text-sm font-medium text-cream/80 hover:text-cream hover:bg-dark-border/40 rounded-lg transition-colors"
                        >
                          {link.label}
                        </Link>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
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
