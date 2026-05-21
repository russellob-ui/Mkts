import { NextResponse } from "next/server";
import { sendWhatsAppGroupMessage, sendWhatsAppDM } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "group";
  const phone = url.searchParams.get("phone") ?? "+447548442766";

  try {
    if (type === "dm") {
      const sent = await sendWhatsAppDM(
        phone,
        `🎯 *WC Sweep 2026 — DM Test*\n\nThis is a personal message just for you.\n\n⚽ Your teams will be announced after the draw!\n\n📱 Open app → https://mkts-dun.vercel.app`
      );
      return NextResponse.json({ sent, type: "dm", phone });
    } else {
      const sent = await sendWhatsAppGroupMessage(
        `⚽ *WC Sweep 2026 — System Test*\n\nThe bot is alive! Daily digests, goal alerts, and match results will be posted here automatically.\n\n🏆 Get ready for the draw.\n\n📱 Open app → https://mkts-dun.vercel.app`
      );
      return NextResponse.json({ sent, type: "group" });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
