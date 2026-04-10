import type { Metadata } from "next";
import Nav from "@/components/Nav";
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
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="min-h-dvh flex flex-col bg-dark text-cream">
        <Nav />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-dark-border py-4 text-center text-xs text-cream/40">
          Bragging rights only. No money. Wooden spoon forfeit applies. &middot; London Banter &amp; Woody 2026
        </footer>
      </body>
    </html>
  );
}
