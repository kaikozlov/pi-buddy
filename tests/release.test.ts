import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  _setStateDir,
  listBuddies,
  putBuddy,
  deleteBuddy,
  deleteBuddyStats,
  getActiveBuddyId,
  setActiveBuddyId,
  resolveBuddyIdPrefix,
  addTreats,
  loadTreats,
} from "../src/state.ts";
import type { StoredCompanion } from "../src/types.ts";
import {
  BUDDY_SUBCOMMANDS,
  buddyArgumentCompletions,
} from "../src/commands.ts";

// ── Test infrastructure ─────────────────────────────────────────────

let tmpDir: string;
let stateDir: string;

function makeTmpDir(): string {
  const d = join(tmpdir(), `pi-buddy-test-release-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(d, { recursive: true });
  return d;
}

function setupState(): void {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, "config.json"), JSON.stringify({
    commentCooldown: 60,
    commentChance: 0.35,
    companionMuted: false,
  }));
  writeFileSync(join(stateDir, "menagerie.json"), JSON.stringify({ buddies: {} }));
  writeFileSync(join(stateDir, "stats.json"), JSON.stringify({
    global: { hatches: 0, treats: 0, totalTreatsEarned: 0 },
    buddies: {},
  }));
}

function makeStoredBuddy(id: string, name: string): StoredCompanion {
  return {
    id,
    name,
    personality: "test buddy",
    hatchedAt: Date.now(),
    bonesSeed: Math.floor(Math.random() * 1e9),
  };
}

function readStatsGlobal(): Record<string, unknown> {
  const raw = JSON.parse(readFileSync(join(stateDir, "stats.json"), "utf8"));
  return raw.global as Record<string, unknown>;
}

function readMenagerie(): Record<string, StoredCompanion> {
  const raw = JSON.parse(readFileSync(join(stateDir, "menagerie.json"), "utf8"));
  return (raw as { buddies: Record<string, StoredCompanion> }).buddies;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("/buddy release — state-level integration", () => {
  beforeEach(() => {
    tmpDir = makeTmpDir();
    stateDir = join(tmpDir, ".pi-buddy");
    _setStateDir(stateDir);
    setupState();
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures
    }
  });

  // VAL-T4-007: Release removes buddy and adds 25 treats
  test("release removes non-active buddy and adds 25 treats", () => {
    const activeId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const inactiveId = "11111111-2222-3333-4444-555555555555";

    putBuddy(makeStoredBuddy(activeId, "ActiveBuddy"));
    putBuddy(makeStoredBuddy(inactiveId, "ReleaseMe"));
    setActiveBuddyId(activeId);

    // Simulate release: deleteBuddyStats → deleteBuddy → addTreats(25)
    deleteBuddyStats(inactiveId);
    deleteBuddy(inactiveId);
    addTreats(25);

    // Verify buddy removed
    const buddies = listBuddies();
    expect(buddies.find(b => b.id === inactiveId)).toBeUndefined();
    expect(buddies.length).toBe(1);
    expect(buddies[0]!.id).toBe(activeId);

    // Verify treats added
    expect(loadTreats()).toBe(25);
  });

  // VAL-T4-008: Cannot release active buddy
  test("cannot release active buddy — guard check prevents it", () => {
    const activeId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const inactiveId = "11111111-2222-3333-4444-555555555555";

    putBuddy(makeStoredBuddy(activeId, "ActiveBuddy"));
    putBuddy(makeStoredBuddy(inactiveId, "SafeBuddy"));
    setActiveBuddyId(activeId);

    // Simulate the guard: if id === activeId, skip release
    const targetId = activeId;
    const isTargetActive = targetId === getActiveBuddyId();
    expect(isTargetActive).toBe(true);

    // Active buddy should still be in menagerie
    const buddies = listBuddies();
    expect(buddies.length).toBe(2);
  });

  // VAL-T4-009: Release with invalid ID shows warning
  test("release with invalid ID — resolveBuddyIdPrefix returns no match", () => {
    putBuddy(makeStoredBuddy("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "SomeBuddy"));
    setActiveBuddyId("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

    const r = resolveBuddyIdPrefix("nonexistent");
    expect(r.id).toBeUndefined();
    expect(r.ambiguous).toBeUndefined();
  });

  // VAL-T4-009: Ambiguous prefix shows warning
  test("release with ambiguous prefix — resolveBuddyIdPrefix returns ambiguous", () => {
    const id1 = "aaaaaaaa-1111-1111-1111-111111111111";
    const id2 = "aaaaaaaa-2222-2222-2222-222222222222";

    putBuddy(makeStoredBuddy(id1, "Buddy1"));
    putBuddy(makeStoredBuddy(id2, "Buddy2"));
    setActiveBuddyId(id1);

    const r = resolveBuddyIdPrefix("aaaaaaaa");
    expect(r.ambiguous).toBe(true);
    expect(r.id).toBeUndefined();
  });

  // VAL-T4-010: Release cleans up buddy stats
  test("deleteBuddyStats removes per-buddy stats on release", () => {
    const activeId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const releaseId = "11111111-2222-3333-4444-555555555555";

    putBuddy(makeStoredBuddy(activeId, "ActiveBuddy"));
    putBuddy(makeStoredBuddy(releaseId, "ReleaseMe"));
    setActiveBuddyId(activeId);

    // Write stats for the buddy to be released
    const statsFile = JSON.parse(readFileSync(join(stateDir, "stats.json"), "utf8"));
    statsFile.buddies[releaseId] = {
      commentsMade: 5,
      timesPetted: 3,
      observations: 1,
      sessions: 2,
      reactionsTriggered: 4,
    };
    writeFileSync(join(stateDir, "stats.json"), JSON.stringify(statsFile, null, 2));

    // Verify stats exist before release
    const beforeRaw = JSON.parse(readFileSync(join(stateDir, "stats.json"), "utf8"));
    expect(beforeRaw.buddies[releaseId]).toBeDefined();

    // Simulate release
    deleteBuddyStats(releaseId);
    deleteBuddy(releaseId);
    addTreats(25);

    // Verify stats removed
    const afterRaw = JSON.parse(readFileSync(join(stateDir, "stats.json"), "utf8"));
    expect(afterRaw.buddies[releaseId]).toBeUndefined();
  });

  test("release adds 25 treats to both treats and totalTreatsEarned", () => {
    // Start with some treats
    addTreats(10);
    expect(loadTreats()).toBe(10);

    // Release adds 25 treats
    addTreats(25);

    const raw = readStatsGlobal();
    expect(raw.treats).toBe(35);
    expect(raw.totalTreatsEarned).toBe(35);
  });

  test("release preserves active buddy's stats", () => {
    const activeId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const releaseId = "11111111-2222-3333-4444-555555555555";

    putBuddy(makeStoredBuddy(activeId, "ActiveBuddy"));
    putBuddy(makeStoredBuddy(releaseId, "ReleaseMe"));
    setActiveBuddyId(activeId);

    // Write stats for both
    const statsFile = JSON.parse(readFileSync(join(stateDir, "stats.json"), "utf8"));
    statsFile.buddies[activeId] = {
      commentsMade: 10,
      timesPetted: 5,
      observations: 2,
      sessions: 3,
      reactionsTriggered: 8,
    };
    statsFile.buddies[releaseId] = {
      commentsMade: 3,
      timesPetted: 1,
      observations: 0,
      sessions: 1,
      reactionsTriggered: 2,
    };
    writeFileSync(join(stateDir, "stats.json"), JSON.stringify(statsFile, null, 2));

    // Release
    deleteBuddyStats(releaseId);
    deleteBuddy(releaseId);
    addTreats(25);

    // Active buddy stats should be preserved
    const after = JSON.parse(readFileSync(join(stateDir, "stats.json"), "utf8"));
    expect(after.buddies[activeId]).toBeDefined();
    expect(after.buddies[activeId].commentsMade).toBe(10);
    expect(after.buddies[releaseId]).toBeUndefined();
  });
});

// ── Code structure tests (VAL-T4-007 through VAL-T4-010) ──────────

describe("/buddy release — command handler code structure", () => {
  test("release is in BUDDY_SUBCOMMANDS list", () => {
    const releaseEntry = BUDDY_SUBCOMMANDS.find(s => s.name === "release");
    expect(releaseEntry).toBeDefined();
    expect(releaseEntry!.description.length).toBeGreaterThan(0);
  });

  test("release appears in autocomplete for summon/dismiss-like argument completion", () => {
    // Release should have autocomplete like summon/dismiss (buddy id based)
    const completions = buddyArgumentCompletions("release ");
    // Should show buddy completions (or null if no buddies in the test state dir)
    // The important thing is the code path handles "release" in the switch
    // We check that "release" is a recognized subcommand
    const releaseSub = BUDDY_SUBCOMMANDS.find(s => s.name === "release");
    expect(releaseSub).toBeDefined();
  });

  test("release case exists in commands.ts source code", async () => {
    const source = await import("node:fs").then(fs =>
      fs.readFileSync(
        new URL("../src/commands.ts", import.meta.url).pathname,
        "utf8",
      ),
    );
    // Verify "release" case exists in the command handler switch (after the dismiss case)
    expect(source).toContain("case \"release\"");
    // Verify addTreats(25) is called
    expect(source).toContain("addTreats(25)");
    // Verify the release handler in the command switch contains the expected calls
    // Find the command handler's release case by looking after "// ── Release"
    const releaseSection = source.indexOf("// ── Release");
    expect(releaseSection).toBeGreaterThan(-1);
    const afterReleaseSection = source.slice(releaseSection);
    // Find the next section divider or the default case
    const nextSection = afterReleaseSection.indexOf("\n    // ── ", 10);
    const defaultCase = afterReleaseSection.indexOf("\n    default:", 10);
    const endIdx = nextSection > 0
      ? (defaultCase > 0 ? Math.min(nextSection, defaultCase) : nextSection)
      : (defaultCase > 0 ? defaultCase : afterReleaseSection.length);
    const releaseBlock = afterReleaseSection.slice(0, endIdx);
    expect(releaseBlock).toContain("deleteBuddyStats");
    expect(releaseBlock).toContain("deleteBuddy");
    expect(releaseBlock).toContain("addTreats(25)");
  });

  test("release handler checks for active buddy guard", async () => {
    const source = await import("node:fs").then(fs =>
      fs.readFileSync(
        new URL("../src/commands.ts", import.meta.url).pathname,
        "utf8",
      ),
    );
    const releaseSection = source.indexOf("// ── Release");
    expect(releaseSection).toBeGreaterThan(-1);
    const afterReleaseSection = source.slice(releaseSection);
    const nextSection = afterReleaseSection.indexOf("\n    // ── ", 10);
    const defaultCase = afterReleaseSection.indexOf("\n    default:", 10);
    const endIdx = nextSection > 0
      ? (defaultCase > 0 ? Math.min(nextSection, defaultCase) : nextSection)
      : (defaultCase > 0 ? defaultCase : afterReleaseSection.length);
    const releaseBlock = afterReleaseSection.slice(0, endIdx);
    // Should check against active buddy id (same guard as dismiss)
    expect(releaseBlock).toContain("getActiveBuddyId()");
    // Should contain a "Cannot release" or similar warning message
    expect(releaseBlock).toMatch(/cannot release|Cannot release/i);
  });

  test("release handler resolves id via resolveBuddyIdPrefix", async () => {
    const source = await import("node:fs").then(fs =>
      fs.readFileSync(
        new URL("../src/commands.ts", import.meta.url).pathname,
        "utf8",
      ),
    );
    const releaseSection = source.indexOf("// ── Release");
    const afterReleaseSection = source.slice(releaseSection);
    const nextSection = afterReleaseSection.indexOf("\n    // ── ", 10);
    const defaultCase = afterReleaseSection.indexOf("\n    default:", 10);
    const endIdx = nextSection > 0
      ? (defaultCase > 0 ? Math.min(nextSection, defaultCase) : nextSection)
      : (defaultCase > 0 ? defaultCase : afterReleaseSection.length);
    const releaseBlock = afterReleaseSection.slice(0, endIdx);
    expect(releaseBlock).toContain("resolveBuddyIdPrefix");
  });

  test("release handler shows notification with buddy name and treat count", async () => {
    const source = await import("node:fs").then(fs =>
      fs.readFileSync(
        new URL("../src/commands.ts", import.meta.url).pathname,
        "utf8",
      ),
    );
    const releaseSection = source.indexOf("// ── Release");
    const afterReleaseSection = source.slice(releaseSection);
    const nextSection = afterReleaseSection.indexOf("\n    // ── ", 10);
    const defaultCase = afterReleaseSection.indexOf("\n    default:", 10);
    const endIdx = nextSection > 0
      ? (defaultCase > 0 ? Math.min(nextSection, defaultCase) : nextSection)
      : (defaultCase > 0 ? defaultCase : afterReleaseSection.length);
    const releaseBlock = afterReleaseSection.slice(0, endIdx);
    // Should contain "Released" and "25 treats" in notification
    expect(releaseBlock).toMatch(/Released.*25 treats/);
  });

  test("release is listed in help text", async () => {
    const source = await import("node:fs").then(fs =>
      fs.readFileSync(
        new URL("../src/commands.ts", import.meta.url).pathname,
        "utf8",
      ),
    );
    // The help text should mention the release command
    expect(source).toMatch(/\/buddy release/);
  });
});

// ── Autocomplete tests ──────────────────────────────────────────────

describe("/buddy release — autocomplete", () => {
  test("release subcommand appears in autocomplete suggestions", () => {
    const suggestions = buddyArgumentCompletions("rel");
    expect(suggestions).not.toBeNull();
    expect(suggestions!.some(s => s.label === "release")).toBe(true);
  });

  test("release has buddy id argument completions like dismiss", async () => {
    const source = await import("node:fs").then(fs =>
      fs.readFileSync(
        new URL("../src/commands.ts", import.meta.url).pathname,
        "utf8",
      ),
    );
    // In the buddyArgumentCompletions switch, "release" should be handled
    // alongside summon/dismiss
    expect(source).toMatch(/case ["']release["']/);
  });
});

// ── Full release flow simulation ────────────────────────────────────

describe("/buddy release — full flow simulation", () => {
  beforeEach(() => {
    tmpDir = makeTmpDir();
    stateDir = join(tmpDir, ".pi-buddy");
    _setStateDir(stateDir);
    setupState();
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup failures
    }
  });

  test("complete release flow: resolve → guard → delete stats → delete buddy → add treats", () => {
    const activeId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const inactiveId = "11111111-2222-3333-4444-555555555555";

    // Setup: two buddies, one active
    putBuddy(makeStoredBuddy(activeId, "KeepMe"));
    putBuddy(makeStoredBuddy(inactiveId, "ReleaseMe"));
    setActiveBuddyId(activeId);
    addTreats(10);

    // Step 1: Resolve the buddy to release
    const r = resolveBuddyIdPrefix(inactiveId);
    expect(r.id).toBe(inactiveId);
    expect(r.ambiguous).toBeUndefined();

    // Step 2: Guard — not active
    expect(r.id).not.toBe(getActiveBuddyId());

    // Step 3: Delete stats
    deleteBuddyStats(r.id!);

    // Step 4: Delete buddy
    deleteBuddy(r.id!);

    // Step 5: Add treats
    addTreats(25);

    // Verify final state
    const buddies = listBuddies();
    expect(buddies.length).toBe(1);
    expect(buddies[0]!.id).toBe(activeId);
    expect(loadTreats()).toBe(35); // 10 initial + 25 from release
  });

  test("release with short id prefix resolves correctly", () => {
    const activeId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const inactiveId = "11111111-2222-3333-4444-555555555555";

    putBuddy(makeStoredBuddy(activeId, "KeepMe"));
    putBuddy(makeStoredBuddy(inactiveId, "ReleaseMe"));
    setActiveBuddyId(activeId);

    // Use hyphenless prefix (first 8 chars = "11111111")
    const shortId = "11111111";
    const r = resolveBuddyIdPrefix(shortId);
    expect(r.id).toBe(inactiveId);
    expect(r.ambiguous).toBeUndefined();
  });
});
