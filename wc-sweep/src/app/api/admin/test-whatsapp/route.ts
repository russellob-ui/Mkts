import { NextResponse } from "next/server";
import { sendWhatsAppGroupMessage } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const msg = `⚽ *WC Sweep 2026 — Test*\n\nIf you see this, the WhatsApp bot is working!\n\n🏆 Get ready for the draw.`;
    const sent = await sendWhatsAppGroupMessage(msg);
    return NextResponse.json({
      sent,
      token: process.env.WHAPI_TOKEN ? "set" : "MISSING",
      groupId: process.env.WHAPI_GROUP_ID ?? "MISSING",
    });
  } catch (err) {
    return NextResponse.json({
      sent: false,
      error: String(err),
      token: process.env.WHAPI_TOKEN ? "set" : "MISSING",
      groupId: process.env.WHAPI_GROUP_ID ?? "MISSING",
    });
  }
}
