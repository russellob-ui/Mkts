import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { commissionerActions } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const passcode = request.headers.get("x-commissioner-passcode");
    if (passcode !== process.env.COMMISSIONER_PASSCODE) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureTables();

    const actions = await db
      .select()
      .from(commissionerActions)
      .orderBy(desc(commissionerActions.createdAt));

    return NextResponse.json({ actions });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
