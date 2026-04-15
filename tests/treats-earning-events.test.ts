import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * Tests for the treats-earning-events feature.
 *
 * These are code-structure tests that verify the addTreats calls are placed
 * at the correct call sites alongside bumpStat in index.ts and src/commands.ts.
 * Since the event handlers depend on the pi runtime, we verify correctness by
 * inspecting the source code structure and running type-checks.
 *
 * Note: addTreats calls use shinyTreatMultiplier for 2x shiny treat earning.
 * The pattern is addTreats(N * shinyTreatMultiplier(companion)).
 */

const INDEX_TS = readFileSync("index.ts", "utf8");
const COMMANDS_TS = readFileSync("src/commands.ts", "utf8");

describe("Treat earning events — code structure", () => {

  describe("session_start earns 5 treats (with shiny multiplier)", () => {
    test("addTreats with 5 * shinyTreatMultiplier appears in session_start handler", () => {
      expect(INDEX_TS).toContain("addTreats(5 * shinyTreatMultiplier");
    });

    test("addTreats(5 * shinyTreatMultiplier) follows bumpStat('sessions') in session_start", () => {
      // Find the session_start handler region and verify order
      const sessionStartIdx = INDEX_TS.indexOf('pi.on("session_start"');
      expect(sessionStartIdx).toBeGreaterThan(-1);

      const handlerBlock = INDEX_TS.slice(sessionStartIdx);

      const bumpStatIdx = handlerBlock.indexOf('bumpStat("sessions")');
      const addTreatsIdx = handlerBlock.indexOf("addTreats(5 * shinyTreatMultiplier");
      expect(bumpStatIdx).toBeGreaterThan(-1);
      expect(addTreatsIdx).toBeGreaterThan(-1);
      // addTreats should come after bumpStat
      expect(addTreatsIdx).toBeGreaterThan(bumpStatIdx);
    });

    test("addTreats(5 * shinyTreatMultiplier) appears exactly once in index.ts", () => {
      const count = INDEX_TS.split("addTreats(5 * shinyTreatMultiplier").length - 1;
      expect(count).toBe(1);
    });
  });

  describe("pet handler earns 1 treat (with shiny multiplier)", () => {
    test("addTreats with 1 * shinyTreatMultiplier appears in commands.ts pet handler", () => {
      expect(COMMANDS_TS).toContain("addTreats(1 * shinyTreatMultiplier");
    });

    test("addTreats(1 * shinyTreatMultiplier) follows bumpStat('timesPetted') in pet handler", () => {
      const petCaseIdx = COMMANDS_TS.indexOf('case "pet"');
      expect(petCaseIdx).toBeGreaterThan(-1);

      // Look in the region after "pet" case
      const petBlock = COMMANDS_TS.slice(petCaseIdx, petCaseIdx + 500);

      const bumpStatIdx = petBlock.indexOf('bumpStat("timesPetted")');
      const addTreatsIdx = petBlock.indexOf("addTreats(1 * shinyTreatMultiplier");
      expect(bumpStatIdx).toBeGreaterThan(-1);
      expect(addTreatsIdx).toBeGreaterThan(-1);
      // addTreats should be right after bumpStat
      expect(addTreatsIdx).toBeGreaterThan(bumpStatIdx);
    });
  });

  describe("tool_result reaction earns 1 treat (with shiny multiplier)", () => {
    test("addTreats with 1 * shinyTreatMultiplier appears in index.ts tool_result handler", () => {
      expect(INDEX_TS).toContain("addTreats(1 * shinyTreatMultiplier");
    });

    test("addTreats(1 * shinyTreatMultiplier) follows bumpStat('reactionsTriggered') in tool_result handler", () => {
      const toolResultIdx = INDEX_TS.indexOf('pi.on("tool_result"');
      expect(toolResultIdx).toBeGreaterThan(-1);

      const handlerBlock = INDEX_TS.slice(toolResultIdx);

      const bumpStatIdx = handlerBlock.indexOf('bumpStat("reactionsTriggered")');
      const addTreatsIdx = handlerBlock.indexOf("addTreats(1 * shinyTreatMultiplier");
      expect(bumpStatIdx).toBeGreaterThan(-1);
      expect(addTreatsIdx).toBeGreaterThan(-1);
      expect(addTreatsIdx).toBeGreaterThan(bumpStatIdx);
    });
  });

  describe("message_end observation earns 2 treats (with shiny multiplier)", () => {
    test("addTreats with 2 * shinyTreatMultiplier appears in index.ts message_end handler", () => {
      expect(INDEX_TS).toContain("addTreats(2 * shinyTreatMultiplier");
    });

    test("addTreats(2 * shinyTreatMultiplier) follows bumpStat('observations') in message_end handler", () => {
      const messageEndIdx = INDEX_TS.indexOf('pi.on("message_end"');
      expect(messageEndIdx).toBeGreaterThan(-1);

      const handlerBlock = INDEX_TS.slice(messageEndIdx);

      const bumpStatIdx = handlerBlock.indexOf('bumpStat("observations")');
      const addTreatsIdx = handlerBlock.indexOf("addTreats(2 * shinyTreatMultiplier");
      expect(bumpStatIdx).toBeGreaterThan(-1);
      expect(addTreatsIdx).toBeGreaterThan(-1);
      expect(addTreatsIdx).toBeGreaterThan(bumpStatIdx);
    });
  });

  describe("Shiny 2x treat multiplier", () => {
    test("index.ts imports shinyTreatMultiplier from state.ts", () => {
      expect(INDEX_TS).toContain("shinyTreatMultiplier");
      expect(INDEX_TS).toMatch(/from\s+["']\.\/src\/state\.ts["']/);
    });

    test("commands.ts imports shinyTreatMultiplier from state.ts", () => {
      expect(COMMANDS_TS).toContain("shinyTreatMultiplier");
      expect(COMMANDS_TS).toMatch(/from\s+["']\.\/state\.ts["']/);
    });

    test("all addTreats in index.ts use shinyTreatMultiplier (except release)", () => {
      // Count addTreats calls with shinyTreatMultiplier in index.ts
      const withMultiplier = INDEX_TS.match(/addTreats\(\d+ \* shinyTreatMultiplier/g);
      expect(withMultiplier).not.toBeNull();
      // Should be 4: session_start(5), error(2), reaction(1), observation(2)
      expect(withMultiplier!.length).toBe(4);
    });
  });

  describe("No double-counting", () => {
    test("commentsMade bumpStat does NOT earn treats (direct address path)", () => {
      // Direct address gets bumpStat("commentsMade") but should NOT get addTreats
      const messageEndIdx = INDEX_TS.indexOf('pi.on("message_end"');
      const handlerBlock = INDEX_TS.slice(messageEndIdx);

      // Find the direct address block (the one that returns early)
      const commentsMadeIdx = handlerBlock.indexOf('bumpStat("commentsMade")');
      expect(commentsMadeIdx).toBeGreaterThan(-1);

      // Check a small window around commentsMade for addTreats — should NOT be there
      const window = handlerBlock.slice(
        Math.max(0, commentsMadeIdx - 50),
        commentsMadeIdx + 100
      );
      expect(window).not.toContain("addTreats");
    });
  });

  describe("Imports", () => {
    test("index.ts imports addTreats from state.ts", () => {
      expect(INDEX_TS).toContain("addTreats");
      expect(INDEX_TS).toMatch(/from\s+["']\.\/src\/state\.ts["']/);
    });

    test("commands.ts imports addTreats from state.ts", () => {
      expect(COMMANDS_TS).toContain("addTreats");
      expect(COMMANDS_TS).toMatch(/from\s+["']\.\/state\.ts["']/);
    });
  });
});
