"use client";
import { useEffect, useState } from "react";

type Tab = "predictions" | "bingo" | "blocks";
type MatchStatus = "upcoming" | "live" | "finished";

interface MatchState {
  match: {
    id: number;
    homeTeam: string;
    awayTeam: string;
    venue: string | null;
    status: MatchStatus;
    finalHomeScore: number | null;
    finalAwayScore: number | null;
    totalCorners: number | null;
    totalCards: number | null;
    currentMinute: number | null;
  } | null;
  players: Array<{ id: number; name: string; emoji: string; color: string }>;
  predictions: Array<{
    playerId: number;
    predictedHomeScore: number | null;
    predictedAwayScore: number | null;
    firstScorer: string | null;
    firstGoalMinute: number | null;
    totalCorners: number | null;
    totalCards: number | null;
  }>;
  bingoCards: Array<{
    playerId: number;
    squares: Array<{ key: string; text: string; marked: boolean }>;
  }>;
  blocks: Array<{
    playerId: number;
    label: string;
    start: number;
    end: number;
  }>;
  events: Array<{
    id: number;
    type: string;
    minute: number;
    detail: string | null;
    team: string | null;
  }>;
  scores: Array<{
    playerId: number;
    playerName: string;
    playerEmoji: string;
    playerColor: string;
    predictionPoints: number;
    bingoPoints: number;
    bingoSquaresMarked: number;
    bingoLines: number;
    bingoFullHouse: boolean;
    blockGoals: number;
    blockPoints: number;
    totalPoints: number;
  }>;
}

const EVENT_EMOJI: Record<string, string> = {
  goal: "\u26BD",
  corner: "\uD83D\uDEA9",
  yellow_card: "\uD83D\uDFE8",
  red_card: "\uD83D\uDFE5",
  var: "\uD83D\uDCFA",
  penalty: "\u26BD\u26A0\uFE0F",
  sub: "\uD83D\uDD04",
  woodwork: "\uD83E\uDE93",
  other: "\u2139\uFE0F",
};

function fmtScore(s: number | null): string {
  return s != null ? String(s) : "-";
}

