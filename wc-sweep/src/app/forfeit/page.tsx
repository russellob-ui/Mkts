"use client";

import { useState, useEffect, useRef } from "react";

interface PlayerInfo {
  id: number;
  name: string;
  slug: string;
  color: string | null;
  avatarEmoji: string | null;
  totalPoints: number;
}

interface PastSpin {
  id: number;
  forfeit: string;
  targetPlayerSlug: string | null;
  createdAt: string;
}

const FORFEITS = [
  "Buy everyone a drink",
  "Wear the winner's team shirt for a day",
  "Post an embarrassing photo on social media",
  "Do 20 press-ups at the pub",
  "Sing the winner's national anthem",
  "Change your WhatsApp photo to wooden spoon for a week",
  "Cook dinner for the winner",
  "Write a 200-word essay praising the winner",
  "Eat something spicy chosen by the group",
  "Do a lap of the pub in a silly hat",
  "Be the designated driver next night out",
  "Carry the winner's bags next trip",
  "Make everyone tea/coffee for a week",
  "Wear a rival team shirt to work",
  "Post a congratulations video to the group chat",
];

const FORFEIT_EMOJIS = [
  "🍺", "👕", "📸", "💪", "🎤", "📱", "🍳", "✍️", "🌶️", "🎩",
  "🚗", "🧳", "☕", "😤", "🎬",
];

const LS_PASSCODE = "wc_sweep_passcode";

