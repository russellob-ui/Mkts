import { NextResponse } from "next/server";
import { db } from "@/db";
import { players } from "@/db/schema";

export async function verifyAdminRequest(
  request: Request
): Promise<NextResponse | null> {
  try {
    const body = await request.clone().json();
    const { adminPasscode } = body;
    if (!adminPasscode) {
      return NextResponse.json(
        { error: "Admin passcode required" },
        { status: 401 }
      );
    }
    const allPlayers = await db.select().from(players);
    const admin = allPlayers.find((p) => p.passcode === adminPasscode);
    if (!admin) {
      return NextResponse.json(
        { error: "Invalid admin passcode" },
        { status: 403 }
      );
    }
    return null;
  } catch {
    return NextResponse.json(
      { error: "Admin passcode required in request body" },
      { status: 401 }
    );
  }
}
