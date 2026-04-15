import { describe, expect, test } from "bun:test";
import { renderBuddyDashboard } from "../src/render.ts";
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

describe("renderBuddyDashboard — treats display", () => {
  test("shows Treats: N in right column when treats > 0", () => {
    const companion = makeCompanion();
    const global: GlobalBuddyStats = { hatches: 3, treats: 42, totalTreatsEarned: 100, shiniesFound: 0 };

    const result = renderBuddyDashboard(companion, undefined, defaultPerBuddy, global);

    expect(result).toContain("Treats: 42");
  });

  test("shows Lifetime earned: N in right column", () => {
    const companion = makeCompanion();
    const global: GlobalBuddyStats = { hatches: 3, treats: 42, totalTreatsEarned: 100, shiniesFound: 0 };

    const result = renderBuddyDashboard(companion, undefined, defaultPerBuddy, global);

    expect(result).toContain("Lifetime earned: 100");
  });

  test("shows Treats: 0 and Lifetime earned: 0 when treats are zero", () => {
    const companion = makeCompanion();
    const global: GlobalBuddyStats = { hatches: 0, treats: 0, totalTreatsEarned: 0, shiniesFound: 0 };

    const result = renderBuddyDashboard(companion, undefined, defaultPerBuddy, global);

    expect(result).toContain("Treats: 0");
    expect(result).toContain("Lifetime earned: 0");
  });

  test("shows treats below Hatches line in right column", () => {
    const companion = makeCompanion();
    const global: GlobalBuddyStats = { hatches: 5, treats: 10, totalTreatsEarned: 20, shiniesFound: 0 };

    const result = renderBuddyDashboard(companion, undefined, defaultPerBuddy, global);

    // Hatches line should exist
    expect(result).toContain("Hatches (total): 5");
    // Treats lines should also exist
    expect(result).toContain("Treats: 10");
    expect(result).toContain("Lifetime earned: 20");

    // Treats line should come after Hatches line in the output
    const hatchesIdx = result.indexOf("Hatches (total):");
    const treatsIdx = result.indexOf("Treats:");
    const lifetimeIdx = result.indexOf("Lifetime earned:");
    expect(treatsIdx).toBeGreaterThan(hatchesIdx);
    expect(lifetimeIdx).toBeGreaterThan(treatsIdx);
  });

  test("shows treats in the 'All buddies' column header area", () => {
    const companion = makeCompanion();
    const global: GlobalBuddyStats = { hatches: 2, treats: 75, totalTreatsEarned: 200, shiniesFound: 0 };

    const result = renderBuddyDashboard(companion, undefined, defaultPerBuddy, global);

    // The "All buddies" title should be present
    expect(result).toContain("All buddies");
    // And treats data should be in the same column (within the output)
    expect(result).toContain("Treats: 75");
    expect(result).toContain("Lifetime earned: 200");
  });
});
