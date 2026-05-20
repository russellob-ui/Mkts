"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/groups", label: "Groups" },
  { href: "/bracket", label: "Bracket" },
  { href: "/draw", label: "Draw" },
  { href: "/predictions", label: "Predictions" },
  { href: "/chat", label: "Chat" },
  { href: "/scoring", label: "Scoring Rules" },
];

const ADMIN_LINK = { href: "/admin", label: "Admin" };

export default function Nav() {
  const [open, setOpen] = useState(false);

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
            className="font-serif text-xl font-bold tracking-tight shrink-0"
            onClick={() => setOpen(false)}
          >
            <span className="text-wc-gold">WC</span>{" "}
            <span className="text-cream">Sweep 2026</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-4 text-sm text-cream/60">
            {NAV_LINKS.filter((l) => l.href !== "/").map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-cream transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={ADMIN_LINK.href}
              className="text-xs text-cream/40 hover:text-cream transition-colors"
            >
              {ADMIN_LINK.label}
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-label="Menu"
            aria-expanded={open}
            className="md:hidden cursor-pointer p-2 hover:bg-dark-border rounded-lg transition-colors relative z-[60]"
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-cream"
            >
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

      {/* Full-screen mobile overlay menu */}
      {open && (
        <div
          className="fixed inset-0 bg-dark z-50 overflow-y-auto md:hidden"
          style={{ backdropFilter: "blur(12px)" }}
        >
          {/* Close bar */}
          <div className="sticky top-0 bg-dark border-b border-dark-border px-4 py-3 flex items-center justify-between">
            <span className="font-serif text-xl font-bold">
              <span className="text-wc-gold">WC</span>{" "}
              <span className="text-cream">Sweep 2026</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
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

          {/* Menu links */}
          <div className="max-w-5xl mx-auto px-4 py-6">
            <div className="space-y-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-3 text-base font-medium text-cream hover:text-wc-gold hover:bg-dark-border/40 rounded-lg transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="mt-8 pt-4 border-t border-dark-border">
              <Link
                href={ADMIN_LINK.href}
                onClick={() => setOpen(false)}
                className="block px-3 py-3 text-sm text-cream/50 hover:text-cream hover:bg-dark-border/40 rounded-lg transition-colors"
              >
                {ADMIN_LINK.label}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
