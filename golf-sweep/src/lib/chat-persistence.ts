import * as fs from "fs";
import * as path from "path";

const VOLUME_PATH = process.env.RAILWAY_VOLUME_PATH || "/data";
const JSONL_FILE = path.join(VOLUME_PATH, "chat-history.jsonl");

/**
 * Layer 2: Append a chat message to the JSONL file on Railway's persistent volume.
 * This is the most important backup — it survives DB wipes.
 * NEVER truncate or delete this file.
 */
export function appendChatToJSONL(message: Record<string, unknown>): void {
  try {
    // Ensure directory exists
    const dir = path.dirname(JSONL_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const line = JSON.stringify(message) + "\n";
    fs.appendFileSync(JSONL_FILE, line, "utf8");
  } catch (err) {
    // Log but don't crash — Postgres is the primary store
    console.error("[Chat JSONL] Failed to append:", err);
  }
}

/**
 * Read all messages from the JSONL file for recovery.
 */
export function readChatFromJSONL(): Array<Record<string, unknown>> {
  try {
    if (!fs.existsSync(JSONL_FILE)) return [];
    const content = fs.readFileSync(JSONL_FILE, "utf8");
    return content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        try { return JSON.parse(line); }
        catch { return null; }
      })
      .filter(Boolean) as Array<Record<string, unknown>>;
  } catch {
    return [];
  }
}

/**
 * Check if the volume is mounted and writable.
 */
export function checkVolumeStatus(): { mounted: boolean; path: string; fileExists: boolean; messageCount: number } {
  const dirExists = fs.existsSync(VOLUME_PATH);
  const fileExists = fs.existsSync(JSONL_FILE);
  let messageCount = 0;
  if (fileExists) {
    try {
      const content = fs.readFileSync(JSONL_FILE, "utf8");
      messageCount = content.split("\n").filter((l) => l.trim()).length;
    } catch {}
  }
  return { mounted: dirExists, path: VOLUME_PATH, fileExists, messageCount };
}
