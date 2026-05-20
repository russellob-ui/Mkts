import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  players,
  wcTeams,
  teamAssignments,
  matches,
  pointsLog,
} from "@/db/schema";
import { and, gte, lte, eq } from "drizzle-orm";
import { sendDigestEmail } from "@/lib/send-email";
import { sendWhatsAppGroupMessage } from "@/lib/whatsapp";
import { getTierMultiplier } from "@/lib/api-football";

export const dynamic = "force-dynamic";

let tablesEnsured = false;

const WC_START = new Date("2026-06-11T00:00:00Z");

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function computeMatchDay(now: Date): number {
  const diff = now.getTime() - WC_START.getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDateUK(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/London",
  });
}

function formatTimeUK(d: Date): string {
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

function medalOrRank(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}.`;
}

export async function GET() {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    // Load base data
    const allPlayers = await db.select().from(players);
    const allTeams = await db.select().from(wcTeams);
    const allAssignments = await db.select().from(teamAssignments);
    const allPoints = await db.select().from(pointsLog);

    type Team = (typeof allTeams)[number];
    type Assignment = (typeof allAssignments)[number];

    const teamById = new Map<number, Team>(allTeams.map((t) => [t.id, t]));
    const assignByTeam = new Map<number, Assignment>(
      allAssignments.map((a) => [a.teamId, a])
    );
    const playerNameById = new Map<number, string>(
      allPlayers.map((p) => [p.id, p.name])
    );

    // Yesterday's date window
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday);
    yesterdayEnd.setHours(23, 59, 59, 999);

    // Today's date window
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Yesterday's finished matches
    const yesterdayMatches = await db
      .select()
      .from(matches)
      .where(
        and(
          gte(matches.kickoff, yesterday),
          lte(matches.kickoff, yesterdayEnd),
          eq(matches.status, "finished")
        )
      );

    // Today's scheduled matches
    const todayMatches = await db
      .select()
      .from(matches)
      .where(
        and(gte(matches.kickoff, today), lte(matches.kickoff, todayEnd))
      );

    // Sort today's matches by kickoff time
    todayMatches.sort(
      (a, b) =>
        new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
    );

    // Build a map of match points per player (for yesterday's results)
    // matchId -> playerId -> total points
    const matchPlayerPoints = new Map<number, Map<number, number>>();
    for (const m of yesterdayMatches) {
      const ptsForMatch = allPoints.filter((pt) => pt.matchId === m.id);
      const playerPts = new Map<number, number>();
      for (const pt of ptsForMatch) {
        playerPts.set(pt.playerId, (playerPts.get(pt.playerId) ?? 0) + pt.points);
      }
      matchPlayerPoints.set(m.id, playerPts);
    }

    // Current leaderboard
    const standings = allPlayers
      .map((p) => {
        const pAssign = allAssignments.filter((a) => a.playerId === p.id);
        const total = pAssign.reduce((sum, a) => {
          return (
            sum +
            allPoints
              .filter(
                (pt) => pt.playerId === p.id && pt.teamId === a.teamId
              )
              .reduce((s, pt) => s + pt.points, 0)
          );
        }, 0);
        return {
          playerId: p.id,
          name: p.name,
          color: p.color ?? "#ffffff",
          totalPoints: Math.round(total * 10) / 10,
        };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);

    // Compute previous day's standings for rank change arrows
    const yesterdayPointIds = new Set(
      allPoints
        .filter((p) => {
          const c = p.createdAt ? new Date(p.createdAt) : null;
          return c && c >= yesterday;
        })
        .map((p) => p.id)
    );
    const previousStandings = allPlayers
      .map((p) => {
        const pAssign = allAssignments.filter((a) => a.playerId === p.id);
        const total = pAssign.reduce((sum, a) => {
          return (
            sum +
            allPoints
              .filter(
                (pt) =>
                  pt.playerId === p.id &&
                  pt.teamId === a.teamId &&
                  !yesterdayPointIds.has(pt.id)
              )
              .reduce((s, pt) => s + pt.points, 0)
          );
        }, 0);
        return { playerId: p.id, totalPoints: Math.round(total * 10) / 10 };
      })
      .sort((a, b) => b.totalPoints - a.totalPoints);

    const prevRankMap = new Map<number, number>(
      previousStandings.map((s, i) => [s.playerId, i + 1])
    );

    const matchDay = computeMatchDay(now);
    const dateStr = formatDateUK(now);
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "https://wc-sweep.vercel.app");

    // ---- Helper: get owner name for a team ----
    function ownerName(teamId: number): string {
      const assignment = assignByTeam.get(teamId);
      if (!assignment) return "Unassigned";
      return playerNameById.get(assignment.playerId) ?? "Unknown";
    }

    function ownerPlayerId(teamId: number): number | null {
      const assignment = assignByTeam.get(teamId);
      return assignment?.playerId ?? null;
    }

    // ======================================
    // A) WhatsApp group message
    // ======================================

    let todayMatchLines: string;
    if (todayMatches.length > 0) {
      todayMatchLines = todayMatches
        .map((m) => {
          const home = teamById.get(m.homeTeamId);
          const away = teamById.get(m.awayTeamId);
          const time = formatTimeUK(new Date(m.kickoff));
          const hFlag = home?.flagEmoji ?? "";
          const aFlag = away?.flagEmoji ?? "";
          const hOwner = ownerName(m.homeTeamId);
          const aOwner = ownerName(m.awayTeamId);
          return `🏟️ ${time} ${hFlag} ${home?.name ?? "?"} vs ${away?.name ?? "?"} ${aFlag}\n   _${hOwner} vs ${aOwner}_`;
        })
        .join("\n\n");
    } else {
      todayMatchLines = "No matches today";
    }

    const leaderboardLines = standings
      .map((s, i) => {
        const rank = i + 1;
        const medal = medalOrRank(rank);
        const prevRank = prevRankMap.get(s.playerId) ?? rank;
        const diff = prevRank - rank;
        let arrow = "";
        if (diff > 0) arrow = ` ↑${diff}`;
        else if (diff < 0) arrow = ` ↓${Math.abs(diff)}`;
        return `${medal} ${s.name} — ${s.totalPoints} pts${arrow}`;
      })
      .join("\n");

    let yesterdayResultsSection = "";
    if (yesterdayMatches.length > 0) {
      const resultLines = yesterdayMatches
        .map((m) => {
          const home = teamById.get(m.homeTeamId);
          const away = teamById.get(m.awayTeamId);
          const hFlag = home?.flagEmoji ?? "";
          const aFlag = away?.flagEmoji ?? "";
          const playerPts = matchPlayerPoints.get(m.id);
          // Determine winner owner + points
          let winInfo = "";
          if (
            m.homeScore != null &&
            m.awayScore != null &&
            m.homeScore > m.awayScore
          ) {
            const homeOwnerId = ownerPlayerId(m.homeTeamId);
            const pts = homeOwnerId != null ? (playerPts?.get(homeOwnerId) ?? 0) : 0;
            winInfo = ` — ${ownerName(m.homeTeamId)} +${Math.round(pts * 10) / 10}`;
          } else if (
            m.homeScore != null &&
            m.awayScore != null &&
            m.awayScore > m.homeScore
          ) {
            const awayOwnerId = ownerPlayerId(m.awayTeamId);
            const pts = awayOwnerId != null ? (playerPts?.get(awayOwnerId) ?? 0) : 0;
            winInfo = ` — ${ownerName(m.awayTeamId)} +${Math.round(pts * 10) / 10}`;
          } else {
            winInfo = " — Draw";
          }
          return `${hFlag} ${home?.name ?? "?"} ${m.homeScore ?? 0}-${m.awayScore ?? 0} ${away?.name ?? "?"} ${aFlag}${winInfo}`;
        })
        .join("\n");

      yesterdayResultsSection = `\n━━━━━━━━━━━━━━━\n\n📊 *YESTERDAY'S RESULTS*\n${resultLines}`;
    }

    const waMsg =
      `☀️ *MATCH DAY ${matchDay}* — ${dateStr}\n\n` +
      `⚽ *TODAY'S MATCHES*\n\n${todayMatchLines}\n\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `🏆 *LEADERBOARD*\n${leaderboardLines}` +
      `${yesterdayResultsSection}\n\n` +
      `━━━━━━━━━━━━━━━\n\n` +
      `🎯 *DON'T FORGET*\n` +
      `• Submit predictions before kickoff\n` +
      `• Daily quiz is live\n` +
      `• Prop bets close at first kickoff\n\n` +
      `📱 Open app → ${appUrl}`;

    // ======================================
    // B) Personalized email per player
    // ======================================

    let sent = 0;
    let errors = 0;

    for (const player of allPlayers) {
      if (!player.email) continue;

      // Parse notification preferences
      let prefs: Record<string, boolean> = {};
      try {
        if (player.notificationPrefs) {
          prefs = JSON.parse(player.notificationPrefs);
        }
      } catch {
        // default to all enabled
      }

      // If emailDigest is explicitly disabled, skip
      if (prefs.emailDigest === false) continue;

      const playerAssignments = allAssignments.filter(
        (a) => a.playerId === player.id
      );
      const playerTeamIds = new Set(playerAssignments.map((a) => a.teamId));

      // Player's rank
      const playerRank =
        standings.findIndex((s) => s.playerId === player.id) + 1;
      const playerTotal =
        standings.find((s) => s.playerId === player.id)?.totalPoints ?? 0;

      // Player's teams playing today
      const teamsPlayingToday = todayMatches.filter(
        (m) =>
          playerTeamIds.has(m.homeTeamId) || playerTeamIds.has(m.awayTeamId)
      );

      // Build "Your Teams Today" cards
      let yourTeamsTodayHtml = "";
      if (teamsPlayingToday.length > 0) {
        const cards = teamsPlayingToday
          .map((m) => {
            const isHome = playerTeamIds.has(m.homeTeamId);
            const myTeamId = isHome ? m.homeTeamId : m.awayTeamId;
            const oppTeamId = isHome ? m.awayTeamId : m.homeTeamId;
            const myTeam = teamById.get(myTeamId);
            const oppTeam = teamById.get(oppTeamId);
            const multiplier = myTeam
              ? getTierMultiplier(myTeam.tier)
              : 1;
            const kickoff = formatTimeUK(new Date(m.kickoff));
            return `<div style="margin:0 15px 10px;background:#141420;border:1px solid #252540;border-radius:8px;padding:15px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <td style="font-size:14px;">
        <span style="font-size:20px;">${myTeam?.flagEmoji ?? ""}</span>
        <strong style="color:#f5f1e8;">${escHtml(myTeam?.name ?? "?")}</strong>
        <span style="color:#d4a843;font-size:12px;">x${multiplier}</span>
      </td>
      <td style="text-align:right;font-size:13px;color:#f5f1e899;">
        vs ${escHtml(oppTeam?.name ?? "?")}<br>
        <strong>${kickoff}</strong>
      </td>
    </tr>
  </table>
</div>`;
          })
          .join("\n");

        yourTeamsTodayHtml = `
<div style="padding:15px 20px;">
  <h2 style="color:#d4a843;font-size:16px;margin:0 0 10px;border-bottom:1px solid #252540;padding-bottom:8px;">⚽ Your Teams Today</h2>
</div>
${cards}`;
      }

      // Build "Yesterday's Results" section
      let yesterdayResultsHtml = "";
      if (yesterdayMatches.length > 0) {
        const resultCards = yesterdayMatches
          .map((m) => {
            const home = teamById.get(m.homeTeamId);
            const away = teamById.get(m.awayTeamId);
            const hFlag = home?.flagEmoji ?? "";
            const aFlag = away?.flagEmoji ?? "";
            const playerPts = matchPlayerPoints.get(m.id);
            // Points info
            let ptsLine = "";
            if (
              m.homeScore != null &&
              m.awayScore != null &&
              m.homeScore > m.awayScore
            ) {
              const homeOwnerId = ownerPlayerId(m.homeTeamId);
              const pts = homeOwnerId != null ? (playerPts?.get(homeOwnerId) ?? 0) : 0;
              ptsLine = `${escHtml(ownerName(m.homeTeamId))} +${Math.round(pts * 10) / 10} pts`;
            } else if (
              m.homeScore != null &&
              m.awayScore != null &&
              m.awayScore > m.homeScore
            ) {
              const awayOwnerId = ownerPlayerId(m.awayTeamId);
              const pts = awayOwnerId != null ? (playerPts?.get(awayOwnerId) ?? 0) : 0;
              ptsLine = `${escHtml(ownerName(m.awayTeamId))} +${Math.round(pts * 10) / 10} pts`;
            } else {
              ptsLine = "Draw — both owners share pts";
            }
            return `<div style="background:#141420;border:1px solid #252540;border-radius:6px;padding:10px 12px;margin-bottom:8px;">
  <div style="text-align:center;font-size:14px;">
    ${hFlag} <strong>${escHtml(home?.name ?? "?")}</strong> ${m.homeScore ?? 0} - ${m.awayScore ?? 0} <strong>${escHtml(away?.name ?? "?")}</strong> ${aFlag}
  </div>
  <div style="text-align:center;font-size:12px;color:#d4a843;margin-top:4px;">
    ${ptsLine}
  </div>
</div>`;
          })
          .join("\n");

        yesterdayResultsHtml = `
<div style="padding:15px 20px;">
  <h2 style="color:#d4a843;font-size:16px;margin:0 0 10px;border-bottom:1px solid #252540;padding-bottom:8px;">Yesterday's Results</h2>
  ${resultCards}
</div>`;
      }

      // Build leaderboard table
      const leaderboardRows = standings
        .map((s, i) => {
          const rank = i + 1;
          const medal = medalOrRank(rank);
          const isCurrentPlayer = s.playerId === player.id;
          const prevRank = prevRankMap.get(s.playerId) ?? rank;
          const diff = prevRank - rank;
          let arrow = "";
          if (diff > 0) arrow = ` <span style="color:#4caf50;">↑${diff}</span>`;
          else if (diff < 0)
            arrow = ` <span style="color:#f44336;">↓${Math.abs(diff)}</span>`;

          const borderLeft = isCurrentPlayer
            ? "border-left:3px solid #d4a843;"
            : "";
          const nameWeight = isCurrentPlayer ? "font-weight:bold;" : "";

          return `<tr style="border-bottom:1px solid #252540;${borderLeft}">
  <td style="padding:8px 5px;width:30px;">${medal}</td>
  <td style="padding:8px 5px;${nameWeight}">${escHtml(s.name)}${arrow}</td>
  <td style="padding:8px 5px;text-align:right;color:#d4a843;font-weight:bold;">${s.totalPoints}</td>
</tr>`;
        })
        .join("\n");

      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0f;">
<div style="background:#0a0a0f;color:#f5f1e8;font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:0;">

  <!-- Hero banner -->
  <div style="background:linear-gradient(135deg,#1a237e,#8a1538);padding:30px 20px;text-align:center;">
    <div style="font-size:36px;">⚽</div>
    <h1 style="color:#d4a843;margin:10px 0 5px;font-size:24px;">WC SWEEP 2026</h1>
    <p style="color:#f5f1e8;opacity:0.7;margin:0;font-size:14px;">Match Day ${matchDay} — ${escHtml(dateStr)}</p>
  </div>

  <!-- Personal greeting -->
  <div style="padding:20px;text-align:center;">
    <p style="font-size:18px;margin:0;">Good morning, <strong style="color:#d4a843;">${escHtml(player.name)}</strong></p>
    <p style="opacity:0.5;font-size:13px;margin:5px 0 0;">You're currently <strong>#${playerRank}</strong> with <strong style="color:#d4a843;">${playerTotal} pts</strong></p>
  </div>

  <!-- Your Teams Today -->
  ${yourTeamsTodayHtml}

  <!-- Yesterday's Results -->
  ${yesterdayResultsHtml}

  <!-- Leaderboard -->
  <div style="padding:15px 20px;">
    <h2 style="color:#d4a843;font-size:16px;margin:0 0 10px;border-bottom:1px solid #252540;padding-bottom:8px;">🏆 Leaderboard</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      ${leaderboardRows}
    </table>
  </div>

  <!-- Action Required -->
  <div style="padding:15px 20px;">
    <h2 style="color:#d4a843;font-size:16px;margin:0 0 10px;border-bottom:1px solid #252540;padding-bottom:8px;">🎯 Action Required</h2>
    <a href="${appUrl}/predictions" style="display:block;background:#1a237e;color:#f5f1e8;text-align:center;padding:12px;border-radius:6px;text-decoration:none;font-weight:bold;margin-bottom:8px;">Submit Predictions →</a>
    <a href="${appUrl}/quiz" style="display:block;background:#00695c;color:#f5f1e8;text-align:center;padding:12px;border-radius:6px;text-decoration:none;font-weight:bold;margin-bottom:8px;">Play Daily Quiz →</a>
  </div>

  <!-- Footer -->
  <div style="padding:20px;text-align:center;border-top:1px solid #252540;">
    <p style="font-size:11px;color:#f5f1e844;margin:0;">
      WC Sweep 2026 · Bragging rights only<br>
      <a href="${appUrl}" style="color:#d4a843;text-decoration:none;">Open the app</a>
    </p>
  </div>

</div>
</body>
</html>`;

      const result = await sendDigestEmail(player.email, player.name, html);
      if (result.success) {
        sent++;
      } else {
        errors++;
      }
    }

    // Send WhatsApp group summary
    let whatsappSent = false;
    try {
      whatsappSent = await sendWhatsAppGroupMessage(waMsg);
    } catch (err) {
      console.error("[Daily Digest] WhatsApp failed:", err);
    }

    return NextResponse.json({
      sent,
      errors,
      whatsappSent,
      totalPlayers: allPlayers.length,
      playersWithEmail: allPlayers.filter((p) => p.email).length,
    });
  } catch (err) {
    console.error("[Daily Digest Cron]", err);
    return NextResponse.json(
      { error: "Failed to send daily digest" },
      { status: 500 }
    );
  }
}
