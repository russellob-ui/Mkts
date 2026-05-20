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
