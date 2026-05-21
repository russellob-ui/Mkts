"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const NAV_SECTIONS = [
  {
    label: "Live",
    links: [
      { href: "/", label: "Home" },
      { href: "/schedule", label: "Schedule" },
      { href: "/groups", label: "Groups" },
      { href: "/bracket", label: "Bracket" },
      { href: "/golden-boot", label: "Golden Boot" },
      { href: "/elimination", label: "Elimination" },
    ],
  },
  {
    label: "Play",
    links: [
      { href: "/predictions", label: "Predictions" },
      { href: "/props", label: "Props" },
      { href: "/wildcards", label: "Wildcards" },
      { href: "/trades", label: "Trades" },
      { href: "/chat", label: "Chat" },
      { href: "/quiz", label: "Quiz" },
      { href: "/bingo", label: "Bingo" },
      { href: "/streaks", label: "Streaks" },
    ],
  },
  {
    label: "Social",
    links: [
      { href: "/my-day", label: "My Day" },
      { href: "/digest", label: "Digest" },
      { href: "/rivalry", label: "Rivalry" },
      { href: "/trash-talk", label: "Trash Talk" },
      { href: "/achievements", label: "Achievements" },
      { href: "/superlatives", label: "Superlatives" },
      { href: "/stats", label: "Stats" },
    ],
  },
  {
    label: "Data",
    links: [
      { href: "/what-if", label: "What If" },
      { href: "/expected-points", label: "xPts" },
      { href: "/form", label: "Form" },
    ],
  },
  {
    label: "End",
    links: [
      { href: "/yearbook", label: "Yearbook" },
      { href: "/share", label: "Share Card" },
      { href: "/forfeit", label: "Forfeit Wheel" },
      { href: "/scoring", label: "Scoring Rules" },
    ],
  },
];

const JOIN_LINK = { href: "/join", label: "Join" };

function DesktopDropdown({
  section,
}: {
  section: (typeof NAV_SECTIONS)[number];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        onMouseEnter={() => setOpen(true)}
        className={`text-sm px-2 py-1 rounded transition-colors cursor-pointer ${
          open ? "text-wc-gold" : "text-cream/60 hover:text-cream"
        }`}
      >
        {section.label}
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 bg-dark-card border border-dark-border rounded-lg shadow-xl py-1 min-w-[160px] z-50"
          onMouseLeave={() => setOpen(false)}
        >
          {section.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-cream/70 hover:text-cream hover:bg-dark-border/40 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <nav className="border-b border-dark-border bg-dark/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="font-serif text-xl font-bold tracking-tight shrink-0"
            onClick={() => setMobileOpen(false)}
          >
            <span className="text-wc-gold">WC</span>{" "}
            <span className="text-cream">Sweep 2026</span>
          </Link>

          {/* Desktop: section dropdowns */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_SECTIONS.map((section) => (
              <DesktopDropdown key={section.label} section={section} />
            ))}
            <Link
              href={JOIN_LINK.href}
              className="text-xs text-cream/40 hover:text-cream transition-colors ml-2 px-2 py-1"
            >
              {JOIN_LINK.label}
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
            className="md:hidden cursor-pointer p-2 hover:bg-dark-border rounded-lg transition-colors relative z-[60]"
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-cream"
            >
              {mobileOpen ? (
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

      {/* Full-screen mobile overlay menu */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-dark z-50 overflow-y-auto md:hidden"
          style={{ backdropFilter: "blur(12px)" }}
        >
          <div className="sticky top-0 bg-dark border-b border-dark-border px-4 py-3 flex items-center justify-between">
            <span className="font-serif text-xl font-bold">
              <span className="text-wc-gold">WC</span>{" "}
              <span className="text-cream">Sweep 2026</span>
            </span>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="p-2 hover:bg-dark-border rounded-lg transition-colors"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-cream"
              >
                <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
              </svg>
            </button>
          </div>

          <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
            {NAV_SECTIONS.map((section) => (
              <div key={section.label}>
                <div className="text-xs font-semibold text-cream/30 uppercase tracking-wider px-3 mb-1">
                  {section.label}
                </div>
                <div className="space-y-0.5">
                  {section.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="block px-3 py-3 text-base font-medium text-cream hover:text-wc-gold hover:bg-dark-border/40 rounded-lg transition-colors"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            <div className="pt-4 border-t border-dark-border">
              <Link
                href={JOIN_LINK.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-3 text-sm text-cream/50 hover:text-cream hover:bg-dark-border/40 rounded-lg transition-colors"
              >
                {JOIN_LINK.label}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
