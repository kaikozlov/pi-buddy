/**
 * src/message-log.ts — In-memory circular buffer of recent buddy messages/reactions.
 *
 * Cleared on session_start. Accessed via /buddy log.
 */

export interface LogEntry {
  /** The buddy's reaction text. */
  text: string;
  /** Unix timestamp (ms). */
  at: number;
  /** What triggered this message. */
  source: "pet" | "scripted" | "error" | "llm" | "direct" | "system";
  /** Buddy name at time of message. */
  name: string;
}

const MAX_ENTRIES = 50;

const entries: LogEntry[] = [];

/** Append a message to the log (oldest entries are evicted past MAX_ENTRIES). */
export function logMessage(entry: LogEntry): void {
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
}

/** Return a copy of all log entries (newest last). */
export function getLog(): LogEntry[] {
  return [...entries];
}

/** Clear the log (called on session_start). */
export function clearLog(): void {
  entries.length = 0;
}

/** Format the log as a human-readable string for the overlay panel. */
export function renderLog(): string {
  if (entries.length === 0) {
    return "No buddy messages yet this session.";
  }

  const lines: string[] = ["Buddy message log", ""];

  for (const entry of entries) {
    const time = new Date(entry.at);
    const h = String(time.getHours()).padStart(2, "0");
    const m = String(time.getMinutes()).padStart(2, "0");
    const s = String(time.getSeconds()).padStart(2, "0");
    const sourceTag = sourceLabel(entry.source);
    lines.push(`  ${h}:${m}:${s} [${entry.name}] ${sourceTag}`);
    // Wrap long text
    const wrapped = wrapText(entry.text, 64);
    for (const line of wrapped) {
      lines.push(`    ${line}`);
    }
    lines.push("");
  }

  lines.push(`  ${entries.length}/${MAX_ENTRIES} entries`);
  return lines.join("\n");
}

function sourceLabel(source: LogEntry["source"]): string {
  switch (source) {
    case "pet": return "🐾 pet";
    case "scripted": return "⚡ scripted";
    case "error": return "💥 error";
    case "llm": return "💬 llm";
    case "direct": return "🗣️ direct";
    case "system": return "📋 system";
  }
}

function wrapText(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
