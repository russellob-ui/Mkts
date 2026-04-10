"use client";
import { useState } from "react";
import Link from "next/link";

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

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="border-b border-dark-border bg-dark/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="font-serif text-lg font-bold text-augusta-light hover:text-cream transition-colors shrink-0"
          onClick={() => setOpen(false)}
        >
          LB&amp;W
        </Link>
        <button
          onClick={() => setOpen(!open)}
          aria-label="Menu"
          className="cursor-pointer p-2 hover:bg-dark-border rounded-lg transition-colors"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-cream/70">
            {open ? (
              <path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.42 4.3 19.71 2.89 18.3 9.18 12 2.89 5.71 4.3 4.29 10.59 10.58l6.3-6.29z" />
            ) : (
              <>
                <rect y="4" width="24" height="2" rx="1" />
                <rect y="11" width="24" height="2" rx="1" />
                <rect y="18" width="24" height="2" rx="1" />
              </>
            )}
          </svg>
        </button>
      </div>
      {open && (
        <div
          className="fixed inset-0 top-14 bg-dark/95 backdrop-blur-md z-40 overflow-y-auto"
          onClick={() => setOpen(false)}
        >
          <div className="max-w-5xl mx-auto px-4 py-4" onClick={(e) => e.stopPropagation()}>
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="mb-4">
                <div className="text-[10px] uppercase tracking-widest text-cream/30 mb-2 px-2">
                  {group.label}
                </div>
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2.5 text-sm font-medium text-cream/80 hover:text-cream hover:bg-dark-border/40 rounded-lg transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
