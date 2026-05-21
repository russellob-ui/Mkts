"use client";

import { useState, useEffect } from "react";

interface PlayerOption {
  slug: string;
  name: string;
}

export default function SharePage() {
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  useEffect(() => {
    async function loadPlayers() {
      try {
        const res = await fetch("/api/leaderboard");
        const data = await res.json();
        const opts: PlayerOption[] = data.leaderboard.map(
          (p: { playerName: string }) => ({
            name: p.playerName,
            slug: p.playerName.toLowerCase().replace(/\s+/g, "-"),
          })
        );
        setPlayers(opts);
        if (opts.length > 0) setSelectedSlug(opts[0].slug);
      } catch {
        // silent
      }
    }
    loadPlayers();
  }, []);

  function generateImage(type: "draw" | "standings") {
    if (!selectedSlug) return;
    setLoading(true);
    const url = `/api/share-card?playerSlug=${encodeURIComponent(selectedSlug)}&type=${type}`;
    setImageUrl(url);
    setLoading(false);
  }

  async function downloadImage() {
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wc-sweep-${selectedSlug}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silent
    }
  }

  async function shareImage() {
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const file = new File([blob], `wc-sweep-${selectedSlug}.png`, {
        type: "image/png",
      });

      if (navigator.share) {
        await navigator.share({
          title: "WC Sweep 2026",
          text: "Check out my World Cup Sweep!",
          files: [file],
        });
      }
    } catch {
      // User cancelled or share not supported
    }
  }

  return (
    <div className="min-h-screen bg-dark text-cream">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-serif font-bold mb-2">
          <span className="text-wc-gold">Share</span> Card
        </h1>
        <p className="text-cream/50 text-sm mb-6">
          Generate a branded image of your draw or the leaderboard to share with friends.
        </p>

        <div className="bg-dark-card border border-dark-border rounded-xl p-4 mb-6">
          <label className="text-xs text-cream/50 block mb-1">Player</label>
          <select
            value={selectedSlug}
            onChange={(e) => {
              setSelectedSlug(e.target.value);
              setImageUrl(null);
            }}
            className="w-full bg-dark border border-dark-border rounded-lg px-3 py-2 text-sm text-cream mb-4"
          >
            {players.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => generateImage("draw")}
              disabled={loading || !selectedSlug}
              className="bg-wc-gold text-dark font-bold py-3 rounded-lg hover:bg-wc-gold/90 disabled:opacity-40 transition-colors cursor-pointer"
            >
              My Draw
            </button>
            <button
              onClick={() => generateImage("standings")}
              disabled={loading || !selectedSlug}
              className="bg-wc-blue text-cream font-bold py-3 rounded-lg hover:bg-wc-blue/90 disabled:opacity-40 transition-colors cursor-pointer"
            >
              Leaderboard
            </button>
          </div>
        </div>

        {imageUrl && (
          <div className="space-y-4">
            <div className="bg-dark-card border border-dark-border rounded-xl p-2 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Share card preview"
                className="w-full rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={downloadImage}
                className="bg-dark-card border border-dark-border text-cream font-bold py-3 rounded-lg hover:bg-dark-border transition-colors cursor-pointer"
              >
                Download
              </button>
              {canShare && (
                <button
                  onClick={shareImage}
                  className="bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-500 transition-colors cursor-pointer"
                >
                  Share
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
