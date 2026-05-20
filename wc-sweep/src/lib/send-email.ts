const RESEND_API_KEY = process.env.RESEND_API_KEY;

export async function sendDigestEmail(
  to: string,
  playerName: string,
  digestHtml: string
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not set, skipping email");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "WC Sweep <noreply@resend.dev>",
        to: [to],
        subject: `WC Sweep Daily Digest - ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`,
        html: digestHtml,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = (data as Record<string, string>).message ?? `HTTP ${res.status}`;
      console.error(`[Email] Failed to send to ${to}: ${msg}`);
      return { success: false, error: msg };
    }

    return { success: true };
  } catch (err) {
    console.error(`[Email] Error sending to ${to}:`, err);
    return { success: false, error: String(err) };
  }
}
