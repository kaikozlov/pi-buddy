import { test, expect, describe } from "bun:test";
import {
  detectBashReaction,
  detectEditReaction,
  detectWriteReaction,
  detectGrepReaction,
  detectReadReaction,
  PET_REACTIONS,
  petReaction,
} from "../src/reactions.ts";
import { SPECIES } from "../src/types.ts";

describe("PET_REACTIONS", () => {
  test("has an entry for every species", () => {
    for (const species of SPECIES) {
      expect(PET_REACTIONS[species]).toBeDefined();
      expect(typeof PET_REACTIONS[species]).toBe("string");
      expect(PET_REACTIONS[species].length).toBeGreaterThan(0);
    }
  });
});

describe("petReaction", () => {
  test("returns species-specific reaction", () => {
    const companion = { species: "cat", name: "Test", personality: "", rarity: "common", stats: { DEBUGGING: 50, PATIENCE: 50, CHAOS: 50, WISDOM: 50, SNARK: 50 }, peak: "DEBUGGING" as const, dump: "SNARK" as const, eyes: "normal", hat: "none", shiny: false };
    expect(petReaction(companion)).toBe("*purrs, but only a little*");
  });

  test("returns fallback for unknown species", () => {
    const companion = { species: "unknown_species", name: "Test", personality: "", rarity: "common", stats: { DEBUGGING: 50, PATIENCE: 50, CHAOS: 50, WISDOM: 50, SNARK: 50 }, peak: "DEBUGGING" as const, dump: "SNARK" as const, eyes: "normal", hat: "none", shiny: false };
    expect(petReaction(companion)).toBe("*happy creature noises*");
  });
});

describe("detectBashReaction", () => {
  test("detects traceback", () => {
    expect(detectBashReaction("Something went wrong\nTraceback (most recent call last):")).toBe("*winces at the traceback*");
  });

  test("detects N failed tests", () => {
    expect(detectBashReaction("3 failed, 7 passed")).toBe("*tilts head* 3 tests failed.");
  });

  test("detects 1 failed test (singular)", () => {
    expect(detectBashReaction("1 failed, 9 passed")).toBe("*tilts head* 1 test failed.");
  });

  test("detects error keyword", () => {
    expect(detectBashReaction("Some error occurred")).toBe("*slow blink* that didn't look right.");
  });

  test("detects fatal keyword", () => {
    expect(detectBashReaction("A fatal exception has occurred")).toBe("*backs away slowly*");
  });

  test("detects large diff", () => {
    const lines: string[] = [];
    for (let i = 0; i < 100; i++) lines.push(`+line ${i}`);
    expect(detectBashReaction(lines.join("\n"))).toContain("100 changed lines");
  });

  test("returns undefined for unremarkable output", () => {
    expect(detectBashReaction("All tests passed")).toBeUndefined();
  });
});

describe("detectEditReaction", () => {
  test("detects large file edit (200+ lines)", () => {
    const content = Array.from({ length: 250 }, (_, i) => `line ${i}`).join("\n");
    expect(detectEditReaction("file.ts", content)).toContain("250 lines");
  });

  test("detects TODO/FIXME", () => {
    expect(detectEditReaction("file.ts", "some code\nTODO: fix later\nmore code")).toBe("*sniffs* smells like technical debt.");
    expect(detectEditReaction("file.ts", "some code\nFIXME: broken\nmore code")).toBe("*sniffs* smells like technical debt.");
  });

  test("detects debug logging (console.log)", () => {
    expect(detectEditReaction("file.ts", "console.log('debug')")).toBe("*judgmental stare* debug logging?");
  });

  test("detects debug logging (print)", () => {
    expect(detectEditReaction("file.py", "print('debug')")).toBe("*judgmental stare* debug logging?");
  });

  test("returns undefined for unremarkable content", () => {
    expect(detectEditReaction("file.ts", "const x = 1;\nconst y = 2;")).toBeUndefined();
  });
});

describe("detectWriteReaction", () => {
  test("detects large new file (100+ lines)", () => {
    const content = Array.from({ length: 150 }, (_, i) => `line ${i}`).join("\n");
    expect(detectWriteReaction("file.ts", content)).toContain("150 new lines");
  });

  test("returns undefined for small files", () => {
    expect(detectWriteReaction("file.ts", "const x = 1;")).toBeUndefined();
  });
});

describe("detectGrepReaction", () => {
  test("detects many matches (50+)", () => {
    const matches = Array.from({ length: 60 }, (_, i) => `file.ts:${i + 1}:match`).join("\n");
    expect(detectGrepReaction(matches)).toContain("60 matches");
  });

  test("detects zero matches", () => {
    // Empty grep result now triggers the "nothing found" reaction
    expect(detectGrepReaction("")).toBe("*tilts head* nothing found.");
  });

  test("returns reaction for moderate results (5 matches)", () => {
    // 5 matches now triggers the "Manageable" reaction (expanded pool)
    const matches = Array.from({ length: 5 }, (_, i) => `file.ts:${i + 1}:match`).join("\n");
    expect(detectGrepReaction(matches)).toBe("*peeks* 5 matches. Manageable.");
  });
});

describe("detectReadReaction", () => {
  test("detects very long file (500+ lines)", () => {
    const content = Array.from({ length: 600 }, (_, i) => `line ${i}`).join("\n");
    expect(detectReadReaction("file.ts", content)).toContain("600 lines");
  });

  test("returns undefined for normal-length files", () => {
    expect(detectReadReaction("file.ts", Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n"))).toBeUndefined();
  });
});
