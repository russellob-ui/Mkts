import { ImageResponse } from "next/og";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  players,
  wcTeams,
  teamAssignments,
  pointsLog,
} from "@/db/schema";
import { eq } from "drizzle-orm";

let tablesEnsured = false;

const TIER_LABELS: Record<number, string> = {
  1: "T1",
  2: "T2",
  3: "T3",
  4: "T4",
};

const TIER_COLORS: Record<number, string> = {
  1: "#ffd700",
  2: "#c0c0c0",
  3: "#cd7f32",
  4: "#22c55e",
};

export async function GET(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const { searchParams } = new URL(request.url);
    const playerSlug = searchParams.get("playerSlug");
    const type = searchParams.get("type") ?? "draw";

    const allPlayers = await db.select().from(players);
    const allTeams = await db.select().from(wcTeams);
    const allAssignments = await db.select().from(teamAssignments);
    const allPoints = await db.select().from(pointsLog);

    if (type === "draw") {
      const player = allPlayers.find((p) => p.slug === playerSlug);
      if (!player) {
        return new Response("Player not found", { status: 404 });
      }

      const playerAssignments = allAssignments.filter(
        (a) => a.playerId === player.id
      );
      const playerTeams = playerAssignments.map((a) => {
        const team = allTeams.find((t) => t.id === a.teamId);
        return {
          name: team?.name ?? "?",
          flagEmoji: team?.flagEmoji ?? "🏳️",
          tier: team?.tier ?? 1,
        };
      });
      playerTeams.sort((a, b) => a.tier - b.tier);

      return new ImageResponse(
        (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 50%, #0a0a1a 100%)",
              fontFamily: "sans-serif",
              padding: "40px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "16px",
                fontSize: "24px",
                letterSpacing: "4px",
                textTransform: "uppercase" as const,
              }}
            >
              <span style={{ color: "#d4a843" }}>WC</span>
              <span style={{ color: "#f5f1e8", marginLeft: "8px" }}>
                SWEEP 2026
              </span>
            </div>

            <div
              style={{
                display: "flex",
                fontSize: "36px",
                fontWeight: 700,
                color: "#f5f1e8",
                marginBottom: "32px",
              }}
            >
              {player.name}&apos;s Draw
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                width: "100%",
                maxWidth: "500px",
              }}
            >
              {playerTeams.map((team, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "12px 20px",
                    background: "rgba(255,255,255,0.06)",
                    borderRadius: "12px",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <span style={{ fontSize: "28px", marginRight: "12px" }}>
                    {team.flagEmoji}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: "20px",
                      color: "#f5f1e8",
                      fontWeight: 600,
                    }}
                  >
                    {team.name}
                  </span>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: TIER_COLORS[team.tier] ?? "#aaa",
                      background: "rgba(0,0,0,0.3)",
                      padding: "4px 10px",
                      borderRadius: "6px",
                    }}
                  >
                    {TIER_LABELS[team.tier] ?? `T${team.tier}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ),
        { width: 600, height: 600 }
      );
    }

    // type === "standings"
    const leaderboard = allPlayers
      .map((player) => {
        const pAssignments = allAssignments.filter(
          (a) => a.playerId === player.id
        );
        const totalPoints = pAssignments.reduce((sum, a) => {
          const pts = allPoints
            .filter((p) => p.playerId === player.id && p.teamId === a.teamId)
            .reduce((s, p) => s + p.points, 0);
          return sum + pts;
        }, 0);
        return {
          name: player.name,
          slug: player.slug,
          color: player.color ?? "#ffffff",
          totalPoints: Math.round(totalPoints * 10) / 10,
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            background: "linear-gradient(135deg, #0a0a1a 0%, #1a1a3a 50%, #0a0a1a 100%)",
            fontFamily: "sans-serif",
            padding: "40px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginBottom: "12px",
              fontSize: "24px",
              letterSpacing: "4px",
              textTransform: "uppercase" as const,
            }}
          >
            <span style={{ color: "#d4a843" }}>WC</span>
            <span style={{ color: "#f5f1e8", marginLeft: "8px" }}>
              SWEEP 2026
            </span>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: "28px",
              fontWeight: 700,
              color: "#f5f1e8",
              marginBottom: "24px",
            }}
          >
            Leaderboard
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              width: "100%",
              maxWidth: "480px",
            }}
          >
            {leaderboard.map((entry, i) => {
              const isHighlighted = entry.slug === playerSlug;
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "10px 16px",
                    background: isHighlighted
                      ? "rgba(212,168,67,0.2)"
                      : "rgba(255,255,255,0.04)",
                    borderRadius: "8px",
                    border: isHighlighted
                      ? "2px solid #d4a843"
                      : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "#999",
                      width: "30px",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: "18px",
                      fontWeight: isHighlighted ? 700 : 500,
                      color: isHighlighted ? "#d4a843" : "#f5f1e8",
                    }}
                  >
                    {entry.name}
                  </span>
                  <span
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      color: isHighlighted ? "#d4a843" : "#f5f1e8",
                    }}
                  >
                    {entry.totalPoints} pts
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ),
      { width: 600, height: 600 }
    );
  } catch (err) {
    console.error("[ShareCard]", err);
    return new Response("Failed to generate image", { status: 500 });
  }
}
