import { test, expect, describe } from "bun:test";
import {
  shouldComment,
  CommentaryBucket,
  DEFAULT_BUCKET_CONFIGS,
  createCommentaryState,
  type CommentaryState,
} from "../src/commentary.ts";
import type { CompanionBones, StatName } from "../src/types.ts";

// ── Helpers ──────────────────────────────────────────────────────────────

/** Create a minimal CompanionBones with specified stats. */
function makeBones(overrides: Partial<Record<StatName, number>> = {}): CompanionBones {
  return {
    rarity: "common",
    species: "cat",
    eye: "·",
    hat: "none",
    shiny: false,
    stats: { DEBUGGING: 50, PATIENCE: 50, CHAOS: 50, WISDOM: 50, SNARK: 50, ...overrides },
    peak: "CHAOS" as StatName,
    dump: "PATIENCE" as StatName,
  };
}

/** Create a state where `now` is the given ms-since-epoch. */
function stateAt(now: number): CommentaryState {
  const s = createCommentaryState();
  s.now = () => now;
  return s;
}

// ── CommentaryBucket type ──────────────────────────────────────────────

describe("CommentaryBucket type", () => {
  test("accepts all 6 valid bucket values", () => {
    const buckets: CommentaryBucket[] = [
      "tool_error",
      "tool_success",
      "scripted_reaction",
      "message_end_assistant",
      "direct_address",
      "session_start",
    ];
    expect(buckets.length).toBe(6);
    for (const b of buckets) {
      // Each bucket should be a valid CommentaryBucket (type check at compile time)
      expect(typeof b).toBe("string");
    }
  });
});

// ── Default bucket configs ──────────────────────────────────────────────

describe("DEFAULT_BUCKET_CONFIGS", () => {
  test("has exactly 6 entries", () => {
    const keys = Object.keys(DEFAULT_BUCKET_CONFIGS);
    expect(keys.length).toBe(6);
  });

  test("tool_error has correct values: 50%, 30s, 60s", () => {
    const c = DEFAULT_BUCKET_CONFIGS["tool_error"];
    expect(c.chance).toBe(0.50);
    expect(c.minGap).toBe(30);
    expect(c.bucketGap).toBe(60);
  });

  test("tool_success has correct values: 5%, 30s, 90s", () => {
    const c = DEFAULT_BUCKET_CONFIGS["tool_success"];
    expect(c.chance).toBe(0.05);
    expect(c.minGap).toBe(30);
    expect(c.bucketGap).toBe(90);
  });

  test("scripted_reaction has correct values: 100%, 15s, 30s", () => {
    const c = DEFAULT_BUCKET_CONFIGS["scripted_reaction"];
    expect(c.chance).toBe(1.0);
    expect(c.minGap).toBe(15);
    expect(c.bucketGap).toBe(30);
  });

  test("message_end_assistant has correct values: 15%, 30s, 45s", () => {
    const c = DEFAULT_BUCKET_CONFIGS["message_end_assistant"];
    expect(c.chance).toBe(0.15);
    expect(c.minGap).toBe(30);
    expect(c.bucketGap).toBe(45);
  });

  test("direct_address has correct values: 100%, 0s, 0s", () => {
    const c = DEFAULT_BUCKET_CONFIGS["direct_address"];
    expect(c.chance).toBe(1.0);
    expect(c.minGap).toBe(0);
    expect(c.bucketGap).toBe(0);
  });

  test("session_start has correct values: 100%, 0s, 0s", () => {
    const c = DEFAULT_BUCKET_CONFIGS["session_start"];
    expect(c.chance).toBe(1.0);
    expect(c.minGap).toBe(0);
    expect(c.bucketGap).toBe(0);
  });
});

// ── Global gap check ────────────────────────────────────────────────────

