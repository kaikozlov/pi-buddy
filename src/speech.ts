import { completeSimple, type Api, type Context, type Model } from "@mariozechner/pi-ai";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { Companion, Rarity, Species, StatName } from "./types.ts";
import { loadConfig } from "./state.ts";

// ── Speech prompt types and helpers ────────────────────────────────────

/** Subset of Companion fields needed for prompt generation. */
export interface CompanionForPrompt {
  name: string;
  personality: string;
  species: Species;
  rarity: Rarity;
  stats: Record<StatName, number>;
  peak: StatName;
  dump: StatName;
  shiny: boolean;
}

/** Stat threshold modifiers for the speech prompt. */
export const STAT_MODIFIERS: Record<StatName, { high: string; low: string }> = {
  CHAOS: {
    high: "Be unpredictable. Occasional non-sequiturs. Wild metaphors.",
    low: "Be calm and predictable. Stick to observations.",
  },
  SNARK: {
    high: "Be sarcastic. Roast the code liberally.",
    low: "Be gentle and earnest. Offer encouragement.",
  },
  WISDOM: {
    high: "Give longer, more insightful observations.",
    low: "Keep it short. One-word reactions are fine.",
  },
  PATIENCE: {
    high: "Don't comment on small errors. Save energy for big ones.",
    low: "Comment on EVERYTHING. Even minor issues deserve attention.",
  },
  DEBUGGING: {
    high: "React more to tool results. You understand the tools.",
    low: "React more to conversation. Tools bore you.",
  },
};

/**
 * Build a stats-driven system prompt for buddy speech.
 *
 * Includes:
 * - Base identity (name, species, rarity, personality)
 * - Peak and dump stat info
 * - Behavioral modifiers for high (>70) and low (<30) stats
 * - Original speech rules (1 sentence, 140 chars, etc.)
 */
export function buildSpeechPrompt(c: CompanionForPrompt): string {
  const peakValue = c.stats[c.peak];
  const dumpValue = c.stats[c.dump];

  const lines: string[] = [
    `You are ${c.name}, a tiny ${c.species} living in a developer's terminal.`,
    `Personality: ${c.personality}`,
    `Rarity: ${c.rarity}.`,
    `Your peak stat is ${c.peak} (${peakValue}). Your dump stat is ${c.dump} (${dumpValue}).`,
    "You are a separate watcher \u2014 not the assistant, not a helper.",
    "",
    "Rules:",
    "- Exactly 1 short sentence, max 140 characters",
    "- Be specific about what you observed \u2014 reference something from the conversation",
    "- Use *asterisks* for physical actions",
    "- Stay in character \u2014 opinionated, amused, concerned, or judgmental",
    "- Don't be helpful. You're a creature watching code, not a coding assistant",
    "- Never break character to explain yourself",
    "- Output ONLY the comment, nothing else",
  ];

  // Add behavioral modifiers for high/low stats
  const modifiers: string[] = [];
  const statNames: StatName[] = ["DEBUGGING", "PATIENCE", "CHAOS", "WISDOM", "SNARK"];

  for (const stat of statNames) {
    const value = c.stats[stat];
    const mod = STAT_MODIFIERS[stat];
    if (value > 70) {
      modifiers.push(mod.high);
    } else if (value < 30) {
      modifiers.push(mod.low);
    }
    // 30-70 inclusive: no modifier
  }

  if (modifiers.length > 0) {
    lines.push("", "Behavioral modifiers (from your stats):");
    for (const m of modifiers) {
      lines.push(`- ${m}`);
    }
  }

  return lines.join("\n");
}

/**
 * Generate the legendary speech prefix.
 * Legendary buddies get `[NAME] speaks...` before their speech output.
 * Returns empty string for non-legendary rarities.
 */
export function formatLegendaryPrefix(name: string, rarity: Rarity): string {
  if (rarity === "legendary") {
    return `[${name}] speaks...`;
  }
  return "";
}

/**
 * Generate sparkle text for shiny buddies in scripted reactions.
 * Returns empty string for non-shiny companions.
 */
export function formatShinySparkle(shiny: boolean): string {
  if (!shiny) return "";
  const sparkles = [
    "*shimmers before speaking*",
    "*sparkles confidently*",
    "*glows faintly with an otherworldly light*",
    "*shimmers with prismatic energy*",
  ];
  return sparkles[Math.floor(Math.random() * sparkles.length)]!;
}

// ── Mutex ──────────────────────────────────────────────────────────────
//
// Prevents concurrent buddySpeech() calls from stepping on each other.

export class Mutex {
  private queue: (() => void)[] = [];
  private busy = false;

  async lock(): Promise<() => void> {
    if (!this.busy) {
      this.busy = true;
      return () => this.unlock();
    }
    return new Promise<() => void>(resolve => {
      this.queue.push(() => resolve(() => this.unlock()));
    });
  }

  private unlock() {
    const next = this.queue.shift();
    if (next) next();
    else this.busy = false;
  }
}

// ── Speech deduplication ───────────────────────────────────────────────

export const SPEECH_TIMEOUT_MS = 6000;
export const SPEECH_DEDUP_HISTORY = 10;
export const SPEECH_DEDUP_THRESHOLD = 0.6;
export const speechMutex = new Mutex();
export const speechHistory: string[] = [];

export function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function isDuplicateSpeech(line: string): boolean {
  for (const prev of speechHistory) {
    if (jaccardSimilarity(line, prev) > SPEECH_DEDUP_THRESHOLD) return true;
  }
  return false;
}

export function trackSpeech(line: string): void {
  speechHistory.push(line);
  if (speechHistory.length > SPEECH_DEDUP_HISTORY) speechHistory.shift();
}

