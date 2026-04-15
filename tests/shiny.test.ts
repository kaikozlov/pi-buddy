import { describe, expect, test } from "bun:test";
import { renderBuddyCard, renderBuddyDashboard } from "../src/render.ts";
import { renderSprite } from "../src/sprites.ts";
import { buildFullBuddyBlock } from "../src/editor.ts";
import { shinyReaction, SHINY_REACTIONS } from "../src/reactions.ts";
import { shinyTreatMultiplier } from "../src/state.ts";
import type { Companion, Species, Rarity, StatName, Eye, Hat } from "../src/types.ts";
import type { GlobalBuddyStats, PerBuddyStats } from "../src/state.ts";

/** Minimal test companion. */
function makeCompanion(overrides: Partial<Companion> = {}): Companion {
  return {
    name: "TestBuddy",
    personality: "A test companion",
    hatchedAt: Date.now(),
    rarity: "common" as Rarity,
    species: "cat" as Species,
    eye: "·" as Eye,
    hat: "none" as Hat,
    shiny: false,
    stats: {
      DEBUGGING: 50,
      PATIENCE: 50,
      CHAOS: 50,
      WISDOM: 50,
      SNARK: 50,
    } as Record<StatName, number>,
    peak: "CHAOS" as StatName,
    dump: "PATIENCE" as StatName,
    ...overrides,
  };
}

const defaultPerBuddy: PerBuddyStats = {
  commentsMade: 0,
  timesPetted: 0,
  observations: 0,
  sessions: 0,
  reactionsTriggered: 0,
};

// ── VAL-T4-011: Shiny sparkle frame line ─────────────────────────────

describe("Shiny sparkle frame line", () => {
  test("shiny companion has sparkle frame line above sprite in renderSprite", () => {
    const companion = makeCompanion({ shiny: true, species: "cat" });
    const sprite = renderSprite(companion, 0);
    // The first line should contain sparkle characters like . o O o .
    const sparklePattern = /[.oO*✦]/;
    const firstLine = sprite[0] ?? "";
    expect(sparklePattern.test(firstLine)).toBe(true);
  });

  test("non-shiny companion has no sparkle frame line", () => {
    const companion = makeCompanion({ shiny: false, species: "cat" });
    const sprite = renderSprite(companion, 0);
    // No sparkle pattern should be above the sprite
    // The sprite should start with normal cat art (empty line or /\_/\)
    const sparklePattern = /\. o O o \./;
    const hasSparkle = sprite.some(line => sparklePattern.test(line));
    expect(hasSparkle).toBe(false);
  });

  test("sparkle frame uses cyan/white ANSI colors", () => {
    const companion = makeCompanion({ shiny: true, species: "cat" });
    const sprite = renderSprite(companion, 0);
    // Sparkle line should contain cyan (\x1b[36m) or white (\x1b[37m or \x1b[97m)
    const sparkleLine = sprite[0] ?? "";
    const hasColor = sparkleLine.includes("\x1b[36m") || sparkleLine.includes("\x1b[37m") || sparkleLine.includes("\x1b[97m");
    expect(hasColor).toBe(true);
  });

  test("sparkle frame appears in buildFullBuddyBlock for shiny companion", () => {
    const companion = makeCompanion({ shiny: true, species: "cat" });
    const block = buildFullBuddyBlock(companion, undefined, 0, false, false, false, 0);
    // The block should contain sparkle characters
    const sparklePattern = /\. o O o \./;
    const hasSparkle = block.lines.some(line => sparklePattern.test(line));
    expect(hasSparkle).toBe(true);
  });
});

// ── VAL-T4-012: Shiny unique reaction pool ────────────────────────────

describe("Shiny unique reaction pool", () => {
  test("shinyReaction returns a non-empty string", () => {
    const reaction = shinyReaction();
    expect(reaction).toBeTruthy();
    expect(typeof reaction).toBe("string");
    expect(reaction.length).toBeGreaterThan(0);
  });

  test("SHINY_REACTIONS has multiple unique entries", () => {
    expect(SHINY_REACTIONS.length).toBeGreaterThanOrEqual(5);
  });

  test("shiny reactions are distinct from non-shiny reactions", () => {
    // Shiny reactions should contain shimmer/sparkle/glow themed text
    const samples = new Set<string>();
    for (let i = 0; i < 100; i++) {
      samples.add(shinyReaction());
    }
    const allText = [...samples].join(" ");
    const hasShimmerOrSparkle = allText.includes("shimmer") || allText.includes("sparkle") || allText.includes("glow") || allText.includes("glisten");
    expect(hasShimmerOrSparkle).toBe(true);
  });
});

// ── VAL-T4-013: Shiny buddies earn 2x treats ──────────────────────────

describe("Shiny buddies earn 2x treats", () => {
  test("shinyTreatMultiplier returns 2 for shiny companions", () => {
    expect(shinyTreatMultiplier({ shiny: true } as Companion)).toBe(2);
  });

  test("shinyTreatMultiplier returns 1 for non-shiny companions", () => {
    expect(shinyTreatMultiplier({ shiny: false } as Companion)).toBe(1);
  });

  test("shinyTreatMultiplier returns 1 when shiny is undefined", () => {
    expect(shinyTreatMultiplier({} as Companion)).toBe(1);
  });
});

// ── VAL-T4-014: SPARKLE badge on buddy card ───────────────────────────

describe("SPARKLE badge on buddy card", () => {
  test("shiny companion card shows SPARKLE badge", () => {
    const companion = makeCompanion({ shiny: true, rarity: "rare", species: "cat" });
    const card = renderBuddyCard(companion);
    expect(card).toContain("SPARKLE");
  });

  test("non-shiny companion card does not show SPARKLE badge", () => {
    const companion = makeCompanion({ shiny: false, rarity: "rare", species: "cat" });
    const card = renderBuddyCard(companion);
    expect(card).not.toContain("SPARKLE");
  });

  test("SPARKLE badge appears next to rarity text", () => {
    const companion = makeCompanion({ shiny: true, rarity: "epic", species: "dragon" });
    const card = renderBuddyCard(companion);
    // SPARKLE should be on the same line as the rarity/species info
    const lines = card.split("\n");
    const sparkleLine = lines.find(l => l.includes("SPARKLE"));
    expect(sparkleLine).toBeTruthy();
    // The same line should also contain the rarity (EPIC) or species
    expect(sparkleLine!.includes("EPIC") || sparkleLine!.includes("dragon")).toBe(true);
  });
});

// ── VAL-T4-015: Dashboard shows Shinies found count ───────────────────

describe("Dashboard shows Shinies found count", () => {
  test("dashboard renders Shinies found: N in right column", () => {
    const companion = makeCompanion({ shiny: true });
    const global: GlobalBuddyStats & { shiniesFound?: number } = {
      hatches: 5,
      treats: 30,
      totalTreatsEarned: 100,
      shiniesFound: 3,
    };
    const result = renderBuddyDashboard(companion, undefined, defaultPerBuddy, global as GlobalBuddyStats);
    expect(result).toContain("Shinies found: 3");
  });

  test("dashboard shows Shinies found: 0 when no shinies", () => {
    const companion = makeCompanion({ shiny: false });
    const global: GlobalBuddyStats & { shiniesFound?: number } = {
      hatches: 2,
      treats: 10,
      totalTreatsEarned: 50,
      shiniesFound: 0,
    };
    const result = renderBuddyDashboard(companion, undefined, defaultPerBuddy, global as GlobalBuddyStats);
    expect(result).toContain("Shinies found: 0");
  });
});
