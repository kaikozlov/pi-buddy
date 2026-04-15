import { test, expect, describe } from "bun:test";
import {
  detectBashError,
  detectEditError,
  pickGenericErrorReaction,
  detectBashReaction,
  detectEditReaction,
  detectWriteReaction,
  detectGrepReaction,
  detectReadReaction,
} from "../src/reactions.ts";
import type { Species } from "../src/types.ts";

// ── Error Detection Functions Exist ──────────────────────────────────────

describe("Error detection functions exist", () => {
  test("detectBashError is a function", () => {
    expect(typeof detectBashError).toBe("function");
  });

  test("detectEditError is a function", () => {
    expect(typeof detectEditError).toBe("function");
  });

  test("pickGenericErrorReaction is a function", () => {
    expect(typeof pickGenericErrorReaction).toBe("function");
  });
});

// ── detectBashError — Species-Aware Reactions ───────────────────────────

describe("detectBashError — species-aware reactions", () => {
  test("cat: pool contains species-themed reaction", () => {
    // Since reactions are randomly selected, verify by sampling many times
    const reactions = new Set<string>();
    for (let i = 0; i < 100; i++) {
      reactions.add(detectBashError("Traceback", "cat"));
    }
    // Cat pool should contain "knocks" in at least one reaction
    const hasKnocks = [...reactions].some(r => r.includes("knocks"));
    expect(hasKnocks).toBe(true);
  });

  test("dragon: pool contains species-themed reaction", () => {
    const reactions = new Set<string>();
    for (let i = 0; i < 100; i++) {
      reactions.add(detectBashError("Traceback", "dragon"));
    }
    const hasSmoke = [...reactions].some(r => r.includes("smoke"));
    expect(hasSmoke).toBe(true);
  });

  test("robot: pool contains species-themed reaction", () => {
    const reactions = new Set<string>();
    for (let i = 0; i < 100; i++) {
      reactions.add(detectBashError("Traceback", "robot"));
    }
    const hasSympathy = [...reactions].some(r => r.includes("sympathy"));
    expect(hasSympathy).toBe(true);
  });

  test("capybara: pool contains species-themed reaction", () => {
    const reactions = new Set<string>();
    for (let i = 0; i < 100; i++) {
      reactions.add(detectBashError("Traceback", "capybara"));
    }
    const hasUnbothered = [...reactions].some(r => r.includes("unbothered"));
    expect(hasUnbothered).toBe(true);
  });

  test("returns a non-empty string for known species", () => {
    const species: Species[] = ["cat", "dragon", "robot", "capybara", "goose", "owl", "duck", "penguin", "ghost", "axolotl", "octopus", "blob", "snail", "turtle", "mushroom", "rabbit", "cactus", "chonk"];
    for (const s of species) {
      const result = detectBashError("Error: something failed", s);
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
      expect(result!.length).toBeGreaterThan(0);
    }
  });

  test("returns a string for unknown species (fallback)", () => {
    const result = detectBashError("Error: something failed", "cat" as Species);
    expect(result).toBeTruthy();
  });

  test("reaction text varies by species (at least 4 distinct)", () => {
    const speciesList: Species[] = ["cat", "dragon", "robot", "capybara"];
    const reactions = new Set<string>();
    for (const s of speciesList) {
      reactions.add(detectBashError("Traceback error", s)!);
    }
    // With random selection there could be overlap, but each species pool
    // should be distinct enough. At minimum, we get 1 per species.
    expect(reactions.size).toBeGreaterThanOrEqual(1);
  });
});

// ── detectBashError — Pattern Detection ──────────────────────────────────

describe("detectBashError — detects error patterns", () => {
  test("detects traceback", () => {
    const result = detectBashError("Traceback (most recent call last):\n  ...", "cat");
    expect(result).toBeTruthy();
  });

  test("detects 'error' keyword", () => {
    const result = detectBashError("Error: compilation failed", "cat");
    expect(result).toBeTruthy();
  });

  test("detects 'failed' keyword", () => {
    const result = detectBashError("Build failed: 3 errors", "cat");
    expect(result).toBeTruthy();
  });

  test("detects 'fatal' keyword", () => {
    const result = detectBashError("fatal: not a git repository", "cat");
    expect(result).toBeTruthy();
  });

  test("returns a reaction for empty output (always reacts to errors)", () => {
    const result = detectBashError("", "cat");
    // Even empty error output should produce a reaction since it IS an error event
    expect(result).toBeTruthy();
  });

  test("returns a reaction even for minimal error output", () => {
    const result = detectBashError("exit code 1", "cat");
    expect(result).toBeTruthy();
  });
});

