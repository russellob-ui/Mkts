import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { superlativeVotes, players } from "@/db/schema";
import { eq, and } from "drizzle-orm";

let tablesEnsured = false;

const CATEGORIES = [
  "Best Banter 🎤",
  "Saltiest Loser 🧂",
  "Lucky Sod 🍀",
  "Most Active 💬",
  "Best Predictions 🔮",
  "Worst Luck 😢",
  "Best Team Name Combo 🎨",
  "Most Delusional 🤡",
];

export async function GET(request: NextRequest) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const { searchParams } = new URL(request.url);
    const voterId = searchParams.get("voterId");

    const allPlayers = await db.select().from(players);
    const allVotes = await db.select().from(superlativeVotes);

    // Build tallies per category
    const categories = CATEGORIES.map((cat) => {
      const votesForCat = allVotes.filter((v) => v.category === cat);
      const tally: Record<string, number> = {};
      for (const v of votesForCat) {
        tally[v.nomineePlayerSlug] = (tally[v.nomineePlayerSlug] ?? 0) + 1;
      }

      // Find leader
      let leader: { slug: string; name: string; count: number } | null = null;
      for (const [slug, count] of Object.entries(tally)) {
        if (!leader || count > leader.count) {
          const p = allPlayers.find((pl) => pl.slug === slug);
          leader = { slug, name: p?.name ?? slug, count };
        }
      }

      // Current voter's pick for this category
      let voterPick: string | null = null;
      if (voterId) {
        const vv = allVotes.find(
          (v) => v.voterId === Number(voterId) && v.category === cat
        );
        if (vv) voterPick = vv.nomineePlayerSlug;
      }

      return {
        category: cat,
        tally,
        leader,
        totalVotes: votesForCat.length,
        voterPick,
      };
    });

    return NextResponse.json({
      categories,
      players: allPlayers.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        color: p.color,
        avatarEmoji: p.avatarEmoji,
      })),
    });
  } catch (error) {
    console.error("[Superlatives GET] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const body = await request.json();
    const { voterId, category, nomineePlayerSlug, passcode } = body;

    if (!voterId || !category || !nomineePlayerSlug || !passcode) {
      return NextResponse.json(
        { error: "voterId, category, nomineePlayerSlug, and passcode are required" },
        { status: 400 }
      );
    }

    if (!CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: "Invalid category" },
        { status: 400 }
      );
    }

    // Validate passcode
    const allPlayers = await db.select().from(players);
    const voter = allPlayers.find(
      (p) => p.id === Number(voterId) && p.passcode === passcode
    );
    if (!voter) {
      return NextResponse.json(
        { error: "Invalid passcode" },
        { status: 401 }
      );
    }

    // Verify nominee exists
    const nominee = allPlayers.find((p) => p.slug === nomineePlayerSlug);
    if (!nominee) {
      return NextResponse.json(
        { error: "Nominee player not found" },
        { status: 404 }
      );
    }

    // Upsert: check if vote exists
    const existing = await db
      .select()
      .from(superlativeVotes)
      .where(
        and(
          eq(superlativeVotes.voterId, voter.id),
          eq(superlativeVotes.category, category)
        )
      );

    if (existing.length > 0) {
      // Update existing vote
      await db
        .update(superlativeVotes)
        .set({
          nomineePlayerSlug,
          updatedAt: new Date(),
        })
        .where(eq(superlativeVotes.id, existing[0].id));
    } else {
      // Insert new vote
      await db.insert(superlativeVotes).values({
        voterId: voter.id,
        category,
        nomineePlayerSlug,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Superlatives POST] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
