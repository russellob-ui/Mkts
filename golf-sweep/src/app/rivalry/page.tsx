"use client";

import { useEffect, useState } from "react";

interface Player {
  id: number;
  name: string;
  slug: string;
  avatarEmoji: string | null;
  color: string | null;
}

interface MajorMatchup {
  tournament: string;
  playerAPoints: number;
  playerBPoints: number;
  winner: string | null;
}

interface RivalryData {
  playerA: Player;
  playerB: Player;
  seasonPointsA: number;
  seasonPointsB: number;
  headToHead: MajorMatchup[];
  winsA: number;
  winsB: number;
  predictionAccuracyA: number;
  predictionAccuracyB: number;
  hotTakeAccuracyA: number;
  hotTakeAccuracyB: number;
  banterMentions: number;
  rivalryIntensity: number;
}

function fireEmojis(intensity: number): string {
  return Array(Math.max(1, Math.min(5, intensity)))
    .fill("\u{1f525}")
    .join("");
}

function PercentBar({
  a,
  b,
  colorA,
  colorB,
}: {
  a: number;
  b: number;
  colorA: string;
  colorB: string;
}) {
  const total = a + b;
  if (total === 0) return null;
  const pctA = Math.round((a / total) * 100);
  const pctB = 100 - pctA;

  return (
    <div className="flex h-6 rounded-lg overflow-hidden border border-dark-border">
      <div
        className="flex items-center justify-center text-xs font-bold text-cream transition-all"
        style={{
          width: `${pctA}%`,
          backgroundColor: colorA,
          minWidth: pctA > 0 ? "2rem" : "0",
        }}
      >
        {pctA > 10 ? `${pctA}%` : ""}
      </div>
      <div
        className="flex items-center justify-center text-xs font-bold text-cream transition-all"
        style={{
          width: `${pctB}%`,
          backgroundColor: colorB,
          minWidth: pctB > 0 ? "2rem" : "0",
        }}
      >
        {pctB > 10 ? `${pctB}%` : ""}
      </div>
    </div>
  );
}

