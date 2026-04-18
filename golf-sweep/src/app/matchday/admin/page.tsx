"use client";
import { useState, useEffect } from "react";

interface FixtureResult {
  fixtureId: number;
  date: string;
  venue: string | null;
  homeTeam: string;
  homeLogo: string;
  awayTeam: string;
  awayLogo: string;
  status: string;
  round: string;
}

export default function MatchdayAdminPage() {
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [season, setSeason] = useState("2024");
  const [fixtures, setFixtures] = useState<FixtureResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  const [matchCreated, setMatchCreated] = useState(false);

  // Check if a match already exists
  useEffect(() => {
    fetch("/api/matchday")
      .then((r) => r.json())
      .then((d) => {
        if (d.match) setMatchCreated(true);
      })
      .catch(() => {});
  }, []);

  async function searchFixtures() {
    setSearching(true);
    setMsg("");
    try {
      const res = await fetch(
        `/api/matchday/fixtures?date=${date}&season=${season}`
      );
      const data = await res.json();
      if (data.error) {
        setMsg(data.error);
      } else {
        setFixtures(data.fixtures ?? []);
        if (data.fixtures?.length === 0) setMsg("No fixtures found for that date");
      }
    } catch (err) {
      setMsg(String(err));
    } finally {
      setSearching(false);
    }
  }

  async function createMatch(f: FixtureResult) {
    setCreating(true);
    setMsg("");
    try {
      const res = await fetch("/api/matchday", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fixtureId: f.fixtureId,
          homeTeam: f.homeTeam,
          awayTeam: f.awayTeam,
          venue: f.venue,
          players: [
            { name: "Russell", emoji: "\uD83D\uDC68\u200D\uD83D\uDCBB", color: "#10b981" },
            { name: "Suzie", emoji: "\uD83D\uDC69\u200D\uD83E\uDDB0", color: "#f472b6" },
            { name: "James", emoji: "\u26BD", color: "#3b82f6" },
            { name: "William", emoji: "\uD83C\uDFC6", color: "#f59e0b" },
          ],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg(
          `Match created! Bingo cards generated + blocks drafted. Go to /matchday to play.`
        );
        setMatchCreated(true);
      } else {
        setMsg(data.error || "Failed to create match");
      }
    } catch (err) {
      setMsg(String(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="font-serif text-2xl font-bold mb-2">Matchday Admin</h1>
      <p className="text-cream/50 text-sm mb-6">
        Search for a fixture, tap to create the game. Everything else is automatic — live
        scores, events, lineups, bingo auto-checking, block scoring, and prediction
        settlement all come from the API.
      </p>

      {matchCreated && (
        <div className="bg-augusta/10 border border-augusta/30 rounded-xl p-4 mb-4 text-center">
          <p className="text-augusta-light font-bold">
            Match is set up!
          </p>
          <a
            href="/matchday"
            className="text-sm text-augusta-light underline"
          >
            Go to Matchday Madness &rarr;
          </a>
        </div>
      )}

      {/* Fixture search */}
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 mb-4">
        <h2 className="font-bold mb-3">Find a Fixture</h2>
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <label className="text-xs text-cream/50 block mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="w-24">
            <label className="text-xs text-cream/50 block mb-1">Season</label>
            <select
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-sm"
            >
              <option value="2025">2025-26</option>
              <option value="2024">2024-25</option>
            </select>
          </div>
        </div>
        <button
          onClick={searchFixtures}
          disabled={searching}
          className="w-full bg-augusta hover:bg-augusta-light text-cream font-bold py-3 rounded-lg transition-colors disabled:opacity-40"
        >
          {searching ? "Searching..." : "Search Premier League Fixtures"}
        </button>
      </div>

      {/* Results */}
      {fixtures.length > 0 && (
        <div className="space-y-2 mb-4">
          {fixtures.map((f) => (
            <div
              key={f.fixtureId}
              className="bg-dark-card border border-dark-border rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {f.homeLogo && (
                    <img
                      src={f.homeLogo}
                      alt={f.homeTeam}
                      className="w-6 h-6"
                    />
                  )}
                  <span className="font-bold text-sm">{f.homeTeam}</span>
                  <span className="text-cream/40 text-xs">vs</span>
                  <span className="font-bold text-sm">{f.awayTeam}</span>
                  {f.awayLogo && (
                    <img
                      src={f.awayLogo}
                      alt={f.awayTeam}
                      className="w-6 h-6"
                    />
                  )}
                </div>
              </div>
              <div className="text-xs text-cream/50 mb-2">
                {f.venue} &middot; {f.round} &middot;{" "}
                {new Date(f.date).toLocaleString("en-GB", {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <button
                onClick={() => createMatch(f)}
                disabled={creating || matchCreated}
                className="w-full bg-gold/20 hover:bg-gold/30 text-gold font-bold py-2 rounded-lg text-sm transition-colors disabled:opacity-40"
              >
                {creating
                  ? "Setting up..."
                  : matchCreated
                    ? "Match already created"
                    : "Select This Match"}
              </button>
            </div>
          ))}
        </div>
      )}

      {msg && (
        <p className="text-center text-xs text-cream/60 mt-3">{msg}</p>
      )}

      <div className="mt-8 text-xs text-cream/30 space-y-1">
        <p>
          <strong className="text-cream/50">Data source:</strong> API-Football
          via RapidAPI. Same key as golf. Requires a separate (free) subscription
          to API-Football on RapidAPI.
        </p>
        <p>
          <strong className="text-cream/50">What&apos;s automatic:</strong> live
          score, match events (goals/cards/subs), lineups/team sheets (~1hr before
          KO), corner + card counts, bingo auto-checking, block goal scoring,
          prediction settlement at full time.
        </p>
        <p>
          <strong className="text-cream/50">What you do:</strong> search for the
          fixture here, tap to create. That&apos;s it. Go enjoy the game.
        </p>
      </div>
    </div>
  );
}
