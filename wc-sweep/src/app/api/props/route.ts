import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { predictions, matches, wcTeams, players, matchEvents } from "@/db/schema";
import { eq, and, sql, gte, lt } from "drizzle-orm";

let tablesEnsured = false;

interface PropBet {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string | null;
  date: string;
}

function getTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function generateProps(todaysMatches: { id: number; homeTeam: string; awayTeam: string }[]): PropBet[] {
  const dateStr = new Date().toISOString().slice(0, 10);
  const numMatches = todaysMatches.length;

  if (numMatches === 0) return [];

  const totalGoalsLine = Math.round(numMatches * 1.5 * 2) / 2; // round to nearest 0.5
  const overUnder = totalGoalsLine % 1 === 0 ? totalGoalsLine + 0.5 : totalGoalsLine;

  const props: PropBet[] = [
    {
      id: `prop-goals-${dateStr}`,
      question: `Total goals today: Over/Under ${overUnder}`,
      options: [`Over ${overUnder}`, `Under ${overUnder}`],
      correctAnswer: null,
      date: dateStr,
    },
    {
      id: `prop-redcard-${dateStr}`,
      question: "Any red cards today?",
      options: ["Yes", "No"],
      correctAnswer: null,
      date: dateStr,
    },
    {
      id: `prop-penalty-${dateStr}`,
      question: "Will there be a penalty?",
      options: ["Yes", "No"],
      correctAnswer: null,
      date: dateStr,
    },
    {
      id: `prop-cleansheet-${dateStr}`,
      question: "Clean sheet in any match?",
      options: ["Yes", "No"],
      correctAnswer: null,
      date: dateStr,
    },
  ];

  return props;
}

