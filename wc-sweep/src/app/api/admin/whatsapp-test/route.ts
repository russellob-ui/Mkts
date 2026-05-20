import { NextResponse } from "next/server";
import { sendWhatsAppGroupMessage } from "@/lib/whatsapp";

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    if (!message) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }
    const sent = await sendWhatsAppGroupMessage(message);
    return NextResponse.json({ sent });
  } catch (err) {
    console.error("[WhatsApp Test]", err);
    return NextResponse.json({ error: "Failed to send" }, { status: 500 });
  }
}
