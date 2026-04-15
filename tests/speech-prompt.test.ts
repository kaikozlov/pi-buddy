import { describe, test, expect } from "bun:test";
import {
  buildSpeechPrompt,
  formatLegendaryPrefix,
  formatShinySparkle,
  STAT_MODIFIERS,
  type CompanionForPrompt,
} from "../src/speech.ts";
import type { Rarity, Species, StatName } from "../src/types.ts";

// ── Helpers ──────────────────────────────────────────────────────────────

function makeCompanion(overrides: Partial<CompanionForPrompt> = {}): CompanionForPrompt {
  return {
    name: "Whiskers",
    personality: "sassy and judgmental",
    species: "cat" as Species,
    rarity: "common" as Rarity,
    stats: {
      DEBUGGING: 50,
      PATIENCE: 50,
      CHAOS: 50,
      WISDOM: 50,
      SNARK: 50,
    },
    peak: "CHAOS" as StatName,
    dump: "PATIENCE" as StatName,
    shiny: false,
    ...overrides,
  };
}

// ── buildSpeechPrompt ────────────────────────────────────────────────────

describe("buildSpeechPrompt — base prompt includes rarity and stats", () => {
  test("includes rarity in the system prompt", () => {
    const c = makeCompanion({ rarity: "rare" });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("rare");
  });

  test("includes species in the system prompt", () => {
    const c = makeCompanion({ species: "dragon" });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("dragon");
  });

  test("includes peak stat name and value", () => {
    const c = makeCompanion({ peak: "CHAOS", stats: { ...makeCompanion().stats, CHAOS: 85 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("CHAOS");
    expect(prompt).toContain("85");
  });

  test("includes dump stat name and value", () => {
    const c = makeCompanion({ dump: "PATIENCE", stats: { ...makeCompanion().stats, PATIENCE: 12 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("PATIENCE");
    expect(prompt).toContain("12");
  });

  test("includes personality", () => {
    const c = makeCompanion({ personality: "lazy and mysterious" });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("lazy and mysterious");
  });

  test("includes companion name", () => {
    const c = makeCompanion({ name: "Noodle" });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("Noodle");
  });
});

// ── High CHAOS modifier ────────────────────────────────────────────────

describe("buildSpeechPrompt — high CHAOS (>70) modifier", () => {
  test("adds unpredictable modifier when CHAOS > 70", () => {
    const c = makeCompanion({ stats: { ...makeCompanion().stats, CHAOS: 80 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("unpredictable");
    expect(prompt).toContain("non-sequiturs");
  });

  test("adds wild metaphors modifier", () => {
    const c = makeCompanion({ stats: { ...makeCompanion().stats, CHAOS: 71 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("Wild metaphors");
  });
});

// ── Low CHAOS modifier ─────────────────────────────────────────────────

describe("buildSpeechPrompt — low CHAOS (<30) modifier", () => {
  test("adds calm modifier when CHAOS < 30", () => {
    const c = makeCompanion({ stats: { ...makeCompanion().stats, CHAOS: 15 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("calm and predictable");
  });

  test("includes stick to observations", () => {
    const c = makeCompanion({ stats: { ...makeCompanion().stats, CHAOS: 29 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("Stick to observations");
  });
});

// ── High SNARK modifier ────────────────────────────────────────────────

describe("buildSpeechPrompt — high SNARK (>70) modifier", () => {
  test("adds sarcastic modifier when SNARK > 70", () => {
    const c = makeCompanion({ stats: { ...makeCompanion().stats, SNARK: 80 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("sarcastic");
  });

  test("includes roast the code liberally", () => {
    const c = makeCompanion({ stats: { ...makeCompanion().stats, SNARK: 75 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("Roast the code liberally");
  });
});

// ── Low SNARK modifier ─────────────────────────────────────────────────

describe("buildSpeechPrompt — low SNARK (<30) modifier", () => {
  test("adds gentle modifier when SNARK < 30", () => {
    const c = makeCompanion({ stats: { ...makeCompanion().stats, SNARK: 15 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("gentle and earnest");
  });

  test("includes offer encouragement", () => {
    const c = makeCompanion({ stats: { ...makeCompanion().stats, SNARK: 20 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("Offer encouragement");
  });
});

// ── High WISDOM modifier ───────────────────────────────────────────────

describe("buildSpeechPrompt — high WISDOM (>70) modifier", () => {
  test("adds longer observations modifier when WISDOM > 70", () => {
    const c = makeCompanion({ stats: { ...makeCompanion().stats, WISDOM: 80 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("longer");
    expect(prompt).toContain("insightful");
  });
});

// ── Low WISDOM modifier ────────────────────────────────────────────────

describe("buildSpeechPrompt — low WISDOM (<30) modifier", () => {
  test("adds brevity modifier when WISDOM < 30", () => {
    const c = makeCompanion({ stats: { ...makeCompanion().stats, WISDOM: 15 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("short");
  });

  test("includes one-word reactions", () => {
    const c = makeCompanion({ stats: { ...makeCompanion().stats, WISDOM: 20 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("One-word reactions");
  });
});

// ── High PATIENCE modifier ─────────────────────────────────────────────

describe("buildSpeechPrompt — high PATIENCE (>70) modifier", () => {
  test("adds selective commenting modifier when PATIENCE > 70", () => {
    const c = makeCompanion({ stats: { ...makeCompanion().stats, PATIENCE: 80 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("Don't comment on small errors");
  });

  test("includes save energy for big ones", () => {
    const c = makeCompanion({ stats: { ...makeCompanion().stats, PATIENCE: 75 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("Save energy for big ones");
  });
});

// ── Low PATIENCE modifier ──────────────────────────────────────────────

describe("buildSpeechPrompt — low PATIENCE (<30) modifier", () => {
  test("adds comment-on-everything modifier when PATIENCE < 30", () => {
    const c = makeCompanion({ stats: { ...makeCompanion().stats, PATIENCE: 15 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("EVERYTHING");
  });

  test("includes even minor issues deserve attention", () => {
    const c = makeCompanion({ stats: { ...makeCompanion().stats, PATIENCE: 20 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("minor issues deserve attention");
  });
});

// ── High DEBUGGING modifier ────────────────────────────────────────────

describe("buildSpeechPrompt — high DEBUGGING (>70) modifier", () => {
  test("adds tool-focused modifier when DEBUGGING > 70", () => {
    const c = makeCompanion({ stats: { ...makeCompanion().stats, DEBUGGING: 80 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("tool results");
  });

  test("includes understanding tools", () => {
    const c = makeCompanion({ stats: { ...makeCompanion().stats, DEBUGGING: 75 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("understand the tools");
  });
});

// ── Low DEBUGGING modifier ─────────────────────────────────────────────

describe("buildSpeechPrompt — low DEBUGGING (<30) modifier", () => {
  test("adds conversation-focused modifier when DEBUGGING < 30", () => {
    const c = makeCompanion({ stats: { ...makeCompanion().stats, DEBUGGING: 15 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("conversation");
  });

  test("includes tools bore you", () => {
    const c = makeCompanion({ stats: { ...makeCompanion().stats, DEBUGGING: 20 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("Tools bore you");
  });
});

// ── Mid-range stats (30-70 inclusive) add no modifier ──────────────────

describe("buildSpeechPrompt — mid-range stats (30-70) add no modifier", () => {
  test("stat at exactly 30 adds no modifier", () => {
    const c = makeCompanion({ stats: { DEBUGGING: 30, PATIENCE: 30, CHAOS: 30, WISDOM: 30, SNARK: 30 } });
    const prompt = buildSpeechPrompt(c);
    // No modifier section should appear when all stats are mid-range
    expect(prompt).not.toContain("Behavioral modifiers");
  });

  test("stat at exactly 70 adds no modifier", () => {
    const c = makeCompanion({ stats: { DEBUGGING: 70, PATIENCE: 70, CHAOS: 70, WISDOM: 70, SNARK: 70 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).not.toContain("Behavioral modifiers");
  });

  test("stat at 50 adds no modifier", () => {
    const c = makeCompanion({ stats: { DEBUGGING: 50, PATIENCE: 50, CHAOS: 50, WISDOM: 50, SNARK: 50 } });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).not.toContain("Behavioral modifiers");
  });
});

// ── Multiple stat modifiers stack ──────────────────────────────────────

describe("buildSpeechPrompt — multiple stat modifiers stack", () => {
  test("CHAOS=80 and SNARK=75 both add modifiers", () => {
    const c = makeCompanion({
      stats: { DEBUGGING: 50, PATIENCE: 50, CHAOS: 80, WISDOM: 50, SNARK: 75 },
    });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("unpredictable");
    expect(prompt).toContain("sarcastic");
  });

  test("all stats high produces all high modifiers", () => {
    const c = makeCompanion({
      stats: { DEBUGGING: 80, PATIENCE: 80, CHAOS: 80, WISDOM: 80, SNARK: 80 },
    });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("unpredictable");   // high CHAOS
    expect(prompt).toContain("sarcastic");        // high SNARK
    expect(prompt).toContain("longer");           // high WISDOM
    expect(prompt).toContain("Don't comment on small errors"); // high PATIENCE
    expect(prompt).toContain("tool results");     // high DEBUGGING
  });

  test("all stats low produces all low modifiers", () => {
    const c = makeCompanion({
      stats: { DEBUGGING: 10, PATIENCE: 10, CHAOS: 10, WISDOM: 10, SNARK: 10 },
    });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("calm and predictable");  // low CHAOS
    expect(prompt).toContain("gentle and earnest");    // low SNARK
    expect(prompt).toContain("short");                 // low WISDOM
    expect(prompt).toContain("EVERYTHING");            // low PATIENCE
    expect(prompt).toContain("conversation");          // low DEBUGGING
  });

  test("mixed high and low stats produce correct modifiers", () => {
    const c = makeCompanion({
      stats: { DEBUGGING: 10, PATIENCE: 80, CHAOS: 80, WISDOM: 10, SNARK: 80 },
    });
    const prompt = buildSpeechPrompt(c);
    // High: CHAOS, SNARK, PATIENCE
    expect(prompt).toContain("unpredictable");
    expect(prompt).toContain("sarcastic");
    expect(prompt).toContain("Don't comment on small errors");
    // Low: WISDOM, DEBUGGING
    expect(prompt).toContain("short");
    expect(prompt).toContain("conversation");
  });
});

// ── Legendary prefix ──────────────────────────────────────────────────

describe("formatLegendaryPrefix — legendary buddies get [NAME] speaks... prefix", () => {
  test("legendary buddy gets prefix", () => {
    const result = formatLegendaryPrefix("Noodle", "legendary");
    expect(result).toContain("[Noodle] speaks...");
  });

  test("non-legendary buddy gets no prefix", () => {
    const result = formatLegendaryPrefix("Noodle", "epic");
    expect(result).toBe("");
  });

  test("all non-legendary rarities produce no prefix", () => {
    const nonLegendary: Rarity[] = ["common", "uncommon", "rare", "epic"];
    for (const rarity of nonLegendary) {
      expect(formatLegendaryPrefix("Buddy", rarity)).toBe("");
    }
  });

  test("prefix includes the correct name", () => {
    const result = formatLegendaryPrefix("SparkleLord", "legendary");
    expect(result).toContain("SparkleLord");
  });
});

// ── Shiny sparkle text ─────────────────────────────────────────────────

describe("formatShinySparkle — shiny buddies get sparkle text in reactions", () => {
  test("shiny buddy gets sparkle text from the sparkle pool", () => {
    const result = formatShinySparkle(true);
    const sparklePool = [
      "*shimmers before speaking*",
      "*sparkles confidently*",
      "*glows faintly with an otherworldly light*",
      "*shimmers with prismatic energy*",
    ];
    expect(sparklePool).toContain(result);
  });

  test("non-shiny buddy gets no sparkle text", () => {
    const result = formatShinySparkle(false);
    expect(result).toBe("");
  });

  test("sparkle text starts with asterisks (action format)", () => {
    const result = formatShinySparkle(true);
    expect(result.startsWith("*")).toBe(true);
  });

  test("sparkle text ends with asterisks (action format)", () => {
    const result = formatShinySparkle(true);
    expect(result.endsWith("*")).toBe(true);
  });
});

// ── STAT_MODIFIERS constant ────────────────────────────────────────────

describe("STAT_MODIFIERS constant — exposes modifier text for verification", () => {
  test("has entries for all 5 stats × 2 thresholds", () => {
    expect(STAT_MODIFIERS.CHAOS.high).toBeDefined();
    expect(STAT_MODIFIERS.CHAOS.low).toBeDefined();
    expect(STAT_MODIFIERS.SNARK.high).toBeDefined();
    expect(STAT_MODIFIERS.SNARK.low).toBeDefined();
    expect(STAT_MODIFIERS.WISDOM.high).toBeDefined();
    expect(STAT_MODIFIERS.WISDOM.low).toBeDefined();
    expect(STAT_MODIFIERS.PATIENCE.high).toBeDefined();
    expect(STAT_MODIFIERS.PATIENCE.low).toBeDefined();
    expect(STAT_MODIFIERS.DEBUGGING.high).toBeDefined();
    expect(STAT_MODIFIERS.DEBUGGING.low).toBeDefined();
  });

  test("high CHAOS contains 'unpredictable'", () => {
    expect(STAT_MODIFIERS.CHAOS.high).toContain("unpredictable");
  });

  test("low CHAOS contains 'calm and predictable'", () => {
    expect(STAT_MODIFIERS.CHAOS.low).toContain("calm and predictable");
  });

  test("high SNARK contains 'sarcastic'", () => {
    expect(STAT_MODIFIERS.SNARK.high).toContain("sarcastic");
  });

  test("low SNARK contains 'gentle and earnest'", () => {
    expect(STAT_MODIFIERS.SNARK.low).toContain("gentle and earnest");
  });

  test("high WISDOM contains 'longer'", () => {
    expect(STAT_MODIFIERS.WISDOM.high).toContain("longer");
  });

  test("low WISDOM contains 'short'", () => {
    expect(STAT_MODIFIERS.WISDOM.low).toContain("short");
  });

  test("high PATIENCE contains \"Don't comment on small errors\"", () => {
    expect(STAT_MODIFIERS.PATIENCE.high).toContain("Don't comment on small errors");
  });

  test("low PATIENCE contains 'EVERYTHING'", () => {
    expect(STAT_MODIFIERS.PATIENCE.low).toContain("EVERYTHING");
  });

  test("high DEBUGGING contains 'tool results'", () => {
    expect(STAT_MODIFIERS.DEBUGGING.high).toContain("tool results");
  });

  test("low DEBUGGING contains 'conversation'", () => {
    expect(STAT_MODIFIERS.DEBUGGING.low).toContain("conversation");
  });
});

// ── Complete prompt structure ──────────────────────────────────────────

describe("buildSpeechPrompt — complete prompt structure", () => {
  test("prompt includes the base identity line with name, species, rarity", () => {
    const c = makeCompanion({ name: "Ziggy", species: "robot", rarity: "epic" });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("Ziggy");
    expect(prompt).toContain("robot");
    expect(prompt).toContain("epic");
  });

  test("prompt includes the original rules (short sentence, max 140 chars)", () => {
    const c = makeCompanion();
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("max 140 characters");
    expect(prompt).toContain("Exactly 1 short sentence");
  });

  test("prompt includes asterisks instruction", () => {
    const c = makeCompanion();
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("asterisks");
  });

  test("prompt has stats section with peak and dump", () => {
    const c = makeCompanion({
      peak: "DEBUGGING",
      dump: "SNARK",
      stats: { DEBUGGING: 90, SNARK: 8, CHAOS: 50, PATIENCE: 50, WISDOM: 50 },
    });
    const prompt = buildSpeechPrompt(c);
    expect(prompt).toContain("peak stat");
    expect(prompt).toContain("dump stat");
    expect(prompt).toContain("DEBUGGING");
    expect(prompt).toContain("90");
    expect(prompt).toContain("SNARK");
    expect(prompt).toContain("8");
  });
});