describe("shouldComment — global gap check", () => {
  test("returns false when within global gap (minGap × commentCooldown)", () => {
    const state = stateAt(100_000);
    // tool_error has minGap=30, commentCooldown=60 → effective global gap = 30*60 = 1800s
    // First call succeeds (no history), second is within gap
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 60, randomValue: 0 })).toBe(true);
    // Advance only 1000s (< 1800s)
    state.now = () => 101_000;
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 60, randomValue: 0 })).toBe(false);
  });

  test("returns true when global gap has passed (using bypass bucket to isolate)", () => {
    // Use session_start (bypass bucket) to set lastCommentAt, then test that
    // tool_error respects global gap against that timestamp
    const state = stateAt(100_000);
    // session_start is bypass — always fires
    expect(shouldComment("session_start", { state, commentChance: 1, commentCooldown: 60, randomValue: 0 })).toBe(true);
    // Now tool_error at same time — blocked by global gap (30*60 = 1800s)
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 60, randomValue: 0 })).toBe(false);
    // Advance past global gap (1800s)
    state.now = () => 101_801;
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 60, randomValue: 0 })).toBe(true);
  });
});

// ── Bucket gap check ────────────────────────────────────────────────────

describe("shouldComment — bucket gap check", () => {
  test("returns false when within bucket gap but global gap passed", () => {
    const state = stateAt(100_000);
    // scripted_reaction: minGap=15, bucketGap=30, commentCooldown=1
    // Global gap = 15s, bucket gap = 30s
    expect(shouldComment("scripted_reaction", { state, commentChance: 1, commentCooldown: 1, randomValue: 0 })).toBe(true);

    // Advance 20s — past global gap (15s) but within bucket gap (30s)
    state.now = () => 100_020;
    // First fire a different bucket to update lastCommentAt past global gap
    // tool_error: minGap=30s with cooldown=1 → 30s global gap. But lastComment was at 100_000, gap=20s < 30s. Won't work.
    // Use session_start (bypass) to clear the global gap
    expect(shouldComment("session_start", { state, commentChance: 1, commentCooldown: 1, randomValue: 0 })).toBe(true);

    // Now try scripted_reaction again — bucket gap (30s) still active from the first call at 100_000
    expect(shouldComment("scripted_reaction", { state, commentChance: 1, commentCooldown: 1, randomValue: 0 })).toBe(false);
  });

  test("returns true when bucket gap has passed", () => {
    const state = stateAt(100_000);
    // scripted_reaction: minGap=15, bucketGap=30, commentCooldown=1
    expect(shouldComment("scripted_reaction", { state, commentChance: 1, commentCooldown: 1, randomValue: 0 })).toBe(true);

    // Advance past bucket gap (30*1 = 30s)
    state.now = () => 100_031;
    expect(shouldComment("scripted_reaction", { state, commentChance: 1, commentCooldown: 1, randomValue: 0 })).toBe(true);
  });
});

// ── Chance check ─────────────────────────────────────────────────────────

describe("shouldComment — chance check", () => {
  test("returns false when random exceeds effective chance", () => {
    const state = stateAt(200_000); // fresh state, no gap issues
    // tool_error chance=0.50, commentChance=1.0 → effective=0.50
    // randomValue=0.6 > 0.50 → should be false
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.6 })).toBe(false);
  });

  test("returns true when random is below effective chance", () => {
    const state = stateAt(200_000);
    // tool_error chance=0.50, randomValue=0.3 < 0.50 → true
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.3 })).toBe(true);
  });

  test("returns false when random equals effective chance exactly", () => {
    const state = stateAt(200_000);
    // tool_error chance=0.50, randomValue=0.50 → false (>= check)
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.50 })).toBe(false);
  });
});

// ── All conditions must pass ────────────────────────────────────────────

describe("shouldComment — all conditions must pass", () => {
  test("returns true only when global gap, bucket gap, and chance all pass", () => {
    const state = stateAt(100_000);
    // tool_error: minGap=30, bucketGap=60, commentCooldown=1
    // First call — all fresh, chance passes
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 1, randomValue: 0.3 })).toBe(true);
    // Second call at same time — blocked by global gap (30s) and bucket gap (60s)
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 1, randomValue: 0.3 })).toBe(false);
    // Advance time past global gap (30s) but still within bucket gap (60s)
    state.now = () => 100_031;
    // Use a bypass bucket to reset global gap
    expect(shouldComment("session_start", { state, commentChance: 1, commentCooldown: 1, randomValue: 0 })).toBe(true);
    // tool_error still blocked by bucket gap
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 1, randomValue: 0.3 })).toBe(false);
    // Advance past bucket gap (60s total from first call)
    state.now = () => 100_061;
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 1, randomValue: 0.3 })).toBe(true);
  });
});

