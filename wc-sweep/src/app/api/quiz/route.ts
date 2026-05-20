import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { quizResults, players } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

let tablesEnsured = false;

// ---- Question Bank (50+ World Cup trivia questions) ----

const QUESTION_BANK: Array<{
  question: string;
  options: string[];
  correctIndex: number;
}> = [
  {
    question: "Which country has won the most World Cups?",
    options: ["Germany", "Brazil", "Italy", "Argentina"],
    correctIndex: 1,
  },
  {
    question: "Who scored the fastest goal in World Cup history?",
    options: ["Clint Dempsey", "Hakan Sukur", "Pele", "Ronaldo"],
    correctIndex: 1,
  },
  {
    question: "Which World Cup was the first to use VAR?",
    options: ["2010", "2014", "2018", "2022"],
    correctIndex: 2,
  },
  {
    question: "How many teams are in the 2026 World Cup?",
    options: ["32", "36", "40", "48"],
    correctIndex: 3,
  },
  {
    question: "Which country hosted the first World Cup in 1930?",
    options: ["Brazil", "Argentina", "Uruguay", "Italy"],
    correctIndex: 2,
  },
  {
    question: "Who holds the record for most World Cup goals (16)?",
    options: ["Ronaldo (Brazil)", "Gerd Muller", "Miroslav Klose", "Just Fontaine"],
    correctIndex: 2,
  },
  {
    question: "Which team won the 2022 World Cup?",
    options: ["France", "Argentina", "Brazil", "Croatia"],
    correctIndex: 1,
  },
  {
    question: "What year did England win the World Cup?",
    options: ["1962", "1966", "1970", "1958"],
    correctIndex: 1,
  },
  {
    question: "Which African team reached the quarter-finals in 2010?",
    options: ["Nigeria", "Cameroon", "Ghana", "Ivory Coast"],
    correctIndex: 2,
  },
  {
    question: "Who scored the 'Hand of God' goal?",
    options: ["Pele", "Maradona", "Zidane", "Ronaldo"],
    correctIndex: 1,
  },
  {
    question: "Which country won the first ever World Cup match?",
    options: ["France", "Mexico", "Uruguay", "Argentina"],
    correctIndex: 0,
  },
  {
    question: "How many times has Germany won the World Cup?",
    options: ["3", "4", "5", "2"],
    correctIndex: 1,
  },
  {
    question: "Who scored the winning goal in the 2010 World Cup final?",
    options: ["David Villa", "Andres Iniesta", "Xavi", "Fernando Torres"],
    correctIndex: 1,
  },
  {
    question: "Which player was sent off in the 2006 World Cup final?",
    options: ["Marco Materazzi", "Zinedine Zidane", "Thierry Henry", "Gennaro Gattuso"],
    correctIndex: 1,
  },
  {
    question: "What was the score in the 2014 semi-final between Brazil and Germany?",
    options: ["5-0", "7-1", "6-0", "4-1"],
    correctIndex: 1,
  },
  {
    question: "Which country has appeared in the most World Cup finals?",
    options: ["Brazil", "Germany", "Italy", "Argentina"],
    correctIndex: 1,
  },
  {
    question: "Who won the Golden Ball at the 2022 World Cup?",
    options: ["Kylian Mbappe", "Lionel Messi", "Luka Modric", "Antoine Griezmann"],
    correctIndex: 1,
  },
  {
    question: "In which city was the 2022 World Cup final held?",
    options: ["Doha", "Lusail", "Al Khor", "Al Wakrah"],
    correctIndex: 1,
  },
  {
    question: "Which team did Pele play for when he won his first World Cup?",
    options: ["Santos", "Brazil U21", "Brazil", "Sao Paulo"],
    correctIndex: 2,
  },
  {
    question: "How old was Pele when he first won the World Cup?",
    options: ["16", "17", "18", "19"],
    correctIndex: 1,
  },
  {
    question: "Which was the first Asian country to reach the World Cup semi-finals?",
    options: ["Japan", "South Korea", "Iran", "Saudi Arabia"],
    correctIndex: 1,
  },
  {
    question: "Who scored a hat-trick in the 2022 World Cup final?",
    options: ["Lionel Messi", "Kylian Mbappe", "Olivier Giroud", "Julian Alvarez"],
    correctIndex: 1,
  },
  {
    question: "Which team was the surprise package at the 2018 World Cup, reaching the final?",
    options: ["Belgium", "Croatia", "England", "Sweden"],
    correctIndex: 1,
  },
  {
    question: "What is the 'Jules Rimet' trophy?",
    options: ["The Golden Boot", "The original World Cup trophy", "The Fair Play award", "The Golden Glove"],
    correctIndex: 1,
  },
  {
    question: "Which country hosted the 2006 World Cup?",
    options: ["France", "South Africa", "Germany", "Japan"],
    correctIndex: 2,
  },
  {
    question: "Who scored the 'Goal of the Century' in 1986?",
    options: ["Pele", "Maradona", "Platini", "Lineker"],
    correctIndex: 1,
  },
  {
    question: "How many World Cups has Italy won?",
    options: ["3", "4", "5", "2"],
    correctIndex: 1,
  },
  {
    question: "Which country conceded the most goals in a single World Cup match (10)?",
    options: ["Haiti", "El Salvador", "Zaire", "South Korea"],
    correctIndex: 1,
  },
  {
    question: "What was unique about the 2002 World Cup?",
    options: ["First in Africa", "First co-hosted", "First with VAR", "First with 48 teams"],
    correctIndex: 1,
  },
  {
    question: "Who is the only player to score in every round of a single World Cup?",
    options: ["Ronaldo", "Jairzinho", "Miroslav Klose", "Pele"],
    correctIndex: 1,
  },
  {
    question: "Which country has the most World Cup red cards?",
    options: ["Argentina", "Brazil", "Germany", "Uruguay"],
    correctIndex: 1,
  },
  {
    question: "Who won the Golden Boot at the 2018 World Cup?",
    options: ["Antoine Griezmann", "Harry Kane", "Romelu Lukaku", "Kylian Mbappe"],
    correctIndex: 1,
  },
  {
    question: "Which team knocked out Spain in the 2022 World Cup?",
    options: ["Japan", "Morocco", "Germany", "South Korea"],
    correctIndex: 1,
  },
  {
    question: "How many goals did Just Fontaine score in the 1958 World Cup?",
    options: ["10", "11", "13", "15"],
    correctIndex: 2,
  },
  {
    question: "Which country won back-to-back World Cups in 1958 and 1962?",
    options: ["Germany", "Italy", "Brazil", "Argentina"],
    correctIndex: 2,
  },
  {
    question: "Who is the oldest player to score in a World Cup match?",
    options: ["Miroslav Klose", "Roger Milla", "Dino Zoff", "Lothar Matthaus"],
    correctIndex: 1,
  },
  {
    question: "Which nation has hosted the World Cup the most times?",
    options: ["Germany", "France", "Brazil", "Mexico"],
    correctIndex: 3,
  },
  {
    question: "What was the 'Disgrace of Gijon'?",
    options: [
      "A match-fixing scandal",
      "Germany and Austria colluding in 1982",
      "A mass brawl in 1990",
      "A referee error in 1978",
    ],
    correctIndex: 1,
  },
  {
    question: "Who kept the most clean sheets at the 2022 World Cup?",
    options: ["Emiliano Martinez", "Hugo Lloris", "Yassine Bounou", "Dominik Livakovic"],
    correctIndex: 2,
  },
  {
    question: "Which is the only team to have played in every World Cup?",
    options: ["Germany", "Argentina", "Italy", "Brazil"],
    correctIndex: 3,
  },
  {
    question: "How many co-hosts does the 2026 World Cup have?",
    options: ["1", "2", "3", "4"],
    correctIndex: 2,
  },
  {
    question: "Which co-host countries are hosting the 2026 World Cup?",
    options: [
      "USA, Canada, Mexico",
      "USA, UK, France",
      "USA, Brazil, Argentina",
      "USA, Spain, Portugal",
    ],
    correctIndex: 0,
  },
  {
    question: "What colour card was introduced at the 2025 Club World Cup (and used in 2026)?",
    options: ["Green", "Blue", "Orange", "Pink"],
    correctIndex: 1,
  },
  {
    question: "Which stadium will host the 2026 World Cup final?",
    options: ["SoFi Stadium", "MetLife Stadium", "AT&T Stadium", "Azteca Stadium"],
    correctIndex: 1,
  },
  {
    question: "Who captained France in the 2018 World Cup final?",
    options: ["Antoine Griezmann", "Hugo Lloris", "Paul Pogba", "Raphael Varane"],
    correctIndex: 1,
  },
  {
    question: "Which goalkeeper saved a penalty to help Argentina win the 2022 final?",
    options: ["Franco Armani", "Geronimo Rulli", "Emiliano Martinez", "Juan Musso"],
    correctIndex: 2,
  },
  {
    question: "How many group stage matches are there in the 2026 World Cup?",
    options: ["48", "64", "80", "96"],
    correctIndex: 3,
  },
  {
    question: "Which country did Saudi Arabia famously beat in the 2022 group stage?",
    options: ["France", "Argentina", "Germany", "Spain"],
    correctIndex: 1,
  },
  {
    question: "Who scored England's hat-trick in the 1966 World Cup final?",
    options: ["Bobby Charlton", "Geoff Hurst", "Jimmy Greaves", "Martin Peters"],
    correctIndex: 1,
  },
  {
    question: "Which World Cup mascot was called 'Zabivaka'?",
    options: ["2010 South Africa", "2014 Brazil", "2018 Russia", "2022 Qatar"],
    correctIndex: 2,
  },
];

