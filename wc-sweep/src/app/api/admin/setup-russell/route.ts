import { NextResponse } from "next/server";
import { db } from "@/db";
import { ensureTables } from "@/db/ensure-tables";
import { sql } from "drizzle-orm";

let tablesEnsured = false;

export async function GET() {
  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }

    await db.execute(sql`
      UPDATE players
      SET email = 'russellob@gmail.com',
          phone = '+447548442766',
          is_commissioner = true
      WHERE id = 1
    `);

    return NextResponse.json({
      success: true,
      message: "Russell updated: email, phone, commissioner. Go to /admin and use passcode 1234.",
    });
  } catch (err) {
    console.error("[Setup Russell]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
