import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "World Cup Sweep 2026",
  description: "Friends. Teams. Glory. FIFA World Cup 2026 sweepstake.",
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
        <header className="border-b border-dark-border px-4 py-3 flex items-center justify-between">
          <a href="/" className="font-serif text-xl font-bold tracking-tight">
            <span className="text-wc-gold">WC</span> Sweep 2026
          </a>
          <nav className="flex gap-4 text-sm text-cream/60">
            <a href="/groups" className="hover:text-cream">Groups</a>
            <a href="/draw" className="hover:text-cream">Draw</a>
            <a href="/scoring" className="hover:text-cream">Rules</a>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-dark-border py-4 text-center text-xs text-cream/40">
          World Cup Sweep 2026 &middot; Bragging rights only
        </footer>
      </body>
    </html>
  );
}
