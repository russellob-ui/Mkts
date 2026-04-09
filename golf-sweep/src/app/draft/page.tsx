"use client";

export default function DraftPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="font-serif text-2xl md:text-3xl font-bold mb-6">
        Snake Draft
      </h1>

      <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center">
        <div className="text-4xl mb-4">🐍</div>
        <h2 className="font-serif text-xl font-bold mb-2">
          Draft Not Active
        </h2>
        <p className="text-cream/60 mb-4">
          The snake draft will open <strong>24 hours before the PGA Championship</strong> on{" "}
          <span className="text-augusta-light font-bold">13 May 2026</span>.
        </p>
        <p className="text-cream/40 text-sm mb-6">
          Draft order = reverse of current season standings. Whoever is last picks first.
          Each player picks one golfer — no duplicates allowed.
        </p>

        <div className="bg-dark rounded-lg p-4 text-left max-w-md mx-auto">
          <h3 className="font-bold text-sm text-cream/60 mb-3">Upcoming Drafts</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>PGA Championship</span>
              <span className="text-cream/40">13 May 2026</span>
            </div>
            <div className="flex justify-between">
              <span>U.S. Open</span>
              <span className="text-cream/40">17 Jun 2026</span>
            </div>
            <div className="flex justify-between">
              <span>The Open Championship</span>
              <span className="text-cream/40">15 Jul 2026</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-dark-card border border-dark-border rounded-xl p-4">
        <h3 className="font-serif text-sm font-bold mb-2 text-cream/60">How the Snake Draft Works</h3>
        <ol className="text-sm text-cream/50 space-y-1 list-decimal list-inside">
          <li>Draft order is reverse of season standings (last place picks first)</li>
          <li>Each player picks one golfer for the major</li>
          <li>No two players can pick the same golfer</li>
          <li>You have 4 hours to make your pick when it&apos;s your turn</li>
          <li>If you don&apos;t pick in time, auto-pick selects the highest-odds golfer available</li>
        </ol>
      </div>
    </div>
  );
}