export default function ForfeitPage() {
  const [woodenSpoon, setWoodenSpoon] = useState<PlayerInfo | null>(null);
  const [leaderboard, setLeaderboard] = useState<PlayerInfo[]>([]);
  const [pastSpins, setPastSpins] = useState<PastSpin[]>([]);
  const [loading, setLoading] = useState(true);

  const [passcode, setPasscode] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ forfeit: string; forfeitIndex: number } | null>(null);
  const [error, setError] = useState("");

  // Wheel animation state
  const [wheelRotation, setWheelRotation] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    try {
      const savedPass = localStorage.getItem(LS_PASSCODE);
      if (savedPass) setPasscode(savedPass);
    } catch {
      // localStorage unavailable
    }
  }, []);

  useEffect(() => {
    try {
      if (passcode) localStorage.setItem(LS_PASSCODE, passcode);
    } catch {
      // localStorage unavailable
    }
  }, [passcode]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/forfeit-wheel");
        if (res.ok) {
          const data = await res.json();
          setWoodenSpoon(data.woodenSpoon ?? null);
          setLeaderboard(data.leaderboard ?? []);
          setPastSpins(data.pastSpins ?? []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSpin() {
    if (!passcode || spinning) return;

    setSpinning(true);
    setError("");
    setShowResult(false);
    setResult(null);

    try {
      const res = await fetch("/api/forfeit-wheel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spinnerPasscode: passcode }),
      });

      const data = await res.json();

      if (res.ok) {
        const idx = data.forfeitIndex;
        // Spin the wheel: multiple full rotations + land on the forfeit segment
        const segmentAngle = 360 / FORFEITS.length;
        const targetAngle = 360 - idx * segmentAngle - segmentAngle / 2;
        const fullSpins = 5 * 360; // 5 full rotations
        const totalRotation = wheelRotation + fullSpins + targetAngle;
        setWheelRotation(totalRotation);

        // Show result after animation
        setTimeout(() => {
          setResult({ forfeit: data.forfeit, forfeitIndex: idx });
          setShowResult(true);
          setSpinning(false);
          // Reload data
          fetch("/api/forfeit-wheel")
            .then((r) => r.json())
            .then((d) => setPastSpins(d.pastSpins ?? []))
            .catch(() => {});
        }, 4000);
      } else {
        setError(data.error ?? "Failed to spin");
        setSpinning(false);
      }
    } catch {
      setError("Network error");
      setSpinning(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-cream/40">
        Loading forfeit wheel...
      </div>
    );
  }

  const segmentAngle = 360 / FORFEITS.length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl font-bold">
          <span className="text-wc-gold">Forfeit</span>{" "}
          <span className="text-cream">Wheel</span>
        </h1>
        <p className="text-cream/50 text-sm">
          Last place pays the price. Commissioner spins.
        </p>
      </div>

      {/* Wooden spoon holder */}
      {woodenSpoon && (
        <div className="bg-dark-card border border-wc-red/40 rounded-lg p-4 text-center space-y-2">
          <div className="text-4xl">🥄</div>
          <div className="text-xs text-cream/40 uppercase tracking-wider">
            Wooden Spoon Holder
          </div>
          <div
            className="text-xl font-serif font-bold"
            style={{ color: woodenSpoon.color ?? "#d4a843" }}
          >
            {woodenSpoon.name}
          </div>
          <div className="text-xs text-cream/40">
            {woodenSpoon.totalPoints} points (last place)
          </div>
        </div>
      )}

      {/* Wheel */}
      <div className="relative flex flex-col items-center">
        {/* Pointer */}
        <div className="relative z-10 mb-[-12px]">
          <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-wc-gold" />
        </div>

        {/* Wheel circle */}
        <div className="relative w-72 h-72 sm:w-80 sm:h-80">
          <div
            className="w-full h-full rounded-full border-4 border-wc-gold/40 overflow-hidden"
            style={{
              transform: `rotate(${wheelRotation}deg)`,
              transition: spinning
                ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)"
                : "none",
            }}
          >
            {/* SVG wheel segments */}
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {FORFEITS.map((forfeit, i) => {
                const startAngle = i * segmentAngle;
                const endAngle = (i + 1) * segmentAngle;
                const startRad = ((startAngle - 90) * Math.PI) / 180;
                const endRad = ((endAngle - 90) * Math.PI) / 180;

                const x1 = 100 + 100 * Math.cos(startRad);
                const y1 = 100 + 100 * Math.sin(startRad);
                const x2 = 100 + 100 * Math.cos(endRad);
                const y2 = 100 + 100 * Math.sin(endRad);

                const largeArcFlag = segmentAngle > 180 ? 1 : 0;

                const colors = [
                  "#8a1538", "#1a237e", "#00695c", "#d4a843",
                  "#6b21a8", "#0369a1", "#b45309", "#be123c",
                  "#15803d", "#7c3aed", "#c2410c", "#0e7490",
                  "#a16207", "#9f1239", "#047857",
                ];
                const color = colors[i % colors.length];

                // Text position
                const midAngle = ((startAngle + endAngle) / 2 - 90) * Math.PI / 180;
                const textX = 100 + 65 * Math.cos(midAngle);
                const textY = 100 + 65 * Math.sin(midAngle);
                const textRotation = (startAngle + endAngle) / 2;

                return (
                  <g key={i}>
                    <path
                      d={`M 100 100 L ${x1} ${y1} A 100 100 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                      fill={color}
                      stroke="#0a0a0f"
                      strokeWidth="0.5"
                    />
                    <text
                      x={textX}
                      y={textY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${textRotation}, ${textX}, ${textY})`}
                      fill="white"
                      fontSize="3.2"
                      fontWeight="600"
                    >
                      {FORFEIT_EMOJIS[i]}
                    </text>
                  </g>
                );
              })}
              <circle cx="100" cy="100" r="12" fill="#0a0a0f" stroke="#d4a843" strokeWidth="2" />
              <text x="100" y="100" textAnchor="middle" dominantBaseline="middle" fill="#d4a843" fontSize="8" fontWeight="bold">
                SPIN
              </text>
            </svg>
          </div>
        </div>

        {/* Spin button */}
        <div className="mt-4 flex flex-col items-center gap-3 w-full max-w-xs">
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Commissioner passcode"
            className="w-full bg-dark border border-dark-border rounded-lg px-3 py-2 text-cream text-sm placeholder:text-cream/20 text-center"
          />
          <button
            type="button"
            onClick={handleSpin}
            disabled={spinning || !passcode}
            className="w-full bg-wc-gold text-dark font-bold py-3 rounded-lg hover:bg-wc-gold/90 disabled:opacity-40 transition-all cursor-pointer text-lg tracking-wide"
          >
            {spinning ? "Spinning..." : "SPIN THE WHEEL"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-wc-red/20 border border-wc-red/40 rounded-lg p-3 text-sm text-red-300 text-center">
          {error}
        </div>
      )}

      {/* Result */}
      {showResult && result && (
        <div className="bg-dark-card border-2 border-wc-gold rounded-lg p-6 text-center space-y-3 animate-bounce">
          <div className="text-4xl">{FORFEIT_EMOJIS[result.forfeitIndex]}</div>
          <div className="text-xs text-cream/40 uppercase tracking-wider">
            The forfeit is...
          </div>
          <div className="text-xl font-serif font-bold text-wc-gold">
            {result.forfeit}
          </div>
          {woodenSpoon && (
            <div className="text-sm text-cream/60">
              {woodenSpoon.name} must complete this forfeit!
            </div>
          )}
        </div>
      )}

      {/* Past spins */}
      {pastSpins.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-serif text-xl font-bold text-wc-gold border-b border-dark-border pb-2">
            Past Forfeits
          </h2>
          <div className="space-y-2">
            {pastSpins.map((spin) => (
              <div
                key={spin.id}
                className="bg-dark-card border border-dark-border rounded-lg px-4 py-3 flex items-center justify-between"
              >
                <span className="text-sm text-cream/80">{spin.forfeit}</span>
                <span className="text-xs text-cream/30">
                  {new Date(spin.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forfeit list reference */}
      <details className="bg-dark-card border border-dark-border rounded-lg">
        <summary className="px-4 py-3 text-sm text-cream/60 cursor-pointer hover:text-cream transition-colors">
          All possible forfeits ({FORFEITS.length})
        </summary>
        <div className="px-4 pb-3 space-y-1">
          {FORFEITS.map((f, i) => (
            <div key={i} className="text-xs text-cream/40 flex items-center gap-2">
              <span>{FORFEIT_EMOJIS[i]}</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