export async function GET(request: Request) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const { start, end } = getTodayRange();
    const dateStr = new Date().toISOString().slice(0, 10);

    // Get today's matches
    const todaysMatches = await db
      .select()
      .from(matches)
      .where(and(gte(matches.kickoff, start), lt(matches.kickoff, end)));

    const allTeams = await db.select().from(wcTeams);
    const teamById = new Map(allTeams.map((t) => [t.id, t]));

    const matchSummaries = todaysMatches.map((m) => ({
      id: m.id,
      homeTeam: teamById.get(m.homeTeamId)?.name ?? "?",
      awayTeam: teamById.get(m.awayTeamId)?.name ?? "?",
    }));

    // Generate prop bets
    const props = generateProps(matchSummaries);

    // Check if any props can be resolved (all today's matches finished)
    const allFinished = todaysMatches.length > 0 && todaysMatches.every((m) => m.status === "finished");

    if (allFinished && todaysMatches.length > 0) {
      // Calculate actual results for today's matches
      let totalGoals = 0;
      let anyRedCard = false;
      let anyPenalty = false;
      let anyCleanSheet = false;

      for (const m of todaysMatches) {
        const hs = m.homeScore ?? 0;
        const as = m.awayScore ?? 0;
        totalGoals += hs + as;

        if (hs === 0 || as === 0) {
          anyCleanSheet = true;
        }

        // Check match events for red cards and penalties
        const events = await db
          .select()
          .from(matchEvents)
          .where(eq(matchEvents.matchId, m.id));

        for (const ev of events) {
          if (ev.eventType === "Card" && ev.detail?.toLowerCase().includes("red")) {
            anyRedCard = true;
          }
          if (ev.eventType === "Goal" && ev.detail?.toLowerCase().includes("penalty")) {
            anyPenalty = true;
          }
        }
      }

      // Set correct answers
      for (const prop of props) {
        if (prop.id.startsWith("prop-goals-")) {
          const line = parseFloat(prop.options[0].replace("Over ", ""));
          prop.correctAnswer = totalGoals > line ? prop.options[0] : prop.options[1];
        } else if (prop.id.startsWith("prop-redcard-")) {
          prop.correctAnswer = anyRedCard ? "Yes" : "No";
        } else if (prop.id.startsWith("prop-penalty-")) {
          prop.correctAnswer = anyPenalty ? "Yes" : "No";
        } else if (prop.id.startsWith("prop-cleansheet-")) {
          prop.correctAnswer = anyCleanSheet ? "Yes" : "No";
        }
      }
    }

    // Get all prop predictions for today (prop predictions have matchId but predictionType="prop")
    const allPropPreds = await db
      .select()
      .from(predictions)
      .where(eq(predictions.predictionType, "prop"));

    // Filter to today's props
    const todayPropPreds = allPropPreds.filter((p) => {
      const propId = p.predictionValue.split("|")[0] ?? "";
      return propId.includes(dateStr);
    });

    // Get all players for enrichment
    const allPlayers = await db.select().from(players);
    const playerById = new Map(allPlayers.map((p) => [p.id, p]));

    const enrichedPreds = todayPropPreds.map((p) => {
      const [propId, answer] = p.predictionValue.split("|");
      const player = playerById.get(p.playerId);
      return {
        id: p.id,
        playerId: p.playerId,
        playerName: player?.name ?? "?",
        propId,
        answer,
        resolved: p.resolved,
        correct: p.correct,
        pointsAwarded: p.pointsAwarded,
      };
    });

    return NextResponse.json({
      props,
      predictions: enrichedPreds,
      matchCount: todaysMatches.length,
      allFinished,
    });
  } catch (err) {
    console.error("[Props GET]", err);
    return NextResponse.json(
      { error: "Failed to load props" },
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
    const { playerId, propId, answer, passcode } = body;

    if (!playerId || !propId || !answer) {
      return NextResponse.json(
        { error: "Missing required fields: playerId, propId, answer" },
        { status: 400 }
      );
    }

    // Verify passcode
    const [player] = await db
      .select()
      .from(players)
      .where(eq(players.id, Number(playerId)));

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    if (player.passcode && player.passcode !== passcode) {
      return NextResponse.json({ error: "Invalid passcode" }, { status: 403 });
    }

    // We use matchId=0 as a sentinel for prop bets (they aren't tied to a single match)
    // and store the propId|answer as the predictionValue
    // We need a "dummy" matchId — use the first match of the day
    const { start, end } = getTodayRange();
    const todaysMatches = await db
      .select()
      .from(matches)
      .where(and(gte(matches.kickoff, start), lt(matches.kickoff, end)));

    if (todaysMatches.length === 0) {
      return NextResponse.json(
        { error: "No matches today — props not available" },
        { status: 400 }
      );
    }

    // Check that no match has started yet (all still scheduled)
    const allScheduled = todaysMatches.every((m) => m.status === "scheduled");
    if (!allScheduled) {
      // Allow props until all matches start — just check that the specific prop is still valid
      const allStarted = todaysMatches.every((m) => m.status !== "scheduled");
      if (allStarted) {
        return NextResponse.json(
          { error: "All matches have started — props are locked" },
          { status: 400 }
        );
      }
    }

    const firstMatchId = todaysMatches[0].id;
    const predictionValue = `${propId}|${answer}`;

    // Upsert — uniqueness is on (playerId, matchId, predictionType)
    // But we want unique per propId, so we use a composite predictionType
    const predType = `prop`;

    // Check if this player already has a prediction for this specific propId
    const existing = await db
      .select()
      .from(predictions)
      .where(
        and(
          eq(predictions.playerId, Number(playerId)),
          eq(predictions.predictionType, predType)
        )
      );

    const existingForProp = existing.find((p) =>
      p.predictionValue.startsWith(`${propId}|`)
    );

    if (existingForProp) {
      // Update existing
      await db
        .update(predictions)
        .set({
          predictionValue,
          submittedAt: new Date(),
        })
        .where(eq(predictions.id, existingForProp.id));
    } else {
      // Insert new
      await db.insert(predictions).values({
        playerId: Number(playerId),
        matchId: firstMatchId,
        predictionType: predType,
        predictionValue,
        submittedAt: new Date(),
      });
    }

    return NextResponse.json({ success: true, propId, answer });
  } catch (err) {
    console.error("[Props POST]", err);
    return NextResponse.json(
      { error: "Failed to save prop bet" },
      { status: 500 }
    );
  }
}