export default function RivalryPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerA, setPlayerA] = useState("");
  const [playerB, setPlayerB] = useState("");
  const [rivalry, setRivalry] = useState<RivalryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    fetch("/api/season")
      .then((r) => r.json())
      .then((d) => {
        if (d.standings) {
          setPlayers(d.standings.map((s: { player: Player }) => s.player));
        }
        setInitialLoading(false);
      })
      .catch(() => setInitialLoading(false));
  }, []);

  useEffect(() => {
    if (!playerA || !playerB || playerA === playerB) {
      setRivalry(null);
      return;
    }
    setLoading(true);
    fetch(`/api/rivalry?playerA=${playerA}&playerB=${playerB}`)
      .then((r) => r.json())
      .then((d) => {
        setRivalry(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [playerA, playerB]);

  if (initialLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center text-cream/40">
        Loading...
      </div>
    );
  }

  const colorA = rivalry?.playerA?.color ?? "#006747";
  const colorB = rivalry?.playerB?.color ?? "#c9a44a";

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="font-serif text-2xl md:text-3xl font-bold mb-2">
        Rivalry View
      </h1>
      <p className="text-cream/50 text-sm mb-6">
        Head-to-head comparison. Select two players.
      </p>

      {/* Player dropdowns */}
      <div className="flex gap-3 mb-6">
        <select
          value={playerA}
          onChange={(e) => setPlayerA(e.target.value)}
          className="flex-1 bg-dark-card border border-dark-border rounded-lg px-4 py-2.5 text-cream focus:outline-none focus:border-augusta"
        >
          <option value="">Player A</option>
          {players.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.avatarEmoji ?? ""} {p.name}
            </option>
          ))}
        </select>

        <span className="flex items-center text-cream/30 font-bold">vs</span>

        <select
          value={playerB}
          onChange={(e) => setPlayerB(e.target.value)}
          className="flex-1 bg-dark-card border border-dark-border rounded-lg px-4 py-2.5 text-cream focus:outline-none focus:border-augusta"
        >
          <option value="">Player B</option>
          {players.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.avatarEmoji ?? ""} {p.name}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="text-center text-cream/40 py-8">Loading rivalry...</div>
      )}

      {!rivalry && !loading && playerA && playerB && playerA !== playerB && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center text-cream/40">
          No rivalry data found for these players.
        </div>
      )}

      {(!playerA || !playerB) && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center text-cream/40">
          Select two different players to view their rivalry.
        </div>
      )}

      {rivalry && (
        <div className="space-y-6">
          {/* Names header */}
          <div className="flex items-center justify-between bg-dark-card border border-dark-border rounded-xl p-5">
            <div className="text-center flex-1">
              <div
                className="w-4 h-4 rounded-full mx-auto mb-1"
                style={{ backgroundColor: colorA }}
              />
              <div className="font-bold text-lg">
                {rivalry.playerA.avatarEmoji ?? ""} {rivalry.playerA.name}
              </div>
            </div>
            <div className="px-4 text-center">
              <span className="text-2xl">{"\u2694\uFE0F"}</span>
              {rivalry.rivalryIntensity > 0 && (
                <div className="text-sm mt-1">
                  {fireEmojis(rivalry.rivalryIntensity)}
                </div>
              )}
            </div>
            <div className="text-center flex-1">
              <div
                className="w-4 h-4 rounded-full mx-auto mb-1"
                style={{ backgroundColor: colorB }}
              />
              <div className="font-bold text-lg">
                {rivalry.playerB.avatarEmoji ?? ""} {rivalry.playerB.name}
              </div>
            </div>
          </div>

          {/* Season points comparison */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-5">
            <h3 className="font-serif font-bold text-sm text-cream/60 mb-3">
              Season Points
            </h3>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gold font-bold text-lg font-mono">
                {rivalry.seasonPointsA}
              </span>
              <span className="text-gold font-bold text-lg font-mono">
                {rivalry.seasonPointsB}
              </span>
            </div>
            <PercentBar
              a={rivalry.seasonPointsA}
              b={rivalry.seasonPointsB}
              colorA={colorA}
              colorB={colorB}
            />
          </div>

          {/* Head-to-head per major */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-5">
            <h3 className="font-serif font-bold text-sm text-cream/60 mb-3">
              Head-to-Head by Major
            </h3>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm">
                Wins:{" "}
                <span className="font-bold text-gold">{rivalry.winsA}</span>
              </span>
              <span className="text-sm">
                Wins:{" "}
                <span className="font-bold text-gold">{rivalry.winsB}</span>
              </span>
            </div>
            <div className="space-y-3">
              {rivalry.headToHead.map((h) => (
                <div key={h.tournament}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-cream/50">
                      {h.tournament}
                    </span>
                    <div className="flex gap-4 text-sm">
                      <span
                        className={`font-mono font-bold ${
                          h.winner === "A" ? "text-gold" : "text-cream/40"
                        }`}
                      >
                        {h.playerAPoints}
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          h.winner === "B" ? "text-gold" : "text-cream/40"
                        }`}
                      >
                        {h.playerBPoints}
                      </span>
                    </div>
                  </div>
                  <PercentBar
                    a={h.playerAPoints}
                    b={h.playerBPoints}
                    colorA={colorA}
                    colorB={colorB}
                  />
                </div>
              ))}
              {rivalry.headToHead.length === 0 && (
                <div className="text-center text-cream/30 text-sm py-2">
                  No head-to-head data yet.
                </div>
              )}
            </div>
          </div>

          {/* Prediction accuracy */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-5">
            <h3 className="font-serif font-bold text-sm text-cream/60 mb-3">
              Prediction Accuracy
            </h3>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-sm">
                {rivalry.predictionAccuracyA}%
              </span>
              <span className="font-mono text-sm">
                {rivalry.predictionAccuracyB}%
              </span>
            </div>
            <PercentBar
              a={rivalry.predictionAccuracyA}
              b={rivalry.predictionAccuracyB}
              colorA={colorA}
              colorB={colorB}
            />
          </div>

          {/* Hot take accuracy */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-5">
            <h3 className="font-serif font-bold text-sm text-cream/60 mb-3">
              Hot Take Accuracy
            </h3>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-sm">
                {rivalry.hotTakeAccuracyA}%
              </span>
              <span className="font-mono text-sm">
                {rivalry.hotTakeAccuracyB}%
              </span>
            </div>
            <PercentBar
              a={rivalry.hotTakeAccuracyA}
              b={rivalry.hotTakeAccuracyB}
              colorA={colorA}
              colorB={colorB}
            />
          </div>

          {/* Banter mentions */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-5 text-center">
            <h3 className="font-serif font-bold text-sm text-cream/60 mb-2">
              Banter Mentions Together
            </h3>
            <div className="text-3xl font-bold text-gold font-mono">
              {rivalry.banterMentions}
            </div>
          </div>

          {/* Rivalry intensity */}
          <div className="bg-dark-card border border-dark-border rounded-xl p-5 text-center">
            <h3 className="font-serif font-bold text-sm text-cream/60 mb-2">
              Rivalry Intensity
            </h3>
            <div className="text-4xl">
              {fireEmojis(rivalry.rivalryIntensity)}
            </div>
            <div className="text-xs text-cream/40 mt-1">
              {rivalry.rivalryIntensity}/5
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