export default function MatchdayPage() {
  const [data, setData] = useState<MatchState | null>(null);
  const [tab, setTab] = useState<Tab>("predictions");
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Prediction form
  const [predHome, setPredHome] = useState(0);
  const [predAway, setPredAway] = useState(0);
  const [predScorer, setPredScorer] = useState("");
  const [predMinute, setPredMinute] = useState(30);
  const [predCorners, setPredCorners] = useState(8);
  const [predCards, setPredCards] = useState(3);
  const [submitMsg, setSubmitMsg] = useState("");

  async function fetchData() {
    const res = await fetch("/api/matchday");
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 10_000);
    return () => clearInterval(iv);
  }, []);

  async function submitPrediction() {
    if (!data?.match || !selectedPlayer) return;
    setSubmitMsg("");
    const res = await fetch("/api/matchday/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: data.match.id,
        playerId: selectedPlayer,
        predictedHomeScore: predHome,
        predictedAwayScore: predAway,
        firstScorer: predScorer || null,
        firstGoalMinute: predMinute,
        totalCorners: predCorners,
        totalCards: predCards,
      }),
    });
    if (res.ok) {
      setSubmitMsg("Prediction locked in!");
      fetchData();
    } else {
      const j = await res.json().catch(() => ({}));
      setSubmitMsg(j.error || "Failed");
    }
  }

  async function toggleBingo(squareKey: string) {
    if (!data?.match || !selectedPlayer) return;
    await fetch("/api/matchday/bingo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: data.match.id,
        playerId: selectedPlayer,
        squareKey,
      }),
    });
    fetchData();
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center text-cream/40">
        Loading Matchday Madness...
      </div>
    );
  }

  if (!data?.match) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <h1 className="font-serif text-2xl font-bold mb-4">
          Matchday Madness
        </h1>
        <p className="text-cream/50">
          No match set up yet. Ask Russell to create one in{" "}
          <a href="/matchday/admin" className="text-augusta-light underline">
            admin
          </a>
          .
        </p>
      </div>
    );
  }

  const match = data.match;
  const isUpcoming = match.status === "upcoming";
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";

  const tabs: { key: Tab; label: string; emoji: string }[] = [
    { key: "predictions", label: "Predict", emoji: "\uD83C\uDFAF" },
    { key: "bingo", label: "Bingo", emoji: "\uD83C\uDFB0" },
    { key: "blocks", label: "Blocks", emoji: "\u23F1\uFE0F" },
  ];

  const myPred = data.predictions.find((p) => p.playerId === selectedPlayer);
  const myBingo = data.bingoCards.find((b) => b.playerId === selectedPlayer);
  const myBlocks = data.blocks.filter((b) => b.playerId === selectedPlayer);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Match Header */}
      <div className="text-center mb-4">
        <div className="text-xs uppercase tracking-widest text-cream/40 font-bold mb-1">
          Matchday Madness
        </div>
        <h1 className="font-serif text-xl md:text-2xl font-bold">
          {match.homeTeam}{" "}
          {isLive || isFinished ? (
            <span className="text-gold">
              {fmtScore(match.finalHomeScore)} – {fmtScore(match.finalAwayScore)}
            </span>
          ) : (
            <span className="text-cream/40">vs</span>
          )}{" "}
          {match.awayTeam}
        </h1>
        <div className="flex items-center justify-center gap-2 mt-1">
          {match.venue && (
            <span className="text-xs text-cream/50">{match.venue}</span>
          )}
          {isUpcoming && (
            <span className="text-[10px] bg-cream/10 text-cream/60 px-2 py-0.5 rounded-full uppercase">
              Pre-Match
            </span>
          )}
          {isLive && (
            <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full uppercase font-bold animate-pulse">
              Live {match.currentMinute ? `· ${match.currentMinute}'` : ""}
            </span>
          )}
          {isFinished && (
            <span className="text-[10px] bg-gold/20 text-gold px-2 py-0.5 rounded-full uppercase font-bold">
              Full Time
            </span>
          )}
        </div>
      </div>

      {/* Player Selector */}
      <div className="mb-4">
        <div className="flex gap-2 justify-center">
          {data.players.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPlayer(p.id)}
              className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${
                selectedPlayer === p.id
                  ? "ring-2 ring-gold scale-105"
                  : "opacity-60 hover:opacity-100"
              }`}
              style={{
                backgroundColor: `${p.color}30`,
                borderBottom: `3px solid ${p.color}`,
              }}
            >
              {p.emoji} {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Strip */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden mb-4">
        <div className="flex items-center px-3 py-1.5 text-[9px] text-cream/40 uppercase tracking-wider border-b border-dark-border">
          <span className="flex-1">Player</span>
          <span className="w-10 text-center">Pred</span>
          <span className="w-10 text-center">Bingo</span>
          <span className="w-10 text-center">Block</span>
          <span className="w-12 text-center text-gold font-bold">Total</span>
        </div>
        {data.scores.map((s, i) => (
          <div
            key={s.playerId}
            className="flex items-center px-3 py-2 text-xs border-b border-dark-border/30 last:border-0"
            style={{ borderLeft: `3px solid ${s.playerColor}` }}
          >
            <span className="flex-1 font-bold">
              {i === 0 && isFinished ? "\uD83C\uDFC6 " : ""}
              {s.playerEmoji} {s.playerName}
            </span>
            <span className="w-10 text-center text-cream/60 font-mono">
              {s.predictionPoints || "-"}
            </span>
            <span className="w-10 text-center text-cream/60 font-mono">
              {s.bingoPoints || "-"}
            </span>
            <span className="w-10 text-center text-cream/60 font-mono">
              {s.blockPoints || "-"}
            </span>
            <span className="w-12 text-center text-gold font-bold font-mono">
              {s.totalPoints || "-"}
            </span>
          </div>
        ))}
      </div>

      {/* Game Tabs */}
      <div className="flex gap-1 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
              tab === t.key
                ? "bg-augusta text-cream"
                : "bg-dark-card text-cream/60 hover:bg-dark-border"
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* PREDICTIONS TAB */}
      {tab === "predictions" && (
        <div className="space-y-3">
          {isUpcoming && selectedPlayer ? (
            <div className="bg-dark-card border border-dark-border rounded-xl p-4">
              <h3 className="font-serif font-bold mb-3">Your Prediction</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-cream/50 block mb-1">Final Score</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-20 truncate">{match.homeTeam}</span>
                    <input
                      type="number"
                      min={0}
                      value={predHome}
                      onChange={(e) => setPredHome(Number(e.target.value))}
                      className="w-14 bg-dark border border-dark-border rounded px-2 py-1.5 text-center font-mono text-lg"
                    />
                    <span className="text-cream/40">–</span>
                    <input
                      type="number"
                      min={0}
                      value={predAway}
                      onChange={(e) => setPredAway(Number(e.target.value))}
                      className="w-14 bg-dark border border-dark-border rounded px-2 py-1.5 text-center font-mono text-lg"
                    />
                    <span className="text-xs w-20 truncate text-right">{match.awayTeam}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-cream/50 block mb-1">First Goalscorer</label>
                  <input
                    type="text"
                    value={predScorer}
                    onChange={(e) => setPredScorer(e.target.value)}
                    placeholder="e.g. Mbeumo"
                    className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-cream/50 block mb-1">1st Goal Min</label>
                    <input type="number" min={1} max={90} value={predMinute} onChange={(e) => setPredMinute(Number(e.target.value))} className="w-full bg-dark border border-dark-border rounded px-2 py-1.5 text-center font-mono" />
                  </div>
                  <div>
                    <label className="text-xs text-cream/50 block mb-1">Total Corners</label>
                    <input type="number" min={0} value={predCorners} onChange={(e) => setPredCorners(Number(e.target.value))} className="w-full bg-dark border border-dark-border rounded px-2 py-1.5 text-center font-mono" />
                  </div>
                  <div>
                    <label className="text-xs text-cream/50 block mb-1">Total Cards</label>
                    <input type="number" min={0} value={predCards} onChange={(e) => setPredCards(Number(e.target.value))} className="w-full bg-dark border border-dark-border rounded px-2 py-1.5 text-center font-mono" />
                  </div>
                </div>
                <button
                  onClick={submitPrediction}
                  className="w-full bg-augusta hover:bg-augusta-light text-cream font-bold py-3 rounded-lg transition-colors"
                >
                  Lock In Prediction
                </button>
                {submitMsg && (
                  <p className={`text-center text-xs ${submitMsg.includes("!") ? "text-augusta-light" : "text-red-400"}`}>
                    {submitMsg}
                  </p>
                )}
              </div>
            </div>
          ) : !selectedPlayer ? (
            <div className="bg-dark-card border border-dark-border rounded-xl p-6 text-center text-cream/50 text-sm">
              Tap your name above to make a prediction
            </div>
          ) : null}

          {/* Show all predictions */}
          {(isLive || isFinished || (isUpcoming && myPred)) && (
            <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-dark-border text-xs text-cream/40 uppercase font-bold">
                All Predictions {isUpcoming && "(locked)"}
              </div>
              {data.predictions.map((p) => {
                const player = data.players.find((pl) => pl.id === p.playerId);
                return (
                  <div key={p.playerId} className="px-3 py-2 border-b border-dark-border/30 last:border-0 text-xs">
                    <div className="font-bold text-sm mb-1">{player?.emoji} {player?.name}</div>
                    <div className="grid grid-cols-3 gap-1 text-cream/70">
                      <span>Score: {p.predictedHomeScore}–{p.predictedAwayScore}</span>
                      <span>Scorer: {p.firstScorer || "–"}</span>
                      <span>Min: {p.firstGoalMinute ?? "–"}'</span>
                      <span>Corners: {p.totalCorners ?? "–"}</span>
                      <span>Cards: {p.totalCards ?? "–"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* BINGO TAB */}
      {tab === "bingo" && (
        <div className="space-y-4">
          {data.players.map((player) => {
            const card = data.bingoCards.find((b) => b.playerId === player.id);
            if (!card) return null;
            const isMe = player.id === selectedPlayer;
            const score = data.scores.find((s) => s.playerId === player.id);
            return (
              <div key={player.id} className="bg-dark-card border border-dark-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm" style={{ color: player.color }}>
                    {player.emoji} {player.name}
                  </span>
                  <span className="text-xs text-cream/50">
                    {score?.bingoSquaresMarked ?? 0}/9
                    {(score?.bingoLines ?? 0) > 0 && (
                      <span className="text-gold font-bold ml-1">
                        {score?.bingoLines} line{(score?.bingoLines ?? 0) > 1 ? "s" : ""}!
                      </span>
                    )}
                    {score?.bingoFullHouse && (
                      <span className="text-gold font-bold ml-1">FULL HOUSE!</span>
                    )}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {card.squares.map((sq) => (
                    <button
                      key={sq.key}
                      onClick={() => isMe && (isLive || isFinished) ? toggleBingo(sq.key) : null}
                      disabled={!isMe || isUpcoming}
                      className={`rounded-lg p-2 text-[10px] leading-tight text-center transition-all min-h-[52px] flex items-center justify-center ${
                        sq.marked
                          ? "bg-augusta/30 border-2 border-augusta text-cream font-bold"
                          : "bg-dark border border-dark-border text-cream/60"
                      } ${isMe && (isLive || isFinished) ? "cursor-pointer hover:border-augusta/60" : "cursor-default"}`}
                    >
                      {sq.marked && <span className="mr-0.5">{"\u2705"}</span>}
                      {sq.text}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BLOCKS TAB */}
      {tab === "blocks" && (
        <div className="space-y-3">
          <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-dark-border text-xs text-cream/40 uppercase font-bold">
              Minute Blocks — 5 pts per goal in your block
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              {["1–11","12–22","23–33","34–45","46–56","57–67","68–78","79–90+"].map((label) => {
                const block = data.blocks.find((b) => b.label === label);
                const owner = block ? data.players.find((p) => p.id === block.playerId) : null;
                const goalsInBlock = data.events.filter(
                  (e) =>
                    e.type === "goal" &&
                    block &&
                    e.minute >= block.start &&
                    e.minute <= block.end
                ).length;
                const isActive =
                  isLive &&
                  block &&
                  match.currentMinute != null &&
                  match.currentMinute >= block.start &&
                  match.currentMinute <= block.end;
                return (
                  <div
                    key={label}
                    className={`rounded-lg p-3 border transition-all ${
                      isActive
                        ? "border-gold bg-gold/10 ring-1 ring-gold/50"
                        : "border-dark-border bg-dark"
                    }`}
                    style={
                      owner
                        ? { borderLeft: `4px solid ${owner.color ?? "#888"}` }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sm">{label}</span>
                      {isActive && (
                        <span className="text-[9px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                          NOW
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-1">
                      {owner ? (
                        <span style={{ color: owner.color }}>
                          {owner.emoji} {owner.name}
                        </span>
                      ) : (
                        <span className="text-cream/30">Undrafted</span>
                      )}
                    </div>
                    {goalsInBlock > 0 && (
                      <div className="text-gold font-bold text-xs mt-1">
                        {"\u26BD".repeat(goalsInBlock)} +{goalsInBlock * 5} pts
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* My blocks summary */}
          {selectedPlayer && myBlocks.length > 0 && (
            <div className="bg-dark-card border border-dark-border rounded-xl p-3 text-center">
              <span className="text-xs text-cream/50">Your blocks: </span>
              <span className="font-mono font-bold text-sm">
                {myBlocks.map((b) => b.label).join(" & ")}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Live Events Feed */}
      {data.events.length > 0 && (
        <div className="mt-4 bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-dark-border text-xs text-cream/40 uppercase font-bold">
            Match Events
          </div>
          <div className="max-h-48 overflow-y-auto">
            {data.events.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-2 px-3 py-1.5 text-xs border-b border-dark-border/20 last:border-0"
              >
                <span className="font-mono text-cream/40 w-8">{e.minute}'</span>
                <span>{EVENT_EMOJI[e.type] ?? "\u2139\uFE0F"}</span>
                <span className="flex-1 text-cream/80">
                  {e.type === "goal" && `GOAL${e.team ? ` (${e.team})` : ""}${e.detail ? ` — ${e.detail}` : ""}`}
                  {e.type === "corner" && `Corner${e.team ? ` (${e.team})` : ""}`}
                  {e.type === "yellow_card" && `Yellow card${e.detail ? ` — ${e.detail}` : ""}`}
                  {e.type === "red_card" && `Red card${e.detail ? ` — ${e.detail}` : ""}`}
                  {e.type === "var" && "VAR Review"}
                  {e.type === "penalty" && "Penalty awarded"}
                  {e.type === "sub" && `Substitution${e.detail ? ` — ${e.detail}` : ""}`}
                  {e.type === "woodwork" && "Hit the woodwork"}
                  {!["goal","corner","yellow_card","red_card","var","penalty","sub","woodwork"].includes(e.type) && (e.detail || e.type)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center text-[10px] text-cream/30 mt-3">
        Auto-refreshes every 10 seconds
      </div>
    </div>
  );
}
