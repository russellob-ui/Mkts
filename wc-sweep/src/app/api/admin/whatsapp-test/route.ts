import { NextResponse } from "next/server";
import { sendWhatsAppGroupMessage } from "@/lib/whatsapp";
import { verifyAdminRequest } from "@/lib/admin-auth";

export async function POST(request: Request) {
  try {
    const authError = await verifyAdminRequest(request);
    if (authError) return authError;

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
