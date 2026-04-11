import React from "react";

/**
 * Stylised major-championship logos rendered inline.
 *
 * We can't use the real trademark logos (Augusta, PGA of America, USGA, R&A
 * are famously litigious). These are stylised homages built from text +
 * inline SVG shapes, tuned to each major's signature colourway.
 *
 * Supported:
 *   masters         — Augusta green, italic serif, golf flag
 *   pga             — PGA yellow/red, sans-serif, shield
 *   us-open         — USGA navy, serif, flagpole
 *   the-open        — Claret jug, gold
 *
 * Pass any tournament name (e.g. "Masters Tournament") and we match on a
 * keyword. Falls back to a neutral ⛳ pill if we don't recognise it.
 */
type Props = {
  tournamentName?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

function matchMajor(
  name: string | null | undefined
): "masters" | "pga" | "us-open" | "the-open" | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes("master")) return "masters";
  if (n.includes("pga")) return "pga";
  if (n.includes("u.s. open") || n.includes("us open") || n.includes("u s open"))
    return "us-open";
  if (n.includes("open championship") || n === "the open" || n.includes("british open"))
    return "the-open";
  return null;
}

export default function TournamentLogo({
  tournamentName,
  size = "md",
  className = "",
}: Props) {
  const major = matchMajor(tournamentName);

  const dims = {
    sm: { flag: 16, text: "text-xs", gap: "gap-1" },
    md: { flag: 22, text: "text-base", gap: "gap-1.5" },
    lg: { flag: 30, text: "text-2xl", gap: "gap-2" },
  }[size];

  if (major === "masters") {
    return (
      <span
        className={`inline-flex items-center ${dims.gap} ${className}`}
        aria-label="Masters Tournament"
      >
        {/* Stylised Augusta flag + pin */}
        <svg
          width={dims.flag}
          height={dims.flag}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          {/* Flagpole */}
          <line
            x1="7"
            y1="3"
            x2="7"
            y2="21"
            stroke="#f5f1e8"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          {/* Triangular flag */}
          <path
            d="M7 3 L18 6 L7 9 Z"
            fill="#006747"
            stroke="#006747"
            strokeLinejoin="round"
          />
          {/* Golf ball */}
          <circle cx="7" cy="20" r="1.4" fill="#f5f1e8" />
        </svg>
        <span
          className={`font-serif italic font-bold tracking-tight ${dims.text}`}
          style={{ color: "#006747" }}
        >
          Masters
        </span>
      </span>
    );
  }

  if (major === "pga") {
    return (
      <span
        className={`inline-flex items-center ${dims.gap} ${className}`}
        aria-label="PGA Championship"
      >
        <span
          className={`font-serif font-black tracking-wider px-1.5 py-0.5 rounded`}
          style={{
            background: "#ffd400",
            color: "#1a1a1a",
            fontSize: size === "sm" ? 10 : size === "md" ? 12 : 16,
            letterSpacing: "0.1em",
          }}
        >
          PGA
        </span>
        <span
          className={`font-serif font-bold ${dims.text}`}
          style={{ color: "#ffd400" }}
        >
          Championship
        </span>
      </span>
    );
  }

  if (major === "us-open") {
    return (
      <span
        className={`inline-flex items-center ${dims.gap} ${className}`}
        aria-label="U.S. Open"
      >
        <svg
          width={dims.flag}
          height={dims.flag}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <rect x="2" y="4" width="20" height="16" rx="2" fill="#002868" />
          <text
            x="12"
            y="15"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="9"
            fontWeight="900"
            fontFamily="serif"
          >
            US
          </text>
        </svg>
        <span
          className={`font-serif font-bold ${dims.text}`}
          style={{ color: "#002868" }}
        >
          U.S. Open
        </span>
      </span>
    );
  }

  if (major === "the-open") {
    return (
      <span
        className={`inline-flex items-center ${dims.gap} ${className}`}
        aria-label="The Open Championship"
      >
        {/* Claret jug-ish shape */}
        <svg
          width={dims.flag}
          height={dims.flag}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <path
            d="M9 3h6v3h1.5a1.5 1.5 0 0 1 0 3H15v8a3 3 0 0 1-3 3 3 3 0 0 1-3-3V9H7.5a1.5 1.5 0 0 1 0-3H9V3z"
            fill="#c9a96e"
            stroke="#8a6d3b"
            strokeWidth="0.8"
          />
        </svg>
        <span
          className={`font-serif italic font-bold ${dims.text}`}
          style={{ color: "#c9a96e" }}
        >
          The Open
        </span>
      </span>
    );
  }

  // Generic fallback
  return (
    <span
      className={`inline-flex items-center ${dims.gap} ${className} text-augusta-light`}
    >
      <span aria-hidden>⛳</span>
      <span className={`font-serif font-bold ${dims.text}`}>
        {tournamentName ?? "Tournament"}
      </span>
    </span>
  );
}