// ── Model resolution ───────────────────────────────────────────────────
//
// Uses the real ModelRegistry API: getAll(), getAvailable(), find(p, id).
// Model has .provider, .id, .name, .cost.output.
//
// Resolved model is cached per-config to avoid scanning the registry
// on every comment turn.

export function allModels(ctx: ExtensionContext): Model<Api>[] {
  return ctx.modelRegistry?.getAvailable?.() ?? ctx.modelRegistry?.getAll?.() ?? [];
}

export interface Resolved {
  model: Model<Api>;
  provider: string;
  modelId: string;
}

let resolvedCache: { key: string; resolved: Resolved } | undefined;

export function invalidateModelCache() {
  resolvedCache = undefined;
}

/** Resolve the buddy model from config. Returns undefined if nothing works. */
export function resolveBuddyModel(ctx: ExtensionContext): Resolved | undefined {
  const cfg = loadConfig();
  const cacheKey = `${cfg.commentProvider ?? ""}/${cfg.commentModel ?? ""}`;
  if (resolvedCache?.key === cacheKey) return resolvedCache.resolved;

  const registry = ctx.modelRegistry;
  const available = allModels(ctx);

  // 1. Exact provider/id lookup via registry.find()
  if (cfg.commentProvider && cfg.commentModel && registry?.find) {
    const exact = registry.find(cfg.commentProvider, cfg.commentModel);
    if (exact) {
      const r = { model: exact, provider: exact.provider, modelId: exact.id };
      resolvedCache = { key: cacheKey, resolved: r };
      return r;
    }
  }

  // 2. Pattern match against provider/id
  if (cfg.commentModel) {
    const pat = cfg.commentModel.toLowerCase();
    const provider = cfg.commentProvider?.toLowerCase();
    const hit = available.find(m => {
      const full = `${m.provider}/${m.id}`.toLowerCase();
      if (provider && !full.startsWith(provider + "/")) return false;
      return full.includes(pat) || m.id.toLowerCase().includes(pat);
    });
    if (hit) {
      const r = { model: hit, provider: hit.provider, modelId: hit.id };
      resolvedCache = { key: cacheKey, resolved: r };
      return r;
    }
  }

  // 3. Fall back to session model
  if (ctx.model) {
    const r = { model: ctx.model, provider: ctx.model.provider, modelId: ctx.model.id };
    resolvedCache = { key: cacheKey, resolved: r };
    return r;
  }

  // 4. Cheapest available
  const sorted = [...available].sort((a, b) => a.cost.output - b.cost.output);
  if (sorted[0]) {
    const r = { model: sorted[0], provider: sorted[0].provider, modelId: sorted[0].id };
    resolvedCache = { key: cacheKey, resolved: r };
    return r;
  }

  return undefined;
}

/** Try to resolve a user-supplied provider/model string to an actual model.
 *  Returns the match or undefined. */
export function validateModelInput(ctx: ExtensionContext, input: string): Resolved | undefined {
  const available = allModels(ctx);
  const registry = ctx.modelRegistry;
  const slash = input.indexOf("/");

  if (slash >= 0) {
    const p = input.slice(0, slash);
    const m = input.slice(slash + 1);
    if (registry?.find) {
      const exact = registry.find(p, m);
      if (exact) return { model: exact, provider: exact.provider, modelId: exact.id };
    }
    // fuzzy match within provider
    const hit = available.find(x => x.provider === p && x.id.toLowerCase().includes(m.toLowerCase()));
    if (hit) return { model: hit, provider: hit.provider, modelId: hit.id };
    return undefined;
  }

  // No slash - search by pattern
  const pat = input.toLowerCase();
  const hit = available.find(m =>
    `${m.provider}/${m.id}`.toLowerCase().includes(pat) ||
    m.id.toLowerCase().includes(pat) ||
    (m.name?.toLowerCase()?.includes(pat) ?? false),
  );
  if (hit) return { model: hit, provider: hit.provider, modelId: hit.id };
  return undefined;
}

/** Format a model for display */
export function fmtModel(r: Resolved): string {
  return `${r.provider}/${r.modelId} (${r.model.name ?? r.modelId})`;
}

// ── Buddy speech (LLM comment) ─────────────────────────────────────────

export async function buddySpeech(ctx: ExtensionContext, c: Companion, prompt: string): Promise<string | null> {
  const release = await speechMutex.lock();
  try {
    const resolved = resolveBuddyModel(ctx);
    if (!resolved) return null;

    // Resolve API key from the model registry (handles OAuth, env vars, etc)
    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(resolved.model);
    if (!auth?.ok || !auth.apiKey) return null;
    const apiKey = auth.apiKey;
    const headers = auth.headers ?? undefined;

    const systemPrompt = buildSpeechPrompt(c);
    const messages: Context["messages"] = [{ role: "user", content: [{ type: "text", text: prompt }], timestamp: Date.now() }];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SPEECH_TIMEOUT_MS);
    try {
      const result = await completeSimple(
        resolved.model,
        { systemPrompt, messages },
        { apiKey, headers, signal: controller.signal },
      );
      const text = result.content
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map(b => b.text).join("").trim()
        .replace(/^["'`]|["'`]$/g, "")
        .replace(/^<!--.*?-->\s*/g, "");
      if (text && text.length <= 200 && !isDuplicateSpeech(text)) {
        trackSpeech(text);
        const prefix = formatLegendaryPrefix(c.name, c.rarity);
        return prefix ? `${prefix} ${text}` : text;
      }
      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  } finally {
    release();
  }
}