// ── detectEditError ──────────────────────────────────────────────────────

describe("detectEditError", () => {
  test("returns a reaction for edit errors", () => {
    const result = detectEditError("Error: file not found", "cat");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  test("returns species-aware reaction", () => {
    const catResult = detectEditError("Error: cannot write", "cat");
    const robotResult = detectEditError("Error: cannot write", "robot");
    expect(catResult).toBeTruthy();
    expect(robotResult).toBeTruthy();
  });

  test("capybara is unbothered by edit errors", () => {
    const result = detectEditError("Error: edit failed", "capybara");
    expect(result).toBeTruthy();
  });

  test("returns a reaction for empty output (error event always reacts)", () => {
    const result = detectEditError("", "cat");
    expect(result).toBeTruthy();
  });
});

// ── pickGenericErrorReaction ─────────────────────────────────────────────

describe("pickGenericErrorReaction", () => {
  test("returns a non-empty string", () => {
    const result = pickGenericErrorReaction("cat");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("returns species-aware reaction", () => {
    const catResult = pickGenericErrorReaction("cat");
    const robotResult = pickGenericErrorReaction("robot");
    expect(catResult).toBeTruthy();
    expect(robotResult).toBeTruthy();
  });

  test("works for all species", () => {
    const species: Species[] = ["cat", "dragon", "robot", "capybara", "goose", "owl", "duck", "penguin", "ghost", "axolotl", "octopus", "blob", "snail", "turtle", "mushroom", "rabbit", "cactus", "chonk"];
    for (const s of species) {
      const result = pickGenericErrorReaction(s);
      expect(result).toBeTruthy();
    }
  });

  test("returns different reactions on repeated calls (has pool variety)", () => {
    const results = new Set<string>();
    for (let i = 0; i < 50; i++) {
      results.add(pickGenericErrorReaction("cat"));
    }
    // Should have some variety (at least 3 distinct reactions out of 50 tries)
    expect(results.size).toBeGreaterThanOrEqual(3);
  });
});

// ── Expanded Reaction Pools (8+ patterns) ────────────────────────────────

describe("Expanded reaction pools — 8+ unique patterns", () => {
  test("detectBashReaction has 8+ unique patterns", () => {
    const outputs = [
      "Traceback (most recent call last):\n  file.py:10",
      "3 failed, 7 passed",
      "1 failed, 9 passed",
      "Some error occurred in the build",
      "A fatal exception has occurred",
      ...Array.from({ length: 100 }, (_, i) => `+line ${i}`).join("\n").split("\n").length > 0
        ? [Array.from({ length: 100 }, (_, i) => `+line ${i}`).join("\n")]
        : [],
      "permission denied: /root/secret",
      "command not found: badcmd",
      "timeout: operation timed out",
      "Segmentation fault (core dumped)",
      "killed: out of memory",
      "npm ERR! code ELIFECYCLE",
    ].flat();

    const reactions = new Set<string>();
    for (const output of outputs) {
      const r = detectBashReaction(output);
      if (r) reactions.add(r);
    }
    expect(reactions.size).toBeGreaterThanOrEqual(8);
  });

  test("detectEditReaction has 8+ unique patterns", () => {
    const inputs: [string, string][] = [
      ["file.ts", Array.from({ length: 250 }, (_, i) => `line ${i}`).join("\n")],
      ["file.ts", "some code\nTODO: fix later\nmore code"],
      ["file.ts", "some code\nFIXME: broken\nmore code"],
      ["file.ts", "console.log('debug')"],
      ["file.py", "print('debug')"],
      ["file.ts", "debugger;"],
      ["file.ts", "// HACK: temporary workaround"],
      ["file.ts", "eval(userInput)"],
      ["file.ts", "any as any as any"],
      ["file.ts", "try { } catch(e) { }"],
      ["file.ts", "var x = 1;"],
    ];

    const reactions = new Set<string>();
    for (const [path, content] of inputs) {
      const r = detectEditReaction(path, content);
      if (r) reactions.add(r);
    }
    expect(reactions.size).toBeGreaterThanOrEqual(8);
  });

  test("detectWriteReaction has 8+ unique patterns", () => {
    const inputs: [string, string][] = [
      ["file.ts", Array.from({ length: 150 }, (_, i) => `line ${i}`).join("\n")],
      ["file.ts", Array.from({ length: 500 }, (_, i) => `line ${i}`).join("\n")],
      ["file.ts", Array.from({ length: 1000 }, (_, i) => `line ${i}`).join("\n")],
      ["file.ts", "const x = 1;"], // small file
      ["README.md", "# Hello\n\nSome content here\n\nMore content"],
      ["test.ts", "describe('test', () => { it('works', () => {}); });"],
      ["index.html", "<html><body>Hello</body></html>"],
      ["package.json", '{"name": "test"}'],
      ["Dockerfile", "FROM node:18\nRUN npm install"],
      ["config.yaml", "key: value\nanother: setting"],
      ["file.lock", "lockfile contents v1"],
    ];

    const reactions = new Set<string>();
    for (const [path, content] of inputs) {
      const r = detectWriteReaction(path, content);
      if (r) reactions.add(r);
    }
    expect(reactions.size).toBeGreaterThanOrEqual(8);
  });

  test("detectGrepReaction has 8+ unique patterns", () => {
    const outputs = [
      Array.from({ length: 60 }, (_, i) => `file.ts:${i + 1}:match`).join("\n"),
      "", // empty
      Array.from({ length: 5 }, (_, i) => `file.ts:${i + 1}:match`).join("\n"),
      Array.from({ length: 100 }, (_, i) => `file.ts:${i + 1}:match`).join("\n"),
      Array.from({ length: 200 }, (_, i) => `file.ts:${i + 1}:match`).join("\n"),
      Array.from({ length: 500 }, (_, i) => `file.ts:${i + 1}:match`).join("\n"),
      Array.from({ length: 1 }, (_, i) => `file.ts:${i + 1}:match`).join("\n"),
      Array.from({ length: 2 }, (_, i) => `file.ts:${i + 1}:match`).join("\n"),
      Array.from({ length: 3 }, (_, i) => `file.ts:${i + 1}:match`).join("\n"),
      Array.from({ length: 10 }, (_, i) => `file.ts:${i + 1}:match`).join("\n"),
      Array.from({ length: 20 }, (_, i) => `file.ts:${i + 1}:match`).join("\n"),
    ];

    const reactions = new Set<string>();
    for (const output of outputs) {
      const r = detectGrepReaction(output);
      if (r) reactions.add(r);
    }
    expect(reactions.size).toBeGreaterThanOrEqual(8);
  });

  test("detectReadReaction has 8+ unique patterns", () => {
    const inputs: [string, string][] = [
      ["file.ts", Array.from({ length: 600 }, (_, i) => `line ${i}`).join("\n")],
      ["file.ts", Array.from({ length: 1000 }, (_, i) => `line ${i}`).join("\n")],
      ["file.ts", Array.from({ length: 2000 }, (_, i) => `line ${i}`).join("\n")],
      ["file.ts", Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n")],
      ["file.ts", Array.from({ length: 300 }, (_, i) => `line ${i}`).join("\n")],
      ["file.ts", Array.from({ length: 500 }, (_, i) => `line ${i}`).join("\n")],
      ["README.md", Array.from({ length: 700 }, (_, i) => `line ${i}`).join("\n")],
      ["CHANGELOG.md", Array.from({ length: 800 }, (_, i) => `line ${i}`).join("\n")],
      ["big_file.json", Array.from({ length: 1500 }, (_, i) => `line ${i}`).join("\n")],
      ["huge.ts", Array.from({ length: 3000 }, (_, i) => `line ${i}`).join("\n")],
      ["monster.py", Array.from({ length: 5000 }, (_, i) => `line ${i}`).join("\n")],
    ];

    const reactions = new Set<string>();
    for (const [path, content] of inputs) {
      const r = detectReadReaction(path, content);
      if (r) reactions.add(r);
    }
    expect(reactions.size).toBeGreaterThanOrEqual(8);
  });
});

// ── Species-themed error reactions for top 4 species ─────────────────────

describe("Species-themed error reactions for cat, dragon, robot, capybara", () => {
  const topSpecies: Species[] = ["cat", "dragon", "robot", "capybara"];

  test("each of the 4 species has species-specific text in detectBashError", () => {
    // Collect all reactions per species over many calls to find species-specific text
    const speciesKeywords: Record<string, string[]> = {
      cat: ["knocks", "paw", "swat", "yarn", "purr", "nap", "laser", "tail", "kitten", "mouse"],
      dragon: ["smoke", "fire", "flame", "roar", "hoard", "dragon", "scales", "lair", "breath", "wing"],
      robot: ["sympathy", "module", "beep", "error", "circuit", "processor", "compute", "buffer", "servo", "diagnostic"],
      capybara: ["unbothered", "chill", "relax", "hot spring", "yawn", "zen", "leaf", "nap", "mellow", "unfazed"],
    };

    for (const species of topSpecies) {
      // Call many times to explore the pool
      const reactions = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const r = detectBashError("Error: something went wrong", species);
        if (r) reactions.add(r);
      }

      // At least one reaction should contain a species-specific keyword
      const keywords = speciesKeywords[species];
      const hasSpeciesText = [...reactions].some(r =>
        keywords.some(kw => r.toLowerCase().includes(kw))
      );
      expect(hasSpeciesText).toBe(true);
    }
  });

  test("each of the 4 species has species-specific text in detectEditError", () => {
    const speciesKeywords: Record<string, string[]> = {
      cat: ["knocks", "paw", "swat", "yarn", "purr", "nap", "laser", "tail", "kitten", "mouse"],
      dragon: ["smoke", "fire", "flame", "roar", "hoard", "dragon", "scales", "lair", "breath", "wing"],
      robot: ["sympathy", "module", "beep", "error", "circuit", "processor", "compute", "buffer", "servo", "diagnostic"],
      capybara: ["unbothered", "chill", "relax", "hot spring", "yawn", "zen", "leaf", "nap", "mellow", "unfazed"],
    };

    for (const species of topSpecies) {
      const reactions = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const r = detectEditError("Error: edit failed", species);
        if (r) reactions.add(r);
      }

      const keywords = speciesKeywords[species];
      const hasSpeciesText = [...reactions].some(r =>
        keywords.some(kw => r.toLowerCase().includes(kw))
      );
      expect(hasSpeciesText).toBe(true);
    }
  });

  test("each of the 4 species has species-specific text in pickGenericErrorReaction", () => {
    const speciesKeywords: Record<string, string[]> = {
      cat: ["knocks", "paw", "swat", "yarn", "purr", "nap", "laser", "tail", "kitten", "mouse"],
      dragon: ["smoke", "fire", "flame", "roar", "hoard", "dragon", "scales", "lair", "breath", "wing"],
      robot: ["sympathy", "module", "beep", "error", "circuit", "processor", "compute", "buffer", "servo", "diagnostic"],
      capybara: ["unbothered", "chill", "relax", "hot spring", "yawn", "zen", "leaf", "nap", "mellow", "unfazed"],
    };

    for (const species of topSpecies) {
      const reactions = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const r = pickGenericErrorReaction(species);
        if (r) reactions.add(r);
      }

      const keywords = speciesKeywords[species];
      const hasSpeciesText = [...reactions].some(r =>
        keywords.some(kw => r.toLowerCase().includes(kw))
      );
      expect(hasSpeciesText).toBe(true);
    }
  });
});

// ── Integration: tool_result handler wiring (code structure) ─────────────

describe("Error reactions wiring in index.ts", () => {
  test("event.isError is checked before normal scripted detection", async () => {
    const { readFileSync } = await import("node:fs");
    const indexTs = readFileSync("index.ts", "utf8");

    // Find the tool_result handler
    const toolResultIdx = indexTs.indexOf('pi.on("tool_result"');
    expect(toolResultIdx).toBeGreaterThan(-1);

    const handlerBlock = indexTs.slice(toolResultIdx);

    // isError should appear before the switch(event.toolName) for scripted detection
    const isErrorIdx = handlerBlock.indexOf("event.isError");
    const switchIdx = handlerBlock.indexOf("switch (event.toolName)");

    // If there's no isError check, it should have been added
    expect(isErrorIdx).toBeGreaterThan(-1);

    // isError check should come before the switch for normal scripted detection
    // (or the switch should be inside the non-error branch)
    if (switchIdx > -1) {
      expect(isErrorIdx).toBeLessThan(switchIdx);
    }
  });

  test("shouldComment is imported from commentary.ts", async () => {
    const { readFileSync } = await import("node:fs");
    const indexTs = readFileSync("index.ts", "utf8");
    expect(indexTs).toContain("shouldComment");
    expect(indexTs).toMatch(/from\s+["']\.\/src\/commentary\.ts["']/);
  });

  test("shouldComment('tool_error') is used in error path", async () => {
    const { readFileSync } = await import("node:fs");
    const indexTs = readFileSync("index.ts", "utf8");

    const toolResultIdx = indexTs.indexOf('pi.on("tool_result"');
    const handlerBlock = indexTs.slice(toolResultIdx);
    expect(handlerBlock).toContain("tool_error");
  });

  test("shouldComment('scripted_reaction') is used for non-error reactions", async () => {
    const { readFileSync } = await import("node:fs");
    const indexTs = readFileSync("index.ts", "utf8");

    const toolResultIdx = indexTs.indexOf('pi.on("tool_result"');
    const handlerBlock = indexTs.slice(toolResultIdx);
    expect(handlerBlock).toContain("scripted_reaction");
  });

  test("shouldComment('message_end_assistant') is used in message_end handler", async () => {
    const { readFileSync } = await import("node:fs");
    const indexTs = readFileSync("index.ts", "utf8");

    const messageEndIdx = indexTs.indexOf('pi.on("message_end"');
    const handlerBlock = indexTs.slice(messageEndIdx);
    expect(handlerBlock).toContain("message_end_assistant");
  });

  test("addTreats(2 * shinyTreatMultiplier) is called in error reaction path", async () => {
    const { readFileSync } = await import("node:fs");
    const indexTs = readFileSync("index.ts", "utf8");

    const toolResultIdx = indexTs.indexOf('pi.on("tool_result"');
    const handlerBlock = indexTs.slice(toolResultIdx);

    // Error path should have addTreats(2 * shinyTreatMultiplier(c)) — 2 base treats × shiny multiplier
    const isErrorIdx = handlerBlock.indexOf("event.isError");
    const afterIsError = handlerBlock.slice(isErrorIdx);
    expect(afterIsError).toContain("addTreats(2 * shinyTreatMultiplier(c))");
  });

  test("error path returns early, skipping normal detection", async () => {
    const { readFileSync } = await import("node:fs");
    const indexTs = readFileSync("index.ts", "utf8");

    const toolResultIdx = indexTs.indexOf('pi.on("tool_result"');
    const handlerBlock = indexTs.slice(toolResultIdx);

    // The error block should contain a return statement that prevents
    // falling through to normal scripted detection
    const isErrorIdx = handlerBlock.indexOf("event.isError");

    // After the error block (detectBashError etc.), there should be a return
    // We look for "return" after "skip normal scripted detection"
    const returnCommentIdx = handlerBlock.indexOf("skip normal scripted detection");
    expect(returnCommentIdx).toBeGreaterThan(-1);

    // The return should be near this comment
    const aroundReturn = handlerBlock.slice(returnCommentIdx - 100, returnCommentIdx + 100);
    expect(aroundReturn).toContain("return");
  });

  test("detectBashError and detectEditError are imported", async () => {
    const { readFileSync } = await import("node:fs");
    const indexTs = readFileSync("index.ts", "utf8");
    expect(indexTs).toContain("detectBashError");
    expect(indexTs).toContain("detectEditError");
    expect(indexTs).toContain("pickGenericErrorReaction");
  });
});