// ── commentChance multiplier ────────────────────────────────────────────

describe("shouldComment — commentChance multiplier", () => {
  test("commentChance=0 silences all buckets", () => {
    const state = stateAt(200_000);
    for (const bucket of Object.keys(DEFAULT_BUCKET_CONFIGS) as CommentaryBucket[]) {
      expect(shouldComment(bucket, { state, commentChance: 0, commentCooldown: 0, randomValue: 0 })).toBe(false);
    }
  });

  test("commentChance=0.5 halves effective chance", () => {
    const state = stateAt(200_000);
    // tool_error: base chance=0.50, commentChance=0.5 → effective=0.25
    // randomValue=0.3 > 0.25 → false
    expect(shouldComment("tool_error", { state, commentChance: 0.5, commentCooldown: 0, randomValue: 0.3 })).toBe(false);
    // randomValue=0.2 < 0.25 → true
    expect(shouldComment("tool_error", { state, commentChance: 0.5, commentCooldown: 0, randomValue: 0.2 })).toBe(true);
  });

  test("commentChance=2.0 doubles effective chance", () => {
    const state = stateAt(200_000);
    // tool_success: base chance=0.05, commentChance=2.0 → effective=0.10
    // randomValue=0.08 < 0.10 → true
    expect(shouldComment("tool_success", { state, commentChance: 2.0, commentCooldown: 0, randomValue: 0.08 })).toBe(true);
  });
});

// ── commentCooldown multiplier ──────────────────────────────────────────

describe("shouldComment — commentCooldown multiplier on gaps", () => {
  test("commentCooldown=0 removes gap restrictions", () => {
    const state = stateAt(100_000);
    // Fire two tool_errors rapidly
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 0, randomValue: 0 })).toBe(true);
    // Same timestamp — should pass because cooldown=0 zeroes out gaps
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 0, randomValue: 0 })).toBe(true);
  });

  test("commentCooldown=120 doubles all gap times", () => {
    const state = stateAt(100_000);
    // scripted_reaction: minGap=15, bucketGap=30, commentCooldown=120
    // effective global gap = 15*120 = 1800s, effective bucket gap = 30*120 = 3600s
    expect(shouldComment("scripted_reaction", { state, commentChance: 1, commentCooldown: 120, randomValue: 0 })).toBe(true);

    // Advance 2000s — past global gap (1800s) but within bucket gap (3600s)
    state.now = () => 102_000;
    expect(shouldComment("scripted_reaction", { state, commentChance: 1, commentCooldown: 120, randomValue: 0 })).toBe(false);

    // Advance 3601s total — past bucket gap
    state.now = () => 103_601;
    expect(shouldComment("scripted_reaction", { state, commentChance: 1, commentCooldown: 120, randomValue: 0 })).toBe(true);
  });
});

// ── direct_address and session_start bypass gap checks ──────────────────

describe("shouldComment — bypass buckets", () => {
  test("direct_address bypasses gap checks even immediately after another reaction", () => {
    const state = stateAt(100_000);
    // Fire a regular reaction first
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 60, randomValue: 0 })).toBe(true);
    // direct_address should still fire at the same instant
    expect(shouldComment("direct_address", { state, commentChance: 1, commentCooldown: 60, randomValue: 0 })).toBe(true);
  });

  test("session_start bypasses gap checks even immediately after another reaction", () => {
    const state = stateAt(100_000);
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 60, randomValue: 0 })).toBe(true);
    expect(shouldComment("session_start", { state, commentChance: 1, commentCooldown: 60, randomValue: 0 })).toBe(true);
  });

  test("direct_address fires multiple times in a row", () => {
    const state = stateAt(100_000);
    expect(shouldComment("direct_address", { state, commentChance: 1, commentCooldown: 60, randomValue: 0 })).toBe(true);
    expect(shouldComment("direct_address", { state, commentChance: 1, commentCooldown: 60, randomValue: 0 })).toBe(true);
    expect(shouldComment("direct_address", { state, commentChance: 1, commentCooldown: 60, randomValue: 0 })).toBe(true);
  });

  test("session_start fires multiple times in a row", () => {
    const state = stateAt(100_000);
    expect(shouldComment("session_start", { state, commentChance: 1, commentCooldown: 60, randomValue: 0 })).toBe(true);
    expect(shouldComment("session_start", { state, commentChance: 1, commentCooldown: 60, randomValue: 0 })).toBe(true);
  });

  test("direct_address still respects commentChance=0", () => {
    const state = stateAt(200_000);
    // Even bypass buckets respect commentChance=0 (silenced)
    expect(shouldComment("direct_address", { state, commentChance: 0, commentCooldown: 60, randomValue: 0 })).toBe(false);
  });

  test("session_start still respects commentChance=0", () => {
    const state = stateAt(200_000);
    expect(shouldComment("session_start", { state, commentChance: 0, commentCooldown: 60, randomValue: 0 })).toBe(false);
  });
});

