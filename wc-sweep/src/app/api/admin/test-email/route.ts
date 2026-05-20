import { NextResponse } from "next/server";
import { sendDigestEmail } from "@/lib/send-email";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const html = `
      <div style="font-family:sans-serif;background:#0a0a0f;color:#f5f1e8;padding:20px;border-radius:8px;">
        <h1 style="color:#d4a843;margin:0 0 10px;">⚽ WC Sweep 2026</h1>
        <p>If you see this email, notifications are working!</p>
        <p style="color:#d4a843;font-weight:bold;">Get ready for the draw.</p>
      </div>
    `;
    const result = await sendDigestEmail("russellob@gmail.com", "Russell", html);
    return NextResponse.json({
      result,
      apiKey: process.env.RESEND_API_KEY ? "set" : "MISSING",
    });
  } catch (err) {
    return NextResponse.json({
      error: String(err),
      apiKey: process.env.RESEND_API_KEY ? "set" : "MISSING",
    });
  }
}
