"use client";
import { useState, useEffect } from "react";

interface MatchState {
  match: { id: number; homeTeam: string; awayTeam: string; status: string; currentMinute: number | null } | null;
  players: Array<{ id: number; name: string }>;
  events: Array<{ id: number; type: string; minute: number; detail: string | null; team: string | null }>;
}

export default function MatchdayAdminPage() {
  const [data, setData] = useState<MatchState | null>(null);
  const [msg, setMsg] = useState("");

  // Setup form
  const [homeTeam, setHomeTeam] = useState("Brentford");
  const [awayTeam, setAwayTeam] = useState("Fulham");
  const [venue, setVenue] = useState("Gtech Community Stadium");

  // Event form
  const [eventMinute, setEventMinute] = useState(1);
  const [eventTeam, setEventTeam] = useState("home");
  const [eventDetail, setEventDetail] = useState("");

  async function fetchData() {
    const res = await fetch("/api/matchday");
    setData(await res.json());
  }

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 5000);
    return () => clearInterval(iv);
  }, []);

  async function createMatch() {
    setMsg("");
    const res = await fetch("/api/matchday", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        homeTeam,
        awayTeam,
        matchDate: new Date().toISOString(),
        venue,
        players: [
          { name: "Russell", emoji: "\uD83D\uDC68\u200D\uD83D\uDCBB", color: "#10b981" },
          { name: "Suzie", emoji: "\uD83D\uDC69\u200D\uD83E\uDDB0", color: "#f472b6" },
          { name: "James", emoji: "\u26BD", color: "#3b82f6" },
          { name: "William", emoji: "\uD83C\uDFC6", color: "#f59e0b" },
        ],
      }),
    });
    const json = await res.json();
    setMsg(json.success ? `Match created! Blocks: ${JSON.stringify(json.blocksPerPlayer)}` : json.error);
    fetchData();
  }

  async function matchControl(action: string) {
    if (!data?.match) return;
    await fetch("/api/matchday/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: data.match.id, action }),
    });
    fetchData();
  }

  async function addEvent(eventType: string) {
    if (!data?.match) return;
    await fetch("/api/matchday/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: data.match.id,
        eventType,
        minute: eventMinute,
        team: eventTeam,
        detail: eventDetail || null,
      }),
    });
    setEventDetail("");
    fetchData();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="font-serif text-2xl font-bold mb-4">Matchday Admin</h1>

      {/* Create match — only if no match exists */}
      {!data?.match && (
        <div className="bg-dark-card border border-dark-border rounded-xl p-4 mb-4">
          <h2 className="font-bold mb-3">Create Match</h2>
          <div className="space-y-2">
            <input value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} placeholder="Home team" className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-sm" />
            <input value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} placeholder="Away team" className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-sm" />
            <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Venue" className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-sm" />
            <button onClick={createMatch} className="w-full bg-augusta hover:bg-augusta-light text-cream font-bold py-3 rounded-lg transition-colors">
              Create Match + Generate Cards + Draft Blocks
            </button>
          </div>
          {msg && <p className="text-xs mt-2 text-center text-cream/60">{msg}</p>}
        </div>
      )}

      {/* Match controls */}
      {data?.match && (
        <>
          <div className="bg-dark-card border border-dark-border rounded-xl p-4 mb-4">
            <div className="text-center mb-3">
              <span className="font-serif font-bold text-lg">
                {data.match.homeTeam} vs {data.match.awayTeam}
              </span>
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                data.match.status === "live" ? "bg-red-500/20 text-red-400" :
                data.match.status === "finished" ? "bg-gold/20 text-gold" :
                "bg-cream/10 text-cream/50"
              }`}>
                {data.match.status}
              </span>
            </div>
            <div className="flex gap-2 flex-wrap justify-center">
              <button onClick={() => matchControl("kickoff")} className="bg-augusta text-cream px-4 py-2 rounded-lg text-sm font-bold">Kick Off</button>
              <button onClick={() => matchControl("half_time")} className="bg-dark-border text-cream px-4 py-2 rounded-lg text-sm font-bold">Half Time</button>
              <button onClick={() => matchControl("second_half")} className="bg-dark-border text-cream px-4 py-2 rounded-lg text-sm font-bold">2nd Half</button>
              <button onClick={() => matchControl("full_time")} className="bg-gold/30 text-gold px-4 py-2 rounded-lg text-sm font-bold">Full Time</button>
            </div>
          </div>

          {/* Live Event Entry */}
          {data.match.status === "live" && (
            <div className="bg-dark-card border border-dark-border rounded-xl p-4 mb-4">
              <h2 className="font-bold mb-3">Add Event</h2>

              <div className="flex gap-2 mb-3">
                <div className="flex-1">
                  <label className="text-xs text-cream/50 block mb-1">Minute</label>
                  <input
                    type="number"
                    min={1}
                    max={95}
                    value={eventMinute}
                    onChange={(e) => setEventMinute(Number(e.target.value))}
                    className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-center font-mono text-lg"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-cream/50 block mb-1">Team</label>
                  <div className="flex rounded-lg overflow-hidden border border-dark-border">
                    <button
                      onClick={() => setEventTeam("home")}
                      className={`flex-1 py-2 text-xs font-bold ${eventTeam === "home" ? "bg-augusta text-cream" : "bg-dark text-cream/50"}`}
                    >
                      {data.match.homeTeam}
                    </button>
                    <button
                      onClick={() => setEventTeam("away")}
                      className={`flex-1 py-2 text-xs font-bold ${eventTeam === "away" ? "bg-augusta text-cream" : "bg-dark text-cream/50"}`}
                    >
                      {data.match.awayTeam}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="text-xs text-cream/50 block mb-1">Detail (scorer name, player booked, etc.)</label>
                <input
                  type="text"
                  value={eventDetail}
                  onChange={(e) => setEventDetail(e.target.value)}
                  placeholder="e.g. Mbeumo"
                  className="w-full bg-dark border border-dark-border rounded px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-4 gap-2">
                <button onClick={() => addEvent("goal")} className="bg-red-600 hover:bg-red-500 text-white py-3 rounded-lg font-bold text-sm">{"\u26BD"} Goal</button>
                <button onClick={() => addEvent("corner")} className="bg-dark-border hover:bg-cream/20 text-cream py-3 rounded-lg font-bold text-sm">{"\uD83D\uDEA9"} Corner</button>
                <button onClick={() => addEvent("yellow_card")} className="bg-yellow-600 hover:bg-yellow-500 text-black py-3 rounded-lg font-bold text-sm">{"\uD83D\uDFE8"} Yellow</button>
                <button onClick={() => addEvent("red_card")} className="bg-red-800 hover:bg-red-700 text-white py-3 rounded-lg font-bold text-sm">{"\uD83D\uDFE5"} Red</button>
              </div>

              <div className="grid grid-cols-4 gap-2 mt-2">
                <button onClick={() => addEvent("var")} className="bg-dark-border hover:bg-cream/20 text-cream py-3 rounded-lg text-sm">{"\uD83D\uDCFA"} VAR</button>
                <button onClick={() => addEvent("penalty")} className="bg-dark-border hover:bg-cream/20 text-cream py-3 rounded-lg text-sm">{"\u26BD"} Penalty</button>
                <button onClick={() => addEvent("sub")} className="bg-dark-border hover:bg-cream/20 text-cream py-3 rounded-lg text-sm">{"\uD83D\uDD04"} Sub</button>
                <button onClick={() => addEvent("woodwork")} className="bg-dark-border hover:bg-cream/20 text-cream py-3 rounded-lg text-sm">{"\uD83E\uDE93"} Post</button>
              </div>
            </div>
          )}

          {/* Event log */}
          {data.events.length > 0 && (
            <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-dark-border text-xs text-cream/40 uppercase font-bold">
                Events ({data.events.length})
              </div>
              {data.events.map((e) => (
                <div key={e.id} className="px-3 py-1.5 text-xs border-b border-dark-border/20 last:border-0 flex gap-2">
                  <span className="font-mono text-cream/40 w-8">{e.minute}'</span>
                  <span className="text-cream/80 flex-1">
                    {e.type} {e.team ? `(${e.team})` : ""} {e.detail ?? ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
