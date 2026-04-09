import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { banterEvents } from "@/db/schema";

export async function POST(request: NextRequest) {
  const passcode = request.headers.get("x-admin-passcode");
  if (passcode !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tournamentId, headline, detail, emoji, importance } = await request.json();

  await db.insert(banterEvents).values({
    tournamentId,
    headline,
    detail,
    emoji,
    importance: importance ?? 5,
    eventType: "manual",
    source: "manual",
  });

  return NextResponse.json({ message: "Banter event added" });
}
