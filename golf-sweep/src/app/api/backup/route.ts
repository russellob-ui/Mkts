import { NextRequest, NextResponse } from "next/server";
import { exportFullDatabase } from "@/lib/db-safety";

export async function POST(request: NextRequest) {
  try {
    const passcode = request.headers.get("x-admin-passcode");
    if (passcode !== process.env.ADMIN_PASSCODE) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const backup = await exportFullDatabase();
    const exportData = JSON.stringify(backup, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    return new NextResponse(exportData, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="backup-${timestamp}.json"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