function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Simple seeded PRNG (mulberry32) */
function seededRng(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

function getDailyQuestions(dateStr: string) {
  const seed = hashString(`quiz-${dateStr}`);
  const rng = seededRng(seed);

  // Fisher-Yates shuffle with seeded RNG
  const indices = Array.from({ length: QUESTION_BANK.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  // Take first 5
  return indices.slice(0, 5).map((idx, i) => ({
    index: i,
    question: QUESTION_BANK[idx].question,
    options: QUESTION_BANK[idx].options,
    _correctIndex: QUESTION_BANK[idx].correctIndex,
    _bankIndex: idx,
  }));
}

export async function GET(request: NextRequest) {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get("playerId");
    const dateStr = getTodayString();
    const questions = getDailyQuestions(dateStr);

    // Check if this player already submitted today
    let existingResult = null;
    if (playerId) {
      const results = await db
        .select()
        .from(quizResults)
        .where(
          and(
            eq(quizResults.playerId, Number(playerId)),
            eq(quizResults.quizDate, dateStr)
          )
        );
      if (results.length > 0) {
        existingResult = results[0];
      }
    }

    // Get today's leaderboard
    const allResults = await db
      .select()
      .from(quizResults)
      .where(eq(quizResults.quizDate, dateStr))
      .orderBy(desc(quizResults.score));

    const allPlayers = await db.select().from(players);
    const playerMap = new Map(allPlayers.map((p) => [p.id, p]));

    const leaderboard = allResults.map((r) => {
      const p = playerMap.get(r.playerId);
      return {
        playerId: r.playerId,
        playerName: p?.name ?? "Unknown",
        color: p?.color ?? null,
        score: r.score,
      };
    });

    // Return questions without correct answers (unless already submitted)
    const safeQuestions = questions.map((q) => ({
      index: q.index,
      question: q.question,
      options: q.options,
      ...(existingResult
        ? { correctIndex: q._correctIndex }
        : {}),
    }));

    return NextResponse.json({
      date: dateStr,
      questions: safeQuestions,
      existingResult: existingResult
        ? {
            score: existingResult.score,
            answers: existingResult.answers,
          }
        : null,
      leaderboard,
      players: allPlayers.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        color: p.color,
      })),
    });
  } catch (error) {
    console.error("[Quiz GET] Error:", error);
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
    const { playerId, answers, passcode } = body;

    if (!playerId || !answers || !passcode) {
      return NextResponse.json(
        { error: "playerId, answers, and passcode are required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(answers) || answers.length !== 5) {
      return NextResponse.json(
        { error: "Must answer all 5 questions" },
        { status: 400 }
      );
    }

    // Validate passcode
    const allPlayers = await db.select().from(players);
    const player = allPlayers.find(
      (p) => p.id === Number(playerId) && p.passcode === passcode
    );
    if (!player) {
      return NextResponse.json(
        { error: "Invalid passcode" },
        { status: 401 }
      );
    }

    const dateStr = getTodayString();

    // Check if already submitted
    const existing = await db
      .select()
      .from(quizResults)
      .where(
        and(
          eq(quizResults.playerId, player.id),
          eq(quizResults.quizDate, dateStr)
        )
      );

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Already submitted today's quiz" },
        { status: 409 }
      );
    }

    // Score the quiz
    const questions = getDailyQuestions(dateStr);
    let score = 0;
    const scoredAnswers = answers.map(
      (a: { questionIndex: number; answer: number }) => {
        const q = questions.find((qq) => qq.index === a.questionIndex);
        const correct = q ? a.answer === q._correctIndex : false;
        if (correct) score++;
        return {
          questionIndex: a.questionIndex,
          answer: a.answer,
          correct,
          correctIndex: q?._correctIndex ?? -1,
        };
      }
    );

    const [result] = await db
      .insert(quizResults)
      .values({
        playerId: player.id,
        quizDate: dateStr,
        answers: scoredAnswers,
        score,
      })
      .returning();

    return NextResponse.json({
      result: {
        score: result.score,
        answers: scoredAnswers,
      },
    });
  } catch (error) {
    console.error("[Quiz POST] Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
