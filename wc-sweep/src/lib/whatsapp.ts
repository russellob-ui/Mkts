const WHAPI_URL = "https://gate.whapi.cloud/messages/text";

function getToken(): string {
  const token = process.env.WHAPI_TOKEN;
  if (!token) throw new Error("WHAPI_TOKEN not set");
  return token;
}

function getGroupId(): string {
  const groupId = process.env.WHAPI_GROUP_ID;
  if (!groupId) throw new Error("WHAPI_GROUP_ID not set");
  return groupId;
}

export async function sendWhatsAppGroupMessage(body: string): Promise<boolean> {
  try {
    const res = await fetch(WHAPI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        to: getGroupId(),
        body,
        typing_time: 3,
      }),
    });
    if (!res.ok) {
      console.error("[WhatsApp] Send failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[WhatsApp] Send error:", err);
    return false;
  }
}

export async function sendWhatsAppDM(
  phone: string,
  body: string
): Promise<boolean> {
  const cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.length < 10) return false;

  try {
    const res = await fetch(WHAPI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        to: `${cleaned}@s.whatsapp.net`,
        body,
        typing_time: 2,
      }),
    });
    if (!res.ok) {
      console.error("[WhatsApp DM] Failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[WhatsApp DM] Error:", err);
    return false;
  }
}
