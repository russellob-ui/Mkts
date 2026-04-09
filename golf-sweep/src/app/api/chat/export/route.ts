import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { chatMessages } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const passcode = request.headers.get("x-admin-passcode");
    if (passcode !== process.env.ADMIN_PASSCODE) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureTables();

    // Export ALL messages including soft-deleted
    const allMessages = await db
      .select()
      .from(chatMessages)
      .orderBy(desc(chatMessages.createdAt));

    const exportData = JSON.stringify(allMessages, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    return new NextResponse(exportData, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="chat-export-${timestamp}.json"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
