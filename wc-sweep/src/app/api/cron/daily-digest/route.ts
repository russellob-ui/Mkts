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

export const dynamic = "force-dynamic";

let tablesEnsured = false;

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
        and(
          gte(matches.kickoff, today),
          lte(matches.kickoff, todayEnd)
        )
      );

    // Points awarded yesterday
    const yesterdayPoints = allPoints.filter((p) => {
      const c = p.createdAt ? new Date(p.createdAt) : null;
      return c && c >= yesterday && c <= yesterdayEnd;
    });

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

    // Points by player for yesterday
    const playerPointsMap = new Map<
      number,
      { total: number; breakdown: string[] }
    >();
    for (const p of yesterdayPoints) {
      const existing = playerPointsMap.get(p.playerId);
      const team = teamById.get(p.teamId);
      const line = `${team?.flagEmoji ?? ""} ${team?.name ?? "?"}: ${p.points > 0 ? "+" : ""}${Math.round(p.points * 10) / 10} (${p.source.replace(/_/g, " ")})`;
      if (existing) {
        existing.total += p.points;
        existing.breakdown.push(line);
      } else {
        playerPointsMap.set(p.playerId, {
          total: p.points,
          breakdown: [line],
        });
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://wc-sweep.vercel.app";

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

      // Build "YOUR TEAMS TODAY" section
      const teamsPlayingToday = todayMatches.filter(
        (m) => playerTeamIds.has(m.homeTeamId) || playerTeamIds.has(m.awayTeamId)
      );

      // Build "YESTERDAY'S RESULTS"
      const yesterdayResults = yesterdayMatches
        .map((m) => {
          const home = teamById.get(m.homeTeamId);
          const away = teamById.get(m.awayTeamId);
          const homeOwner = assignByTeam.get(m.homeTeamId);
          const awayOwner = assignByTeam.get(m.awayTeamId);
          const isPlayerMatch =
            playerTeamIds.has(m.homeTeamId) || playerTeamIds.has(m.awayTeamId);
          return {
            label: `${home?.flagEmoji ?? ""} ${home?.name ?? "?"} ${m.homeScore ?? 0}-${m.awayScore ?? 0} ${away?.name ?? "?"} ${away?.flagEmoji ?? ""}`,
            homeOwner: homeOwner
              ? allPlayers.find((p) => p.id === homeOwner.playerId)?.name ??
                null
              : null,
            awayOwner: awayOwner
              ? allPlayers.find((p) => p.id === awayOwner.playerId)?.name ??
                null
              : null,
            isPlayerMatch,
          };
        })
        .sort((a, b) => (a.isPlayerMatch === b.isPlayerMatch ? 0 : a.isPlayerMatch ? -1 : 1));

      // Player's position in standings
      const playerRank = standings.findIndex(
        (s) => s.playerId === player.id
      ) + 1;
      const playerTotal = standings.find(
        (s) => s.playerId === player.id
      )?.totalPoints ?? 0;

      // Yesterday's points for this player
      const myPoints = playerPointsMap.get(player.id);

      // Build HTML email
      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0f;color:#f5f1e8;font-family:Inter,system-ui,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:20px;">

<div style="text-align:center;padding:24px 0;border-bottom:1px solid #252540;">
  <h1 style="margin:0;font-size:24px;font-family:Playfair Display,Georgia,serif;">
    <span style="color:#d4a843;">WC</span> Sweep 2026
  </h1>
</div>

<div style="padding:24px 0;">
  <h2 style="margin:0 0 8px 0;font-size:20px;color:#f5f1e8;">
    Good morning, ${escHtml(player.name)}!
  </h2>
  <p style="margin:0;color:#f5f1e8aa;font-size:14px;">
    Here's your World Cup Sweep update.
  </p>
</div>

${teamsPlayingToday.length > 0 ? `
<div style="background:#141420;border:1px solid #252540;border-radius:8px;padding:16px;margin-bottom:16px;">
  <h3 style="margin:0 0 12px 0;font-size:14px;color:#d4a843;text-transform:uppercase;letter-spacing:1px;">
    Your Teams Today
  </h3>
  ${teamsPlayingToday
    .map((m) => {
      const home = teamById.get(m.homeTeamId);
      const away = teamById.get(m.awayTeamId);
      const kickoff = m.kickoff
        ? new Date(m.kickoff).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/London",
          })
        : "TBC";
      return `<div style="padding:8px 0;border-bottom:1px solid #252540;">
        <span style="font-size:14px;">${home?.flagEmoji ?? ""} ${escHtml(home?.name ?? "?")} vs ${escHtml(away?.name ?? "?")} ${away?.flagEmoji ?? ""}</span>
        <span style="float:right;color:#d4a843;font-size:13px;">${kickoff}</span>
      </div>`;
    })
    .join("")}
</div>
` : ""}

${yesterdayResults.length > 0 ? `
<div style="background:#141420;border:1px solid #252540;border-radius:8px;padding:16px;margin-bottom:16px;">
  <h3 style="margin:0 0 12px 0;font-size:14px;color:#d4a843;text-transform:uppercase;letter-spacing:1px;">
    Yesterday's Results
  </h3>
  ${yesterdayResults
    .map(
      (r) =>
        `<div style="padding:8px 0;border-bottom:1px solid #252540;${r.isPlayerMatch ? "background:#d4a84310;" : ""}">
          <div style="font-size:14px;font-weight:${r.isPlayerMatch ? "bold" : "normal"};">
            ${escHtml(r.label)}
          </div>
          <div style="font-size:11px;color:#f5f1e866;margin-top:2px;">
            ${r.homeOwner ? escHtml(r.homeOwner) : "Unassigned"} vs ${r.awayOwner ? escHtml(r.awayOwner) : "Unassigned"}
          </div>
        </div>`
    )
    .join("")}
</div>
` : ""}

${myPoints ? `
<div style="background:#141420;border:1px solid #252540;border-radius:8px;padding:16px;margin-bottom:16px;">
  <h3 style="margin:0 0 12px 0;font-size:14px;color:#d4a843;text-transform:uppercase;letter-spacing:1px;">
    Your Points Yesterday: ${myPoints.total > 0 ? "+" : ""}${Math.round(myPoints.total * 10) / 10}
  </h3>
  ${myPoints.breakdown.map((line) => `<div style="font-size:13px;padding:4px 0;color:#f5f1e8cc;">${escHtml(line)}</div>`).join("")}
</div>
` : ""}

<div style="background:#141420;border:1px solid #252540;border-radius:8px;padding:16px;margin-bottom:16px;">
  <h3 style="margin:0 0 12px 0;font-size:14px;color:#d4a843;text-transform:uppercase;letter-spacing:1px;">
    Leaderboard
  </h3>
  ${standings
    .slice(0, 5)
    .map(
      (s, i) =>
        `<div style="padding:6px 0;display:flex;justify-content:space-between;font-size:14px;${s.playerId === player.id ? "color:#d4a843;font-weight:bold;" : "color:#f5f1e8cc;"}">
          <span>${i + 1}. ${escHtml(s.name)}</span>
          <span>${s.totalPoints} pts</span>
        </div>`
    )
    .join("")}
  ${playerRank > 5
    ? `<div style="padding:8px 0;margin-top:8px;border-top:1px solid #252540;font-size:14px;color:#d4a843;font-weight:bold;display:flex;justify-content:space-between;">
        <span>${playerRank}. ${escHtml(player.name)} (you)</span>
        <span>${playerTotal} pts</span>
      </div>`
    : ""}
</div>

<div style="background:#141420;border:1px solid #252540;border-radius:8px;padding:16px;margin-bottom:16px;">
  <h3 style="margin:0 0 8px 0;font-size:14px;color:#d4a843;">Don't forget!</h3>
  <p style="margin:0 0 4px 0;font-size:13px;color:#f5f1e8cc;">
    Play today's quiz and submit your predictions before kickoff.
  </p>
</div>

<div style="text-align:center;padding:24px 0;">
  <a href="${appUrl}" style="display:inline-block;background:#d4a843;color:#0a0a0f;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;">
    Open WC Sweep
  </a>
</div>

<div style="text-align:center;padding:16px 0;border-top:1px solid #252540;">
  <p style="margin:0;font-size:11px;color:#f5f1e844;">
    WC Sweep 2026 - Don't miss out!
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

    return NextResponse.json({
      sent,
      errors,
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
