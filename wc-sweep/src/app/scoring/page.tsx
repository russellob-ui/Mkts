export default function ScoringRules() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <h1 className="font-serif text-2xl font-bold text-wc-gold">
        Scoring Rules
      </h1>

      <section className="space-y-3">
        <h2 className="font-semibold text-lg">Match Points</h2>
        <p className="text-sm text-cream/60">
          Points earned per match your team plays. All points are multiplied by
          your team&apos;s tier multiplier.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-cream/50 border-b border-dark-border">
              <th className="text-left py-2">Result</th>
              <th className="text-right py-2">Base Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border/50">
            <tr><td className="py-2">Win</td><td className="text-right">+3</td></tr>
            <tr><td className="py-2">Draw</td><td className="text-right">+1</td></tr>
            <tr><td className="py-2">Loss</td><td className="text-right">0</td></tr>
            <tr><td className="py-2">Clean sheet (in a win)</td><td className="text-right">+1</td></tr>
            <tr><td className="py-2">3+ goals scored</td><td className="text-right">+1</td></tr>
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-lg">Advancement Bonuses</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-cream/50 border-b border-dark-border">
              <th className="text-left py-2">Stage</th>
              <th className="text-right py-2">Base Bonus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border/50">
            <tr><td className="py-2">Qualify from group (top 2)</td><td className="text-right">+5</td></tr>
            <tr><td className="py-2">Qualify as best 3rd</td><td className="text-right">+3</td></tr>
            <tr><td className="py-2">Win Round of 32</td><td className="text-right">+4</td></tr>
            <tr><td className="py-2">Win Round of 16</td><td className="text-right">+6</td></tr>
            <tr><td className="py-2">Win Quarter-final</td><td className="text-right">+8</td></tr>
            <tr><td className="py-2">Win Semi-final</td><td className="text-right">+10</td></tr>
            <tr><td className="py-2">Win Final (Champion!)</td><td className="text-right">+15</td></tr>
            <tr><td className="py-2">Runner-up</td><td className="text-right">+8</td></tr>
            <tr><td className="py-2">Third place</td><td className="text-right">+5</td></tr>
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-lg">Tier Multipliers</h2>
        <p className="text-sm text-cream/60">
          Every point your team earns is multiplied by their tier. Underdogs are
          worth double — a Saudi Arabia goal is worth more than a France goal.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-cream/50 border-b border-dark-border">
              <th className="text-left py-2">Tier</th>
              <th className="text-left py-2">Teams</th>
              <th className="text-right py-2">Multiplier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border/50">
            <tr>
              <td className="py-2 tier-1 font-semibold">Elite</td>
              <td className="py-2 text-cream/60">Hosts + top ranked</td>
              <td className="text-right">x1.0</td>
            </tr>
            <tr>
              <td className="py-2 tier-2 font-semibold">Strong</td>
              <td className="py-2 text-cream/60">Ranked 13-24</td>
              <td className="text-right">x1.25</td>
            </tr>
            <tr>
              <td className="py-2 tier-3 font-semibold">Mid</td>
              <td className="py-2 text-cream/60">Ranked 25-36</td>
              <td className="text-right">x1.5</td>
            </tr>
            <tr>
              <td className="py-2 tier-4 font-semibold">Underdog</td>
              <td className="py-2 text-cream/60">Ranked 37-48</td>
              <td className="text-right">x2.0</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-lg">Prediction Bonuses</h2>
        <p className="text-sm text-cream/60">
          Submit predictions before each match to earn bonus points on top of
          your team&apos;s match points.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-cream/50 border-b border-dark-border">
              <th className="text-left py-2">Prediction</th>
              <th className="text-right py-2">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border/50">
            <tr><td className="py-2">Correct match result (W/D/L)</td><td className="text-right">+2</td></tr>
            <tr><td className="py-2">Exact score</td><td className="text-right">+5</td></tr>
            <tr><td className="py-2">Correct goal difference</td><td className="text-right">+3</td></tr>
            <tr><td className="py-2">First scorer correct</td><td className="text-right">+3</td></tr>
          </tbody>
        </table>
        <div className="bg-dark-card border border-dark-border rounded-lg p-3 space-y-1.5">
          <h4 className="text-sm font-semibold">Confidence Multiplier</h4>
          <p className="text-xs text-cream/50">
            Set a confidence level on each prediction. Higher confidence means bigger rewards
            &mdash; but also a penalty if you&apos;re wrong.
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-cream/40 border-b border-dark-border/50">
                <th className="text-left py-1">Stars</th>
                <th className="text-right py-1">Correct</th>
                <th className="text-right py-1">Wrong Penalty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border/30">
              <tr><td className="py-1 tier-1">1&#9733;</td><td className="text-right">x1.0</td><td className="text-right text-cream/40">0</td></tr>
              <tr><td className="py-1 tier-1">2&#9733;</td><td className="text-right">x1.25</td><td className="text-right text-red-400/70">-1</td></tr>
              <tr><td className="py-1 tier-1">3&#9733;</td><td className="text-right">x1.5</td><td className="text-right text-red-400/70">-2</td></tr>
              <tr><td className="py-1 tier-1">4&#9733;</td><td className="text-right">x1.75</td><td className="text-right text-red-400/70">-3</td></tr>
              <tr><td className="py-1 tier-1">5&#9733;</td><td className="text-right">x2.0</td><td className="text-right text-red-400/70">-4</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-lg">Prop Bets</h2>
        <p className="text-sm text-cream/60">
          Daily prop bets are posted each matchday. Answer before the first
          kick-off of the day.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-cream/50 border-b border-dark-border">
              <th className="text-left py-2">Result</th>
              <th className="text-right py-2">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border/50">
            <tr><td className="py-2">Each correct daily prop</td><td className="text-right">+1</td></tr>
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-lg">Wildcards</h2>
        <p className="text-sm text-cream/60">
          Each player receives a limited number of wildcard tokens. Play a
          wildcard on any match to double the points your team earns in that
          fixture. Wildcards must be played before kick-off and cannot be
          reversed.
        </p>
        <div className="bg-dark-card border border-dark-border rounded-lg p-3">
          <p className="text-sm text-wc-gold font-semibold">
            Double Points
          </p>
          <p className="text-xs text-cream/50 mt-1">
            All match points (win/draw/loss, clean sheet, goal bonuses) are
            multiplied by 2x when a wildcard is active. Tier multipliers
            stack on top.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-lg">Quiz</h2>
        <p className="text-sm text-cream/60">
          A daily quiz with 5 World Cup trivia questions. Available each
          matchday &mdash; complete it before midnight.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-cream/50 border-b border-dark-border">
              <th className="text-left py-2">Result</th>
              <th className="text-right py-2">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-border/50">
            <tr><td className="py-2">Each correct answer</td><td className="text-right">+1</td></tr>
            <tr><td className="py-2">Maximum per quiz (5/5)</td><td className="text-right">+5</td></tr>
          </tbody>
        </table>
      </section>

      <section className="bg-dark-card border border-dark-border rounded-lg p-4 space-y-2">
        <h3 className="font-semibold">Penalty Shootouts</h3>
        <p className="text-sm text-cream/60">
          Treated as a draw (+1 each). The winning team gets the advancement
          bonus. Shootout goals/misses do NOT count for scoring.
        </p>
      </section>
    </div>
  );
}
