import TournamentLogo from "@/components/TournamentLogo";

export const metadata = {
  title: "Scoring Rules — London Banter & Woody",
  description: "How points are awarded for each major.",
};

export default function ScoringPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="font-serif text-2xl md:text-3xl font-bold mb-1">
        Scoring Rules
      </h1>
      <p className="text-cream/50 text-sm mb-6">
        Points are awarded in three flavours per major, plus bonuses over the
        four-major season.
      </p>

      {/* --- Finish position ---------------------------------------- */}
      <section className="bg-dark-card border border-dark-border rounded-xl overflow-hidden mb-5">
        <div className="px-4 py-2.5 border-b border-dark-border flex items-center gap-2">
          <span className="text-lg">🏆</span>
          <h2 className="font-serif font-bold">Finish Position</h2>
          <span className="text-[10px] text-cream/40 uppercase tracking-wider">
            once per tournament
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-cream/40">
              <th className="text-left px-4 py-2">Position</th>
              <th className="text-right px-4 py-2 text-gold">Points</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            <tr className="border-t border-dark-border/40">
              <td className="px-4 py-2 font-bold">Winner</td>
              <td className="text-right px-4 py-2 text-gold font-bold">50</td>
            </tr>
            <tr className="border-t border-dark-border/40">
              <td className="px-4 py-2">2nd</td>
              <td className="text-right px-4 py-2 text-gold">30</td>
            </tr>
            <tr className="border-t border-dark-border/40">
              <td className="px-4 py-2">3rd</td>
              <td className="text-right px-4 py-2 text-gold">20</td>
            </tr>
            <tr className="border-t border-dark-border/40">
              <td className="px-4 py-2">T4 – T5</td>
              <td className="text-right px-4 py-2 text-gold">15</td>
            </tr>
            <tr className="border-t border-dark-border/40">
              <td className="px-4 py-2">T6 – T10</td>
              <td className="text-right px-4 py-2 text-gold">10</td>
            </tr>
            <tr className="border-t border-dark-border/40">
              <td className="px-4 py-2">T11 – T20</td>
              <td className="text-right px-4 py-2 text-gold">6</td>
            </tr>
            <tr className="border-t border-dark-border/40">
              <td className="px-4 py-2">T21 – T30</td>
              <td className="text-right px-4 py-2 text-gold">3</td>
            </tr>
            <tr className="border-t border-dark-border/40">
              <td className="px-4 py-2">Made cut, outside T30</td>
              <td className="text-right px-4 py-2 text-gold">1</td>
            </tr>
            <tr className="border-t border-dark-border/40">
              <td className="px-4 py-2 text-cream/50">Missed cut / WD / DQ</td>
              <td className="text-right px-4 py-2 text-cream/40">0</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* --- Round of the Day --------------------------------------- */}
      <section className="bg-dark-card border border-dark-border rounded-xl overflow-hidden mb-5">
        <div className="px-4 py-2.5 border-b border-dark-border flex items-center gap-2">
          <span className="text-lg">🔥</span>
          <h2 className="font-serif font-bold">Round of the Day</h2>
          <span className="text-[10px] text-cream/40 uppercase tracking-wider">
            +5 per round
          </span>
        </div>
        <div className="px-4 py-3 text-sm text-cream/80 space-y-2">
          <p>
            <span className="text-gold font-bold">+5 points</span> go to the
            player whose golfer shoots the{" "}
            <span className="font-bold">lowest round score</span> of the day
            &mdash; scored against the other 7 picks, not the whole field.
          </p>
          <p className="text-cream/60 text-xs">
            Ties split evenly (two tied = 2.5 each, three tied = 1.67 each).
          </p>
        </div>
      </section>

      {/* --- Best of Round ------------------------------------------ */}
      <section className="bg-dark-card border border-dark-border rounded-xl overflow-hidden mb-5">
        <div className="px-4 py-2.5 border-b border-dark-border flex items-center gap-2">
          <span className="text-lg">👑</span>
          <h2 className="font-serif font-bold">Best of Round</h2>
          <span className="text-[10px] text-cream/40 uppercase tracking-wider">
            +2 per round
          </span>
        </div>
        <div className="px-4 py-3 text-sm text-cream/80 space-y-2">
          <p>
            <span className="text-gold font-bold">+2 points</span> go to whoever
            is <span className="font-bold">leading our 8 on cumulative score</span>{" "}
            at the end of each round.
          </p>
          <p className="text-cream/60 text-xs">Ties split evenly.</p>
        </div>
      </section>

      {/* --- Worked example ----------------------------------------- */}
      <section className="bg-dark-card border border-dark-border rounded-xl overflow-hidden mb-5">
        <div className="px-4 py-2.5 border-b border-dark-border flex items-center gap-2">
          <TournamentLogo tournamentName="Masters Tournament" size="sm" />
          <span className="text-[10px] text-cream/40 uppercase tracking-wider">
            worked example
          </span>
        </div>
        <div className="px-4 py-3 text-sm space-y-3">
          <p className="text-cream/80">
            If your golfer finishes <span className="text-red-400 font-bold">T4</span>{" "}
            at a major, had the <span className="text-red-400 font-bold">lowest R2</span>{" "}
            among our picks, and led our 8 after{" "}
            <span className="text-red-400 font-bold">R2 and R3</span>:
          </p>
          <div className="bg-dark rounded-lg p-3 font-mono text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-cream/60">Finish (T4)</span>
              <span className="text-gold font-bold">15</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cream/60">Round of Day &times; 1</span>
              <span className="text-gold font-bold">5</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cream/60">Best of Round &times; 2</span>
              <span className="text-gold font-bold">4</span>
            </div>
            <div className="flex justify-between border-t border-dark-border pt-1 mt-1">
              <span className="text-cream font-bold">Total</span>
              <span className="text-gold font-black text-base">24</span>
            </div>
          </div>
        </div>
      </section>

      {/* --- Fine print --------------------------------------------- */}
      <section className="text-xs text-cream/40 space-y-2 px-1">
        <p>
          <span className="text-cream/60 font-bold">When:</span> finish points
          settle when the tournament goes &ldquo;Official&rdquo;; round bonuses
          settle when each round goes &ldquo;Complete&rdquo; or
          &ldquo;Official&rdquo;. All of this now runs automatically from the
          Slash Golf live feed &mdash; no admin intervention needed.
        </p>
        <p>
          <span className="text-cream/60 font-bold">Idempotent:</span> re-running
          settlement is safe &mdash; nobody gets double-paid.
        </p>
        <p>
          <span className="text-cream/60 font-bold">Season:</span> points carry
          across all four majors. Wooden-spoon forfeit applies to whoever
          finishes the season at the bottom.
        </p>
      </section>
    </div>
  );
}