// ── Stat-based probability modifiers ────────────────────────────────────

describe("shouldComment — stat modifiers", () => {
  test("high CHAOS adds +10% to all bucket chances", () => {
    const state = stateAt(200_000);
    const bones = makeBones({ CHAOS: 80 });
    // message_end_assistant: base=0.15, +0.10 from CHAOS → 0.25
    // randomValue=0.20 < 0.25 → true
    expect(shouldComment("message_end_assistant", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.20, companion: bones })).toBe(true);
    // randomValue=0.26 > 0.25 → false
    expect(shouldComment("message_end_assistant", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.26, companion: bones })).toBe(false);
  });

  test("low CHAOS (below 70) does NOT add +10%", () => {
    const state = stateAt(200_000);
    const bones = makeBones({ CHAOS: 50 });
    // message_end_assistant: base=0.15, no modifier → 0.15
    // randomValue=0.16 > 0.15 → false
    expect(shouldComment("message_end_assistant", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.16, companion: bones })).toBe(false);
  });

  test("low PATIENCE adds +15% to tool_error chance", () => {
    const state = stateAt(200_000);
    const bones = makeBones({ PATIENCE: 15 });
    // tool_error: base=0.50, +0.15 from PATIENCE → 0.65
    // randomValue=0.60 < 0.65 → true
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.60, companion: bones })).toBe(true);
    // randomValue=0.66 > 0.65 → false
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.66, companion: bones })).toBe(false);
  });

  test("normal PATIENCE (>= 30) does NOT add +15% to tool_error", () => {
    const state = stateAt(200_000);
    const bones = makeBones({ PATIENCE: 30 });
    // tool_error: base=0.50, no modifier
    // randomValue=0.51 > 0.50 → false
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.51, companion: bones })).toBe(false);
  });

  test("high DEBUGGING adds +10% to tool_success and tool_error", () => {
    const state = stateAt(200_000);
    const bones = makeBones({ DEBUGGING: 80 });

    // tool_success: base=0.05, +0.10 from DEBUGGING → 0.15
    // randomValue=0.10 < 0.15 → true
    expect(shouldComment("tool_success", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.10, companion: bones })).toBe(true);
    // randomValue=0.16 > 0.15 → false
    expect(shouldComment("tool_success", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.16, companion: bones })).toBe(false);

    // tool_error: base=0.50, +0.10 from DEBUGGING → 0.60
    // randomValue=0.55 < 0.60 → true
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.55, companion: bones })).toBe(true);
  });

  test("high DEBUGGING does NOT affect non-tool buckets", () => {
    const state = stateAt(200_000);
    const bones = makeBones({ DEBUGGING: 80 });
    // message_end_assistant: base=0.15, no modifier from DEBUGGING
    // randomValue=0.16 > 0.15 → false
    expect(shouldComment("message_end_assistant", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.16, companion: bones })).toBe(false);
  });

  test("high SNARK adds +10% to tool_error", () => {
    const state = stateAt(200_000);
    const bones = makeBones({ SNARK: 80 });
    // tool_error: base=0.50, +0.10 from SNARK → 0.60
    // randomValue=0.55 < 0.60 → true
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.55, companion: bones })).toBe(true);
    // randomValue=0.61 > 0.60 → false
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.61, companion: bones })).toBe(false);
  });

  test("high SNARK does NOT affect non-error buckets", () => {
    const state = stateAt(200_000);
    const bones = makeBones({ SNARK: 80 });
    // tool_success: base=0.05, no modifier from SNARK
    // randomValue=0.06 > 0.05 → false
    expect(shouldComment("tool_success", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.06, companion: bones })).toBe(false);
  });
});

