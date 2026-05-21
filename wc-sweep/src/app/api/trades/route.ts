import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import {
  players,
  wcTeams,
  teamAssignments,
  tradeProposals,
} from "@/db/schema";
import { eq, sql, desc, and } from "drizzle-orm";

let tablesEnsured = false;

export async function GET() {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const proposals = await db
      .select({
        id: tradeProposals.id,
        proposerPlayerId: tradeProposals.proposerPlayerId,
        proposerTeamId: tradeProposals.proposerTeamId,
        targetPlayerId: tradeProposals.targetPlayerId,
        targetTeamId: tradeProposals.targetTeamId,
        status: tradeProposals.status,
        proposedAt: tradeProposals.proposedAt,
        resolvedAt: tradeProposals.resolvedAt,
      })
      .from(tradeProposals)
      .orderBy(desc(tradeProposals.proposedAt));

    const allPlayers = await db.select().from(players);
    const allTeams = await db.select().from(wcTeams);

    // Count completed trades per player
    const completedCounts: Record<number, number> = {};
    for (const p of proposals) {
      if (p.status === "accepted") {
        completedCounts[p.proposerPlayerId] =
          (completedCounts[p.proposerPlayerId] || 0) + 1;
        completedCounts[p.targetPlayerId] =
          (completedCounts[p.targetPlayerId] || 0) + 1;
      }
    }

    const enriched = proposals.map((p) => {
      const proposer = allPlayers.find((pl) => pl.id === p.proposerPlayerId);
      const target = allPlayers.find((pl) => pl.id === p.targetPlayerId);
      const proposerTeam = allTeams.find((t) => t.id === p.proposerTeamId);
      const targetTeam = allTeams.find((t) => t.id === p.targetTeamId);
      return {
        ...p,
        proposedAt: p.proposedAt?.toISOString() ?? null,
        resolvedAt: p.resolvedAt?.toISOString() ?? null,
        proposerName: proposer?.name ?? "?",
        targetName: target?.name ?? "?",
        proposerTeamName: proposerTeam?.name ?? "?",
        proposerTeamFlag: proposerTeam?.flagEmoji ?? "🏳️",
        targetTeamName: targetTeam?.name ?? "?",
        targetTeamFlag: targetTeam?.flagEmoji ?? "🏳️",
      };
    });

    return NextResponse.json({
      trades: enriched,
      completedCounts,
    });
  } catch (err) {
    console.error("[Trades GET]", err);
    return NextResponse.json(
      { error: "Failed to load trades" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const body = await request.json();

    // Handle accept/reject
    if (body.tradeId && body.action) {
      const { tradeId, action, passcode } = body;

      if (!["accept", "reject"].includes(action)) {
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
      }

      // Get the trade
      const [trade] = await db
        .select()
        .from(tradeProposals)
        .where(eq(tradeProposals.id, tradeId));

      if (!trade) {
        return NextResponse.json(
          { error: "Trade not found" },
          { status: 404 }
        );
      }

      if (trade.status !== "pending") {
        return NextResponse.json(
          { error: "Trade already resolved" },
          { status: 400 }
        );
      }

      // Verify passcode belongs to the target player
      const [targetPlayer] = await db
        .select()
        .from(players)
        .where(eq(players.id, trade.targetPlayerId));

      if (!targetPlayer || targetPlayer.passcode !== passcode) {
        return NextResponse.json(
          { error: "Invalid passcode" },
          { status: 403 }
        );
      }

      if (action === "reject") {
        await db
          .update(tradeProposals)
          .set({ status: "rejected", resolvedAt: new Date() })
          .where(eq(tradeProposals.id, tradeId));

        return NextResponse.json({ ok: true, status: "rejected" });
      }

      // Accept: check trade limit (1 per tournament per player)
      const allTrades = await db
        .select()
        .from(tradeProposals)
        .where(eq(tradeProposals.status, "accepted"));

      const proposerCompleted = allTrades.filter(
        (t) =>
          t.proposerPlayerId === trade.proposerPlayerId ||
          t.targetPlayerId === trade.proposerPlayerId
      ).length;
      const targetCompleted = allTrades.filter(
        (t) =>
          t.proposerPlayerId === trade.targetPlayerId ||
          t.targetPlayerId === trade.targetPlayerId
      ).length;

      if (proposerCompleted >= 1) {
        return NextResponse.json(
          { error: "Proposer has already used their trade" },
          { status: 400 }
        );
      }
      if (targetCompleted >= 1) {
        return NextResponse.json(
          { error: "You have already used your trade" },
          { status: 400 }
        );
      }

      // Check neither team is eliminated
      const [proposerTeam] = await db
        .select()
        .from(wcTeams)
        .where(eq(wcTeams.id, trade.proposerTeamId));
      const [targetTeam] = await db
        .select()
        .from(wcTeams)
        .where(eq(wcTeams.id, trade.targetTeamId));

      if (proposerTeam?.eliminated) {
        return NextResponse.json(
          { error: `${proposerTeam.name} has been eliminated` },
          { status: 400 }
        );
      }
      if (targetTeam?.eliminated) {
        return NextResponse.json(
          { error: `${targetTeam.name} has been eliminated` },
          { status: 400 }
        );
      }

      // Swap the team_assignments
      // Find the two assignment rows
      const [proposerAssignment] = await db
        .select()
        .from(teamAssignments)
        .where(
          and(
            eq(teamAssignments.playerId, trade.proposerPlayerId),
            eq(teamAssignments.teamId, trade.proposerTeamId)
          )
        );
      const [targetAssignment] = await db
        .select()
        .from(teamAssignments)
        .where(
          and(
            eq(teamAssignments.playerId, trade.targetPlayerId),
            eq(teamAssignments.teamId, trade.targetTeamId)
          )
        );

      if (!proposerAssignment || !targetAssignment) {
        return NextResponse.json(
          { error: "Team assignment not found - teams may have changed" },
          { status: 400 }
        );
      }

      // Swap: proposer's team goes to target, target's team goes to proposer
      await db
        .update(teamAssignments)
        .set({ playerId: trade.targetPlayerId })
        .where(eq(teamAssignments.id, proposerAssignment.id));

      await db
        .update(teamAssignments)
        .set({ playerId: trade.proposerPlayerId })
        .where(eq(teamAssignments.id, targetAssignment.id));

      // Mark trade as accepted
      await db
        .update(tradeProposals)
        .set({ status: "accepted", resolvedAt: new Date() })
        .where(eq(tradeProposals.id, tradeId));

      return NextResponse.json({ ok: true, status: "accepted" });
    }

    // Create new trade proposal
    const { proposerPlayerId, proposerTeamId, targetPlayerId, targetTeamId, passcode } = body;

    if (!proposerPlayerId || !proposerTeamId || !targetPlayerId || !targetTeamId || !passcode) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify passcode
    const [proposer] = await db
      .select()
      .from(players)
      .where(eq(players.id, proposerPlayerId));

    if (!proposer || proposer.passcode !== passcode) {
      return NextResponse.json(
        { error: "Invalid passcode" },
        { status: 403 }
      );
    }

    // Check trade limit
    const existingAccepted = await db
      .select()
      .from(tradeProposals)
      .where(eq(tradeProposals.status, "accepted"));

    const proposerUsed = existingAccepted.filter(
      (t) =>
        t.proposerPlayerId === proposerPlayerId ||
        t.targetPlayerId === proposerPlayerId
    ).length;

    if (proposerUsed >= 1) {
      return NextResponse.json(
        { error: "You have already used your trade" },
        { status: 400 }
      );
    }

    // Verify proposer owns the team
    const [proposerOwns] = await db
      .select()
      .from(teamAssignments)
      .where(
        and(
          eq(teamAssignments.playerId, proposerPlayerId),
          eq(teamAssignments.teamId, proposerTeamId)
        )
      );

    if (!proposerOwns) {
      return NextResponse.json(
        { error: "You don't own that team" },
        { status: 400 }
      );
    }

    // Verify target owns their team
    const [targetOwns] = await db
      .select()
      .from(teamAssignments)
      .where(
        and(
          eq(teamAssignments.playerId, targetPlayerId),
          eq(teamAssignments.teamId, targetTeamId)
        )
      );

    if (!targetOwns) {
      return NextResponse.json(
        { error: "Target player doesn't own that team" },
        { status: 400 }
      );
    }

    // Check neither team is eliminated
    const [pTeam] = await db
      .select()
      .from(wcTeams)
      .where(eq(wcTeams.id, proposerTeamId));
    const [tTeam] = await db
      .select()
      .from(wcTeams)
      .where(eq(wcTeams.id, targetTeamId));

    if (pTeam?.eliminated) {
      return NextResponse.json(
        { error: `${pTeam.name} has been eliminated` },
        { status: 400 }
      );
    }
    if (tTeam?.eliminated) {
      return NextResponse.json(
        { error: `${tTeam.name} has been eliminated` },
        { status: 400 }
      );
    }

    // Check no pending proposal already exists between these players
    const existingPending = await db
      .select()
      .from(tradeProposals)
      .where(
        and(
          eq(tradeProposals.proposerPlayerId, proposerPlayerId),
          eq(tradeProposals.targetPlayerId, targetPlayerId),
          eq(tradeProposals.status, "pending")
        )
      );

    if (existingPending.length > 0) {
      return NextResponse.json(
        { error: "You already have a pending trade with this player" },
        { status: 400 }
      );
    }

    await db.insert(tradeProposals).values({
      proposerPlayerId,
      proposerTeamId,
      targetPlayerId,
      targetTeamId,
      status: "pending",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Trades POST]", err);
    return NextResponse.json(
      { error: "Failed to process trade" },
      { status: 500 }
    );
  }
}
