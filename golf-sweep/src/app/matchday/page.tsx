"use client";
import { useEffect, useState } from "react";

type Tab = "predictions" | "bingo" | "blocks" | "lineups";

interface MatchState {
  match: {
    id: number; homeTeam: string; awayTeam: string;
    homeLogo: string | null; awayLogo: string | null;
    venue: string | null; status: string; statusLong: string;
    elapsed: number | null; homeScore: number | null; awayScore: number | null;
    totalCorners: number | null; totalCards: number | null;
  } | null;
  players: Array<{ id: number; name: string; emoji: string; color: string }>;
  predictions: Array<{
    playerId: number; predictedHomeScore: number | null; predictedAwayScore: number | null;
    firstScorer: string | null; firstGoalMinute: number | null;
    totalCorners: number | null; totalCards: number | null;
  }>;
  bingoCards: Array<{ playerId: number; squares: Array<{ key: string; text: string; marked: boolean }> }>;
  blocks: Array<{ playerId: number; label: string; start: number; end: number }>;
  events: Array<{
    minute: number; extra: number | null; type: string; detail: string;
    player: string; assist: string | null; team: string;
  }>;
  lineups: Array<{
    team: string; teamLogo: string; formation: string | null; coach: string | null;
    startXI: Array<{ name: string; number: number; pos: string }>;
    subs: Array<{ name: string; number: number; pos: string }>;
  }>;
  scores: Array<{
    playerId: number; playerName: string; playerEmoji: string; playerColor: string;
    predictionPoints: number; bingoPoints: number; bingoSquaresMarked: number;
    bingoLines: number; bingoFullHouse: boolean; blockGoals: number; blockPoints: number;
    totalPoints: number;
  }>;
}

const EVENT_EMOJI: Record<string, string> = {
  Goal: "\u26BD", Card: "\uD83D\uDFE8", subst: "\uD83D\uDD04", Var: "\uD83D\uDCFA",
};
const POS_EMOJI: Record<string, string> = { G: "\uD83E\uDDE4", D: "\uD83D\uDEE1\uFE0F", M: "\u2699\uFE0F", F: "\u26BD" };

