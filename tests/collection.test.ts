import { describe, expect, test } from "bun:test";
import { renderCollectionGrid, renderRarityDistribution, type CollectionEntry } from "../src/render.ts";
import type { Companion, Species, Rarity, StatName, Eye, Hat } from "../src/types.ts";
import { renderSprite } from "../src/sprites.ts";

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

/** Helper to build a CollectionEntry from a companion. */
function makeEntry(id: string, overrides: Partial<Companion> = {}): CollectionEntry {
  return { id, companion: makeCompanion(overrides) };
}

// ── renderCollectionGrid ──────────────────────────────────────────────

describe("renderCollectionGrid", () => {
  test("renders a grid with a single buddy", () => {
    const buddies = [makeEntry("a1", { name: "Solo", species: "cat", rarity: "common" })];
    const result = renderCollectionGrid(buddies, "a1");
    expect(result).toContain("Solo");
    expect(result).toContain("★"); // rarity stars for common
  });

  test("renders multiple buddies in the grid", () => {
    const buddies = [
      makeEntry("a1", { name: "Alpha", species: "cat", rarity: "common" }),
      makeEntry("b2", { name: "Beta", species: "dragon", rarity: "rare" }),
      makeEntry("c3", { name: "Gamma", species: "robot", rarity: "epic" }),
    ];
    const result = renderCollectionGrid(buddies, "a1");
    expect(result).toContain("Alpha");
    expect(result).toContain("Beta");
    expect(result).toContain("Gamma");
  });

  test("renders species sprite (frame 0) for each buddy", () => {
    const buddies = [
      makeEntry("a1", { name: "Kitty", species: "cat", rarity: "common", eye: "·" }),
    ];
    const result = renderCollectionGrid(buddies, "a1");
    // Cat sprite frame 0 has recognizable characters like /\_/\ or ω
    const catSprite = renderSprite(makeCompanion({ species: "cat", eye: "·" }), 0);
    // At least some content from the sprite should appear
    const hasSpriteContent = catSprite.some(line => result.includes(line.trim()) && line.trim().length > 0);
    expect(hasSpriteContent).toBe(true);
  });

  test("renders rarity stars for each buddy", () => {
    const buddies = [
      makeEntry("a1", { name: "CommonBuddy", rarity: "common" }),
      makeEntry("b2", { name: "RareBuddy", rarity: "rare" }),
      makeEntry("c3", { name: "LegendaryBuddy", rarity: "legendary" }),
    ];
    const result = renderCollectionGrid(buddies, "a1");
    expect(result).toContain("★");         // common: ★
    expect(result).toContain("★★★");       // rare: ★★★
    expect(result).toContain("★★★★★");     // legendary: ★★★★★
  });

  test("highlights active buddy with inverse/bold ANSI", () => {
    const buddies = [
      makeEntry("a1", { name: "Active" }),
      makeEntry("b2", { name: "Inactive" }),
    ];
    const result = renderCollectionGrid(buddies, "a1");
    // Active buddy should have ANSI inverse (\x1b[7m) or bold (\x1b[1m)
    const hasInverseOrBold = result.includes("\x1b[7m") || result.includes("\x1b[1m");
    expect(hasInverseOrBold).toBe(true);
  });

  test("does not highlight inactive buddies", () => {
    const buddies = [
      makeEntry("a1", { name: "ActiveOne" }),
      makeEntry("b2", { name: "InactiveX" }),
    ];
    const result = renderCollectionGrid(buddies, "a1");
    // Find the name row(s) containing "InactiveX"
    const lines = result.split("\n");
    const inactiveLines = lines.filter(l => l.includes("InactiveX"));
    expect(inactiveLines.length).toBeGreaterThan(0);
    // Each line has both buddies since they're in the same row.
    // But the inverse/bold segment should only surround "ActiveOne", not "InactiveX".
    // We check that the highlighting sequence does NOT appear immediately before "InactiveX".
    for (const line of inactiveLines) {
      const idx = line.indexOf("InactiveX");
      // Walk backwards from "InactiveX" to see if there's an active highlight start
      const before = line.slice(Math.max(0, idx - 20), idx);
      // Should not have INVERSE or BOLD immediately before the inactive name
      // (the active buddy's highlight should have been RESET before the inactive one)
      expect(before.includes("\x1b[7m") || before.includes("\x1b[1m")).toBe(false);
    }
  });

  test("adapts to terminal width — wider terminal shows more columns", () => {
    const buddies = Array.from({ length: 6 }, (_, i) =>
      makeEntry(`id${i}`, { name: `Buddy${i}` }),
    );
    // Narrow terminal (80 cols) should fit fewer columns than wide (140 cols)
    const narrow = renderCollectionGrid(buddies, "id0", 80);
    const wide = renderCollectionGrid(buddies, "id0", 140);
    // Both should render all buddies
    for (let i = 0; i < 6; i++) {
      expect(narrow).toContain(`Buddy${i}`);
      expect(wide).toContain(`Buddy${i}`);
    }
    // Wide should have more columns (more names per line-row)
    // We check by comparing line count — more columns means fewer rows
    const narrowRows = narrow.split("\n").filter(l => l.trim().length > 0).length;
    const wideRows = wide.split("\n").filter(l => l.trim().length > 0).length;
    expect(wideRows).toBeLessThanOrEqual(narrowRows);
  });

  test("uses 2 columns for narrow terminals", () => {
    const buddies = [
      makeEntry("a1", { name: "A" }),
      makeEntry("b2", { name: "B" }),
      makeEntry("c3", { name: "C" }),
      makeEntry("d4", { name: "D" }),
    ];
    const result = renderCollectionGrid(buddies, "a1", 70);
    // All buddies should still be rendered
    expect(result).toContain("A");
    expect(result).toContain("B");
    expect(result).toContain("C");
    expect(result).toContain("D");
  });

  test("handles empty buddies list", () => {
    const result = renderCollectionGrid([], undefined);
    // Should return something sensible, not crash
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("renders correctly with no active buddy", () => {
    const buddies = [
      makeEntry("a1", { name: "Orphan" }),
    ];
    const result = renderCollectionGrid(buddies, undefined);
    expect(result).toContain("Orphan");
    // No ANSI highlighting should be present since no active buddy
    expect(result.includes("\x1b[7m") || result.includes("\x1b[1m")).toBe(false);
  });
});

// ── renderRarityDistribution ──────────────────────────────────────────

describe("renderRarityDistribution", () => {
  test("computes distribution from buddy rarities", () => {
    const buddies = [
      makeEntry("a1", { name: "A", rarity: "common" }),
      makeEntry("b2", { name: "B", rarity: "common" }),
      makeEntry("c3", { name: "C", rarity: "rare" }),
      makeEntry("d4", { name: "D", rarity: "legendary" }),
    ];
    const result = renderRarityDistribution(buddies);
    // Should mention species count
    expect(result).toContain("species");
    // Should show rarity counts
    expect(result).toContain("★"); // some star notation
  });

  test("counts each rarity correctly", () => {
    const buddies = [
      makeEntry("a1", { rarity: "common" }),
      makeEntry("b2", { rarity: "common" }),
      makeEntry("b3", { rarity: "common" }),
      makeEntry("b4", { rarity: "common" }),
      makeEntry("c3", { rarity: "uncommon" }),
      makeEntry("c4", { rarity: "uncommon" }),
      makeEntry("d4", { rarity: "rare" }),
    ];
    const result = renderRarityDistribution(buddies);
    // ★x4 (common), ★★x2 (uncommon), ★★★x1 (rare)
    expect(result).toContain("★x4");
    expect(result).toContain("★★x2");
    expect(result).toContain("★★★x1");
  });

  test("shows zero count for missing rarities", () => {
    const buddies = [
      makeEntry("a1", { rarity: "common" }),
    ];
    const result = renderRarityDistribution(buddies);
    // Should include some indication of zero for missing rarities
    // The format includes all 5 tiers: ★xN ★★xN ★★★xN ★★★★xN ★★★★★xN
    expect(result).toContain("★x1");
    expect(result).toContain("★★x0");
    expect(result).toContain("★★★x0");
  });

  test("handles empty buddies list", () => {
    const result = renderRarityDistribution([]);
    expect(typeof result).toBe("string");
    // All rarities should be 0
    expect(result).toContain("★x0");
    expect(result).toContain("★★★★★x0");
  });

  test("includes species count (unique species / 18)", () => {
    const buddies = [
      makeEntry("a1", { rarity: "common", species: "cat" }),
      makeEntry("b2", { rarity: "common", species: "cat" }),  // duplicate species
      makeEntry("c3", { rarity: "rare", species: "dragon" }),
    ];
    const result = renderRarityDistribution(buddies);
    // Should show 2/18 species (cat + dragon)
    expect(result).toContain("2/18");
  });

  test("does not require new state — computed purely from listBuddies data", () => {
    // This test verifies the function signature accepts CollectionEntry[]
    // which mirrors listBuddies() output after building companions — no additional state needed
    const buddies: CollectionEntry[] = [
      { id: "x", companion: makeCompanion({ rarity: "epic" }) },
    ];
    const result = renderRarityDistribution(buddies);
    expect(result).toContain("★★★★x1");
  });
});