// ── Stat modifier stacking ──────────────────────────────────────────────

describe("shouldComment — stat modifiers stack", () => {
  test("CHAOS + SNARK + DEBUGGING + low PATIENCE stack on tool_error", () => {
    const state = stateAt(200_000);
    const bones = makeBones({ CHAOS: 80, SNARK: 80, DEBUGGING: 80, PATIENCE: 15 });
    // tool_error: base=0.50
    //   +0.10 CHAOS (all buckets)
    //   +0.15 PATIENCE (tool_error)
    //   +0.10 DEBUGGING (tool_error)
    //   +0.10 SNARK (tool_error)
    //   = 0.95 (capped)
    // randomValue=0.94 < 0.95 → true
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.94, companion: bones })).toBe(true);
  });
});

// ── Chance capped at 95% ────────────────────────────────────────────────

describe("shouldComment — chance cap at 95%", () => {
  test("final chance is capped at 95%", () => {
    const state = stateAt(200_000);
    const bones = makeBones({ CHAOS: 80, SNARK: 80, DEBUGGING: 80, PATIENCE: 15 });
    // All modifiers applied to tool_error → 0.95 effective
    // randomValue=0.95 >= 0.95 → false (cap at 95% means must be strictly less)
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.95, companion: bones })).toBe(false);
  });

  test("scripted_reaction with high CHAOS is capped at 95%", () => {
    const state = stateAt(200_000);
    const bones = makeBones({ CHAOS: 80 });
    // scripted_reaction: base=1.0, +0.10 CHAOS = 1.10 → capped at 0.95
    // randomValue=0.95 >= 0.95 → false
    expect(shouldComment("scripted_reaction", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.95, companion: bones })).toBe(false);
    // randomValue=0.94 < 0.95 → true
    expect(shouldComment("scripted_reaction", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.94, companion: bones })).toBe(true);
  });
});

// ── No companion provided (default behavior) ───────────────────────────

describe("shouldComment — no companion stats", () => {
  test("works without companion — no stat modifiers applied", () => {
    const state = stateAt(200_000);
    // tool_error: base=0.50, no modifiers
    // randomValue=0.51 > 0.50 → false
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.51 })).toBe(false);
    // randomValue=0.49 < 0.50 → true
    expect(shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 0, randomValue: 0.49 })).toBe(true);
  });
});

// ── CommentaryState tracks timestamps correctly ─────────────────────────

describe("CommentaryState tracking", () => {
  test("state tracks lastCommentAt across buckets", () => {
    const state = stateAt(100_000);
    shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 0, randomValue: 0 });
    expect(state.lastCommentAt).toBe(100_000);
  });

  test("state tracks per-bucket timestamps", () => {
    const state = stateAt(100_000);
    shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 0, randomValue: 0 });
    shouldComment("scripted_reaction", { state, commentChance: 1, commentCooldown: 0, randomValue: 0 });
    expect(state.lastBucketCommentAt["tool_error"]).toBe(100_000);
    expect(state.lastBucketCommentAt["scripted_reaction"]).toBe(100_000);
  });

  test("state only updates when shouldComment returns true", () => {
    const state = stateAt(100_000);
    // First call succeeds
    shouldComment("tool_error", { state, commentChance: 1, commentCooldown: 0, randomValue: 0 });
    expect(state.lastCommentAt).toBe(100_000);

    // Advance time slightly, but random fails
    state.now = () => 100_100;
    shouldComment("tool_error", { state, commentChance: 0, commentCooldown: 0, randomValue: 0 });
    // lastCommentAt should NOT update (commentChance=0 means it returns false)
    expect(state.lastCommentAt).toBe(100_000);
  });
});