export default function MatchdayPage() {
  const [data, setData] = useState<MatchState | null>(null);
  const [tab, setTab] = useState<Tab>("lineups");
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Prediction form
  const [predHome, setPredHome] = useState(1);
  const [predAway, setPredAway] = useState(1);
  const [predScorer, setPredScorer] = useState("");
  const [predMinute, setPredMinute] = useState(30);
  const [predCorners, setPredCorners] = useState(8);
  const [predCards, setPredCards] = useState(3);
  const [submitMsg, setSubmitMsg] = useState("");

  async function fetchData() {
    const res = await fetch("/api/matchday");
    setData(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 15_000);
    return () => clearInterval(iv);
  }, []);

  async function submitPrediction() {
    if (!data?.match || !selectedPlayer) return;
    const res = await fetch("/api/matchday/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: data.match.id, playerId: selectedPlayer,
        predictedHomeScore: predHome, predictedAwayScore: predAway,
        firstScorer: predScorer || null, firstGoalMinute: predMinute,
        totalCorners: predCorners, totalCards: predCards,
      }),
    });
    setSubmitMsg(res.ok ? "Prediction locked in!" : ((await res.json().catch(() => ({}))).error || "Failed"));
    fetchData();
  }

  if (loading) return <div className="max-w-2xl mx-auto px-4 py-8 text-center text-cream/40">Loading...</div>;
  if (!data?.match) return (
    <div className="max-w-2xl mx-auto px-4 py-8 text-center">
      <h1 className="font-serif text-2xl font-bold mb-4">Matchday Madness</h1>
      <p className="text-cream/50">No match set up. <a href="/matchday/admin" className="text-augusta-light underline">Create one</a>.</p>
    </div>
  );

  const match = data.match;
  const isUpcoming = match.status === "upcoming";
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const myPred = data.predictions.find((p) => p.playerId === selectedPlayer);
  const myBlocks = data.blocks.filter((b) => b.playerId === selectedPlayer);
  const goalEvents = data.events.filter((e) => e.type === "Goal");

  const tabs: { key: Tab; label: string; emoji: string }[] = [
    { key: "lineups", label: "Squads", emoji: "\uD83D\uDCCB" },
    { key: "predictions", label: "Predict", emoji: "\uD83C\uDFAF" },
    { key: "bingo", label: "Bingo", emoji: "\uD83C\uDFB0" },
    { key: "blocks", label: "Blocks", emoji: "\u23F1\uFE0F" },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      {/* Match Header */}
      <div className="text-center mb-3">
        <div className="text-[10px] uppercase tracking-widest text-cream/40 font-bold mb-1">Matchday Madness</div>
        <div className="flex items-center justify-center gap-3">
          {match.homeLogo && <img src={match.homeLogo} alt="" className="w-10 h-10" />}
          <div>
            <h1 className="font-serif text-lg md:text-xl font-bold leading-tight">
              {match.homeTeam}
              {(isLive || isFinished) ? (
                <span className="text-gold text-2xl mx-2">{match.homeScore ?? 0} – {match.awayScore ?? 0}</span>
              ) : (
                <span className="text-cream/40 mx-2">vs</span>
              )}
              {match.awayTeam}
            </h1>
            <div className="flex items-center justify-center gap-2 mt-0.5">
              {match.venue && <span className="text-[10px] text-cream/40">{match.venue}</span>}
              {isLive && (
                <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full uppercase font-bold animate-pulse">
                  {match.statusLong} {match.elapsed ? `· ${match.elapsed}'` : ""}
                </span>
              )}
              {isFinished && <span className="text-[10px] bg-gold/20 text-gold px-2 py-0.5 rounded-full uppercase font-bold">Full Time</span>}
              {isUpcoming && <span className="text-[10px] bg-cream/10 text-cream/50 px-2 py-0.5 rounded-full uppercase">Pre-Match</span>}
            </div>
          </div>
          {match.awayLogo && <img src={match.awayLogo} alt="" className="w-10 h-10" />}
        </div>
        {(isLive || isFinished) && (
          <div className="flex justify-center gap-4 mt-1 text-[10px] text-cream/40">
            <span>Corners: {match.totalCorners ?? 0}</span>
            <span>Cards: {match.totalCards ?? 0}</span>
          </div>
        )}
      </div>

      {/* Player Selector */}
      <div className="flex gap-1.5 justify-center mb-3 flex-wrap">
        {data.players.map((p) => (
          <button key={p.id} onClick={() => setSelectedPlayer(p.id)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedPlayer === p.id ? "ring-2 ring-gold scale-105" : "opacity-60 hover:opacity-100"}`}
            style={{ backgroundColor: `${p.color}30`, borderBottom: `3px solid ${p.color}` }}>
            {p.emoji} {p.name}
          </button>
        ))}
      </div>

      {/* Leaderboard Strip */}
      <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden mb-3">
        <div className="flex items-center px-3 py-1 text-[9px] text-cream/40 uppercase tracking-wider border-b border-dark-border">
          <span className="flex-1">Player</span>
          <span className="w-10 text-center">Pred</span>
          <span className="w-10 text-center">Bingo</span>
          <span className="w-10 text-center">Block</span>
          <span className="w-12 text-center text-gold font-bold">Total</span>
        </div>
        {data.scores.map((s, i) => (
          <div key={s.playerId} className="flex items-center px-3 py-1.5 text-xs border-b border-dark-border/30 last:border-0"
            style={{ borderLeft: `3px solid ${s.playerColor}` }}>
            <span className="flex-1 font-bold">{i === 0 && isFinished ? "\uD83C\uDFC6 " : ""}{s.playerEmoji} {s.playerName}</span>
            <span className="w-10 text-center text-cream/60 font-mono">{s.predictionPoints || "-"}</span>
            <span className="w-10 text-center text-cream/60 font-mono">{s.bingoPoints || "-"}</span>
            <span className="w-10 text-center text-cream/60 font-mono">{s.blockPoints || "-"}</span>
            <span className="w-12 text-center text-gold font-bold font-mono">{s.totalPoints || "-"}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 px-2 py-2 rounded-lg text-xs font-bold transition-colors ${tab === t.key ? "bg-augusta text-cream" : "bg-dark-card text-cream/60 hover:bg-dark-border"}`}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* LINEUPS TAB */}
      {tab === "lineups" && (
        <div className="space-y-3">
          {data.lineups.length === 0 ? (
            <div className="bg-dark-card border border-dark-border rounded-xl p-6 text-center text-cream/40 text-sm">
              Team sheets not available yet. Usually announced ~1 hour before kick-off.
            </div>
          ) : data.lineups.map((lineup) => (
            <div key={lineup.team} className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-dark-border">
                {lineup.teamLogo && <img src={lineup.teamLogo} alt="" className="w-5 h-5" />}
                <span className="font-bold text-sm">{lineup.team}</span>
                {lineup.formation && <span className="text-xs text-cream/40 ml-auto">{lineup.formation}</span>}
                {lineup.coach && <span className="text-[10px] text-cream/30 ml-1">({lineup.coach})</span>}
              </div>
              <div className="px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-cream/40 mb-1 font-bold">Starting XI</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {lineup.startXI.map((p) => (
                    <div key={p.number} className="flex items-center gap-1.5 text-xs py-0.5">
                      <span className="text-cream/30 font-mono w-5 text-right">{p.number}</span>
                      <span className="text-[10px]">{POS_EMOJI[p.pos] ?? ""}</span>
                      <span className="text-cream/90 font-medium">{p.name}</span>
                    </div>
                  ))}
                </div>
                {lineup.subs.length > 0 && (
                  <>
                    <div className="text-[10px] uppercase tracking-wider text-cream/30 mt-2 mb-1 font-bold">Subs</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      {lineup.subs.map((p) => (
                        <div key={p.number} className="flex items-center gap-1.5 text-[10px] py-0.5 text-cream/50">
                          <span className="font-mono w-5 text-right text-cream/20">{p.number}</span>
                          <span>{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          {data.lineups.length > 0 && isUpcoming && (
            <p className="text-center text-[10px] text-cream/40">
              Use the team sheets above to choose your first goalscorer in the Predict tab
            </p>
          )}
        </div>
      )}

      {/* PREDICTIONS TAB */}
      {tab === "predictions" && (
        <div className="space-y-3">
          {isUpcoming && selectedPlayer && !myPred ? (
            <div className="bg-dark-card border border-dark-border rounded-xl p-4">
              <h3 className="font-serif font-bold mb-3">Your Prediction</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-cream/50 block mb-1">Final Score</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs w-20 truncate">{match.homeTeam}</span>
                    <input type="number" min={0} value={predHome} onChange={(e) => setPredHome(Number(e.target.value))} className="w-14 bg-dark border border-dark-border rounded px-2 py-1.5 text-center font-mono text-lg" />
                    <span className="text-cream/40">–</span>
                    <input type="number" min={0} value={predAway} onChange={(e) => setPredAway(Number(e.target.value))} className="w-14 bg-dark border border-dark-border rounded px-2 py-1.5 text-center font-mono text-lg" />
                    <span className="text-xs w-20 truncate text-right">{match.awayTeam}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-cream/50 block mb-1">First Goalscorer</label>
                  <input type="text" value={predScorer} onChange={(e) => setPredScorer(e.target.value)} placeholder="e.g. Mbeumo" className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-sm" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="text-xs text-cream/50 block mb-1">1st Goal Min</label><input type="number" min={1} max={90} value={predMinute} onChange={(e) => setPredMinute(Number(e.target.value))} className="w-full bg-dark border border-dark-border rounded px-2 py-1.5 text-center font-mono" /></div>
                  <div><label className="text-xs text-cream/50 block mb-1">Corners</label><input type="number" min={0} value={predCorners} onChange={(e) => setPredCorners(Number(e.target.value))} className="w-full bg-dark border border-dark-border rounded px-2 py-1.5 text-center font-mono" /></div>
                  <div><label className="text-xs text-cream/50 block mb-1">Cards</label><input type="number" min={0} value={predCards} onChange={(e) => setPredCards(Number(e.target.value))} className="w-full bg-dark border border-dark-border rounded px-2 py-1.5 text-center font-mono" /></div>
                </div>
                <button onClick={submitPrediction} className="w-full bg-augusta hover:bg-augusta-light text-cream font-bold py-3 rounded-lg transition-colors">Lock In Prediction</button>
                {submitMsg && <p className="text-center text-xs text-augusta-light">{submitMsg}</p>}
              </div>
            </div>
          ) : !selectedPlayer ? (
            <div className="bg-dark-card border border-dark-border rounded-xl p-6 text-center text-cream/50 text-sm">Tap your name above to predict</div>
          ) : null}
          {data.predictions.length > 0 && (
            <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-dark-border text-xs text-cream/40 uppercase font-bold">All Predictions</div>
              {data.predictions.map((p) => {
                const pl = data.players.find((x) => x.id === p.playerId);
                return (
                  <div key={p.playerId} className="px-3 py-2 border-b border-dark-border/30 last:border-0 text-xs">
                    <div className="font-bold text-sm mb-1">{pl?.emoji} {pl?.name}</div>
                    <div className="grid grid-cols-3 gap-1 text-cream/70">
                      <span>Score: {p.predictedHomeScore}–{p.predictedAwayScore}</span>
                      <span>Scorer: {p.firstScorer || "–"}</span>
                      <span>Min: {p.firstGoalMinute ?? "–"}&apos;</span>
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
        <div className="space-y-3">
          {data.players.map((player) => {
            const card = data.bingoCards.find((b) => b.playerId === player.id);
            if (!card) return null;
            const score = data.scores.find((s) => s.playerId === player.id);
            return (
              <div key={player.id} className="bg-dark-card border border-dark-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm" style={{ color: player.color }}>{player.emoji} {player.name}</span>
                  <span className="text-xs text-cream/50">
                    {score?.bingoSquaresMarked ?? 0}/9
                    {(score?.bingoLines ?? 0) > 0 && <span className="text-gold font-bold ml-1">{score?.bingoLines} line{(score?.bingoLines ?? 0) > 1 ? "s" : ""}!</span>}
                    {score?.bingoFullHouse && <span className="text-gold font-bold ml-1">FULL HOUSE!</span>}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {card.squares.map((sq) => (
                    <div key={sq.key} className={`rounded-lg p-2 text-[10px] leading-tight text-center min-h-[48px] flex items-center justify-center ${sq.marked ? "bg-augusta/30 border-2 border-augusta text-cream font-bold" : "bg-dark border border-dark-border text-cream/60"}`}>
                      {sq.marked && "\u2705 "}{sq.text}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <p className="text-center text-[10px] text-cream/30">Bingo squares auto-check from the live feed — no tapping needed</p>
        </div>
      )}

      {/* BLOCKS TAB */}
      {tab === "blocks" && (
        <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-dark-border text-xs text-cream/40 uppercase font-bold">Minute Blocks — 5 pts per goal</div>
          <div className="grid grid-cols-2 gap-2 p-3">
            {["1–11","12–22","23–33","34–45","46–56","57–67","68–78","79–90+"].map((label) => {
              const block = data.blocks.find((b) => b.label === label);
              const owner = block ? data.players.find((p) => p.id === block.playerId) : null;
              const goalsIn = goalEvents.filter((e) => block && e.minute >= block.start && e.minute <= block.end).length;
              const isActive = isLive && block && match.elapsed != null && match.elapsed >= block.start && match.elapsed <= block.end;
              return (
                <div key={label} className={`rounded-lg p-3 border ${isActive ? "border-gold bg-gold/10 ring-1 ring-gold/50" : "border-dark-border bg-dark"}`}
                  style={owner ? { borderLeft: `4px solid ${owner.color}` } : undefined}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm">{label}</span>
                    {isActive && <span className="text-[9px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full font-bold animate-pulse">NOW</span>}
                  </div>
                  <div className="text-xs mt-1">
                    {owner ? <span style={{ color: owner.color }}>{owner.emoji} {owner.name}</span> : <span className="text-cream/30">Undrafted</span>}
                  </div>
                  {goalsIn > 0 && <div className="text-gold font-bold text-xs mt-1">{"\u26BD".repeat(goalsIn)} +{goalsIn * 5} pts</div>}
                </div>
              );
            })}
          </div>
          {selectedPlayer && myBlocks.length > 0 && (
            <div className="px-3 pb-3 text-center"><span className="text-xs text-cream/50">Your blocks: </span><span className="font-mono font-bold text-sm">{myBlocks.map((b) => b.label).join(" & ")}</span></div>
          )}
        </div>
      )}

      {/* Live Events Feed */}
      {data.events.length > 0 && (
        <div className="mt-3 bg-dark-card border border-dark-border rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-dark-border text-xs text-cream/40 uppercase font-bold">Live Events</div>
          <div className="max-h-48 overflow-y-auto">
            {[...data.events].reverse().map((e, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs border-b border-dark-border/20 last:border-0">
                <span className="font-mono text-cream/40 w-8">{e.minute}{e.extra ? `+${e.extra}` : ""}&apos;</span>
                <span>{EVENT_EMOJI[e.type] ?? "\u2139\uFE0F"}</span>
                <span className="flex-1 text-cream/80">
                  <span className="font-bold">{e.player}</span>
                  {e.assist && <span className="text-cream/40"> (assist: {e.assist})</span>}
                  {" · "}{e.detail} · {e.team}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center text-[10px] text-cream/30 mt-3">
        Live data from API-Football · auto-refreshes every 15 seconds
      </div>
    </div>
  );
}
