import { complete, type Api, type Context, type Model } from "@mariozechner/pi-ai";
import type { CompanionBones } from "./types.ts";

const FALLBACK_NAMES = [
  "Crumpet", "Soup", "Pickle", "Biscuit", "Moth", "Gravy",
  "Nugget", "Sprocket", "Miso", "Waffle", "Pixel", "Ember",
  "Thimble", "Marble", "Sesame", "Cobalt", "Rusty", "Nimbus",
];

const VIBE_WORDS = [
  "thunder", "biscuit", "void", "accordion", "moss", "velvet", "rust",
  "pickle", "crumb", "whisper", "gravy", "frost", "ember", "soup",
  "marble", "thorn", "honey", "static", "copper", "dusk", "sprocket",
  "quartz", "soot", "plum", "flint", "oyster", "loom", "anvil",
  "cork", "bloom", "pebble", "vapor", "mirth", "glint", "cider",
];

export function generateFallbackName(): string {
  return FALLBACK_NAMES[Math.floor(Math.random() * FALLBACK_NAMES.length)]!;
}

function randomVibe(): string {
  return VIBE_WORDS[Math.floor(Math.random() * VIBE_WORDS.length)]!;
}

/**
 * Used when the model is unavailable, errors, or returns unusable JSON.
 * Randomized so local-only hatches still feel distinct (not one canned line).
 */
export function generateFallbackPersonality(bones: CompanionBones): string {
  const v1 = randomVibe();
  const v2 = randomVibe();
  const peak = bones.peak.toLowerCase();
  const dump = bones.dump.toLowerCase();
  const r = bones.rarity;
  const s = bones.species;
  const shiny = bones.shiny ? " (shiny, smug about it)" : "";
  const templates = [
    `A ${r} ${s}${shiny} who watches the terminal with ${v1}-flavored suspicion.`,
    `This ${r} ${s} treats your compiler output like gossip — ${peak} runs high, ${dump} barely registers.`,
    `A little ${s}: mostly ${v1} energy, occasional side-eye at your imports.`,
    `Part ${s}, part ${v2} weather — sits beside the prompt and narrates your mistakes under its breath.`,
    `A ${r} ${s} that finds merge conflicts spiritually exhausting; favors ${peak} over ${dump} any day.`,
    `${r} ${s}${shiny}: convinced every failed test is a personal slight.`,
    `Soft ${v1} vibes, harsh log review. This ${s} lives for green builds and ${v2} metaphors.`,
    `Your ${r} ${s} — equal parts ${peak} and dramatic pauses while you scroll diffs.`,
  ];
  return templates[Math.floor(Math.random() * templates.length)]!;
}

function extractJsonObject(raw: string): string | undefined {
  let t = raw.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1]!.trim();
  const match = t.match(/\{[\s\S]*\}/);
  return match?.[0];
}

export function generateSoulPrompt(bones: CompanionBones): string {
  const vibes: string[] = [];
  for (let i = 0; i < 4; i++) vibes.push(VIBE_WORDS[Math.floor(Math.random() * VIBE_WORDS.length)]!);
  const statStr = Object.entries(bones.stats).map(([k, v]) => `${k}:${v}`).join(", ");
  return [
    "Generate a coding companion — a small creature that lives in a developer's terminal.",
    "Don't repeat yourself — every companion should feel distinct.",
    "Keep it whimsical but not verbose.",
    "",
    `Rarity: ${bones.rarity.toUpperCase()}`,
    `Species: ${bones.species}`,
    `Stats: ${statStr}`,
    `Inspiration words: ${vibes.join(", ")}`,
    bones.shiny ? "SHINY variant — extra special." : "",
    "",
    'Return JSON: {"name": "1-14 chars", "personality": "2-3 sentences describing behavior"}',
  ].filter(Boolean).join("\n");
}

export async function generateSoul(model: Model<Api>, bones: CompanionBones): Promise<{ name: string; personality: string }> {
  const fallback = {
    name: generateFallbackName(),
    personality: generateFallbackPersonality(bones),
  };

  const context: Context = {
    systemPrompt: "You create concise terminal companions. Output valid JSON only, no markdown fences.",
    messages: [{
      role: "user",
      content: [{ type: "text", text: generateSoulPrompt(bones) }],
      timestamp: Date.now(),
    }],
  };

  try {
    const result = await complete(model, context, { maxTokens: 200 });
    const text = result.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map(c => c.text)
      .join("")
      .trim();
    const jsonStr = extractJsonObject(text);
    if (!jsonStr) return fallback;
    const parsed = JSON.parse(jsonStr) as Partial<{ name: string; personality: string }>;
    const name = (parsed.name ?? fallback.name).trim().slice(0, 14) || fallback.name;
    const personality = (parsed.personality ?? fallback.personality).trim().slice(0, 400) || fallback.personality;
    return { name, personality };
  } catch {
    return fallback;
  }
}
