import type { Companion } from "./types.ts";

export function companionIntroText(name: string, species: string): string {
  return `# Companion\n\nA small ${species} named ${name} sits beside the user's input box and occasionally comments in a speech bubble. You're not ${name} \u2014 it's a separate watcher.\n\nWhen the user addresses ${name} directly (by name), its bubble will answer. Your job in that moment is to stay out of the way: respond in ONE line or less, or just answer any part of the message meant for you. Don't explain that you're not ${name} \u2014 they know. Don't narrate what ${name} might say \u2014 the bubble handles that.`;
}

// Generic invocations that always count as addressing the buddy
// regardless of its name.
const BUDDY_PHRASES: RegExp[] = [
  /\bhey\b\s+(buddy|pal|friend|little\s+\w+)/i,
  /\b(say\s+something|chime\s+in)\b/i,
  /\bwhat\s+do\s+you\s+think\b/i,
  /\bany\s+thoughts\b/i,
  /\byo\s+buddy\b/i,
  /\bpsst\b/i,
];

export function isDirectlyAddressingBuddy(text: string, companion: Companion): boolean {
  // Exact name match (case-insensitive, word boundary)
  const escaped = companion.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`\\b${escaped}\\b`, "i").test(text)) return true;

  // Nickname: first 3+ chars of the name as a prefix match
  if (companion.name.length >= 4) {
    const nick = companion.name.slice(0, Math.min(companion.name.length - 1, Math.max(3, Math.ceil(companion.name.length * 0.6))));
    const nickEscaped = nick.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${nickEscaped}\\b`, "i").test(text)) return true;
  }

  // Generic buddy phrases
  for (const re of BUDDY_PHRASES) {
    if (re.test(text)) return true;
  }

  return false;
}
