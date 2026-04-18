"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const NAV_GROUPS = [
  {
    label: "LIVE",
    links: [
      { href: "/", label: "Live & Chat" },
      { href: "/full-leaderboard", label: "Full Field" },
      { href: "/banter", label: "Banter" },
      { href: "/trajectory", label: "Trajectory" },
    ],
  },
  {
    label: "MATCHDAY",
    links: [
      { href: "/matchday", label: "Matchday Madness" },
    ],
  },
  {
    label: "THE GAME",
    links: [
      { href: "/predictions", label: "Predictions" },
      { href: "/hot-takes", label: "Hot Takes" },
      { href: "/records", label: "Records" },
      { href: "/scoring", label: "Scoring Rules" },
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
      { href: "/matchday/admin", label: "Matchday Admin" },
    ],
  },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <nav className="border-b border-dark-border bg-dark/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="font-serif text-lg font-bold text-augusta-light hover:text-cream transition-colors shrink-0"
            onClick={() => setOpen(false)}
          >
            LB&amp;W
          </Link>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-label="Menu"
            aria-expanded={open}
            className="cursor-pointer p-2 hover:bg-dark-border rounded-lg transition-colors relative z-[60]"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-cream">
              {open ? (
                <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
              ) : (
                <>
                  <rect y="5" width="24" height="2.5" rx="1" />
                  <rect y="11" width="24" height="2.5" rx="1" />
                  <rect y="17" width="24" height="2.5" rx="1" />
                </>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Full-screen overlay menu — rendered outside nav to avoid stacking issues */}
      {open && (
        <div
          className="fixed inset-0 bg-dark z-50 overflow-y-auto"
          style={{ backdropFilter: "blur(12px)" }}
        >
          {/* Close bar */}
          <div className="sticky top-0 bg-dark border-b border-dark-border px-4 py-3 flex items-center justify-between">
            <span className="font-serif text-lg font-bold text-augusta-light">LB&amp;W</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="p-2 hover:bg-dark-border rounded-lg transition-colors"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-cream">
                <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
              </svg>
            </button>
          </div>

          {/* Menu content */}
          <div className="max-w-5xl mx-auto px-4 py-6">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="mb-6">
                <div className="text-[11px] uppercase tracking-widest text-cream/30 mb-2 px-2 font-bold">
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="block px-3 py-3 text-base font-medium text-cream hover:text-augusta-light hover:bg-dark-border/40 rounded-lg transition-colors"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
