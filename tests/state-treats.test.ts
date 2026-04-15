import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadGlobalHatchStats,
  loadTreats,
  addTreats,
  spendTreats,
  _setStateDir,
} from "../src/state.ts";

// Temp directory for test state
let tmpDir: string;
let stateDir: string;

function makeTmpDir(): string {
  const d = join(tmpdir(), `pi-buddy-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(d, { recursive: true });
  return d;
}

function setupStateFiles(stats?: Record<string, unknown>): void {
  mkdirSync(stateDir, { recursive: true });
  if (stats) {
    writeFileSync(join(stateDir, "stats.json"), JSON.stringify(stats, null, 2));
  }
  writeFileSync(join(stateDir, "config.json"), JSON.stringify({
    commentCooldown: 60,
    commentChance: 0.35,
    companionMuted: false,
  }));
  writeFileSync(join(stateDir, "menagerie.json"), JSON.stringify({ buddies: {} }));
}

function readStatsFile(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(stateDir, "stats.json"), "utf8"));
}

describe("Treats state helpers", () => {

  beforeEach(() => {
    tmpDir = makeTmpDir();
    stateDir = join(tmpDir, ".pi-buddy");
    _setStateDir(stateDir);
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures
    }
  });

  describe("GlobalBuddyStats interface and defaults", () => {
    test("DEFAULT_GLOBAL includes treats and totalTreatsEarned initialized to 0", () => {
      setupStateFiles({ global: { hatches: 5 }, buddies: {} });
      const stats = loadGlobalHatchStats();
      expect(stats.hatches).toBe(5);
      expect(stats.treats).toBe(0);
      expect(stats.totalTreatsEarned).toBe(0);
    });

    test("fresh state has treats=0 and totalTreatsEarned=0", () => {
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(join(stateDir, "config.json"), JSON.stringify({
        commentCooldown: 60, commentChance: 0.35, companionMuted: false,
      }));
      writeFileSync(join(stateDir, "menagerie.json"), JSON.stringify({ buddies: {} }));

      const stats = loadGlobalHatchStats();
      expect(stats.treats).toBe(0);
      expect(stats.totalTreatsEarned).toBe(0);
    });
  });

  describe("normalizeStatsFile spread pattern", () => {
    test("existing stats file without treats fields gets defaults", () => {
      setupStateFiles({
        global: { hatches: 10 },
        buddies: { "buddy-1": { commentsMade: 5, timesPetted: 3, observations: 0, sessions: 2, reactionsTriggered: 1 } },
      });
      const stats = loadGlobalHatchStats();
      expect(stats.hatches).toBe(10);
      expect(stats.treats).toBe(0);
      expect(stats.totalTreatsEarned).toBe(0);
    });

    test("stats file with treats values preserves them", () => {
      setupStateFiles({
        global: { hatches: 3, treats: 42, totalTreatsEarned: 100 },
        buddies: {},
      });
      const stats = loadGlobalHatchStats();
      expect(stats.hatches).toBe(3);
      expect(stats.treats).toBe(42);
      expect(stats.totalTreatsEarned).toBe(100);
    });
  });

  describe("loadTreats", () => {
    test("returns 0 for fresh state", () => {
      setupStateFiles();
      expect(loadTreats()).toBe(0);
    });

    test("returns current balance when treats are set", () => {
      setupStateFiles({
        global: { hatches: 0, treats: 75, totalTreatsEarned: 200 },
        buddies: {},
      });
      expect(loadTreats()).toBe(75);
    });
  });

  describe("addTreats", () => {
    test("increments both treats and totalTreatsEarned", () => {
      setupStateFiles({
        global: { hatches: 0, treats: 0, totalTreatsEarned: 0 },
        buddies: {},
      });
      addTreats(5);

      const raw = readStatsFile();
      expect((raw.global as Record<string, number>).treats).toBe(5);
      expect((raw.global as Record<string, number>).totalTreatsEarned).toBe(5);
    });

    test("increments on top of existing balance", () => {
      setupStateFiles({
        global: { hatches: 1, treats: 30, totalTreatsEarned: 100 },
        buddies: {},
      });
      addTreats(20);

      const raw = readStatsFile();
      expect((raw.global as Record<string, number>).treats).toBe(50);
      expect((raw.global as Record<string, number>).totalTreatsEarned).toBe(120);
    });
  });

  describe("spendTreats", () => {
    test("returns false when insufficient", () => {
      setupStateFiles({
        global: { hatches: 0, treats: 30, totalTreatsEarned: 30 },
        buddies: {},
      });
      const result = spendTreats(50);
      expect(result).toBe(false);

      const raw = readStatsFile();
      expect((raw.global as Record<string, number>).treats).toBe(30);
      expect((raw.global as Record<string, number>).totalTreatsEarned).toBe(30);
    });

    test("deducts and returns true when sufficient", () => {
      setupStateFiles({
        global: { hatches: 0, treats: 60, totalTreatsEarned: 200 },
        buddies: {},
      });
      const result = spendTreats(50);
      expect(result).toBe(true);

      const raw = readStatsFile();
      expect((raw.global as Record<string, number>).treats).toBe(10);
      expect((raw.global as Record<string, number>).totalTreatsEarned).toBe(200);
    });

    test("with exact balance succeeds (treats becomes 0)", () => {
      setupStateFiles({
        global: { hatches: 0, treats: 50, totalTreatsEarned: 50 },
        buddies: {},
      });
      const result = spendTreats(50);
      expect(result).toBe(true);

      const raw = readStatsFile();
      expect((raw.global as Record<string, number>).treats).toBe(0);
      expect((raw.global as Record<string, number>).totalTreatsEarned).toBe(50);
    });

    test("does not modify totalTreatsEarned", () => {
      setupStateFiles({
        global: { hatches: 0, treats: 100, totalTreatsEarned: 500 },
        buddies: {},
      });
      spendTreats(25);

      const raw = readStatsFile();
      expect((raw.global as Record<string, number>).treats).toBe(75);
      expect((raw.global as Record<string, number>).totalTreatsEarned).toBe(500);
    });
  });
});
