/**
 * Commentary bucket system — per-event-type rate-limiting for buddy reactions.
 *
 * Each bucket has its own chance, global gap (minGap), and bucket gap (bucketGap).
 * shouldComment(bucket) checks all three before allowing a reaction.
 * direct_address and session_start bypass gap checks (0s gaps).
 * Companion stats can modify chances (CHAOS, PATIENCE, DEBUGGING, SNARK).
 */

import type { CompanionBones, StatName } from "./types.ts";

// ── Types ───────────────────────────────────────────────────────────────

export const CommentaryBucket = {
  ToolError: "tool_error",
  ToolSuccess: "tool_success",
  ScriptedReaction: "scripted_reaction",
  MessageEndAssistant: "message_end_assistant",
  DirectAddress: "direct_address",
  SessionStart: "session_start",
} as const;

export type CommentaryBucket =
  (typeof CommentaryBucket)[keyof typeof CommentaryBucket];

export interface BucketConfig {
  /** Probability of firing (0–1). */
  chance: number;
  /** Minimum seconds between ANY two commentaries (global gap). */
  minGap: number;
  /** Minimum seconds between two commentaries in the SAME bucket. */
  bucketGap: number;
}

export const DEFAULT_BUCKET_CONFIGS: Record<CommentaryBucket, BucketConfig> = {
  tool_error:              { chance: 0.50, minGap: 30, bucketGap: 60 },
  tool_success:            { chance: 0.05, minGap: 30, bucketGap: 90 },
  scripted_reaction:       { chance: 1.00, minGap: 15, bucketGap: 30 },
  message_end_assistant:   { chance: 0.15, minGap: 30, bucketGap: 45 },
  direct_address:          { chance: 1.00, minGap: 0,  bucketGap: 0  },
  session_start:           { chance: 1.00, minGap: 0,  bucketGap: 0  },
};

// ── Commentary State ────────────────────────────────────────────────────

export interface CommentaryState {
  /** Timestamp (seconds) of the last commentary of any type. */
  lastCommentAt: number;
  /** Timestamps (seconds) of the last commentary per bucket. */
  lastBucketCommentAt: Partial<Record<CommentaryBucket, number>>;
  /** Returns the current time in seconds since epoch. */
  now: () => number;
}

export function createCommentaryState(): CommentaryState {
  return {
    lastCommentAt: 0,
    lastBucketCommentAt: {},
    now: () => Date.now() / 1000,
  };
}

// ── Stat-based modifiers ────────────────────────────────────────────────

/**
 * Compute the bonus to add to a bucket's base chance based on companion stats.
 *
 * - CHAOS > 70: +10% to ALL buckets
 * - PATIENCE < 30: +15% to tool_error
 * - DEBUGGING > 70: +10% to tool_success and tool_error
 * - SNARK > 70: +10% to tool_error
 */
function statModifier(bucket: CommentaryBucket, stats: Record<StatName, number>): number {
  let bonus = 0;

  // CHAOS > 70 → +10% all buckets
  if (stats.CHAOS > 70) bonus += 0.10;

  // PATIENCE < 30 → +15% tool_error
  if (stats.PATIENCE < 30 && bucket === "tool_error") bonus += 0.15;

  // DEBUGGING > 70 → +10% tool_success and tool_error
  if (stats.DEBUGGING > 70 && (bucket === "tool_success" || bucket === "tool_error")) bonus += 0.10;

  // SNARK > 70 → +10% tool_error
  if (stats.SNARK > 70 && bucket === "tool_error") bonus += 0.10;

  return bonus;
}

// ── Main check ──────────────────────────────────────────────────────────

export interface ShouldCommentOptions {
  /** Shared commentary state (tracks timestamps). */
  state: CommentaryState;
  /** User's commentChance setting — multiplied with bucket base chance. */
  commentChance: number;
  /** User's commentCooldown setting — multiplied with gap values. */
  commentCooldown: number;
  /** Fixed random value for testing (0–1). Uses Math.random() if omitted. */
  randomValue?: number;
  /** Active companion bones (for stat-based modifiers). Optional. */
  companion?: CompanionBones;
}

const CHANCE_CAP = 0.95;

/**
 * Decide whether the buddy should produce a reaction for the given bucket.
 *
 * Checks (in order):
 * 1. Global gap (minGap × commentCooldown) — unless bucket has 0s gaps (bypass buckets)
 * 2. Bucket gap (bucketGap × commentCooldown) — unless bucket has 0s gaps
 * 3. Chance (base × commentChance + stat modifiers, capped at 95%)
 *
 * If the check passes, the state is updated with the current timestamp.
 */
export function shouldComment(
  bucket: string,
  options: ShouldCommentOptions,
): boolean {
  const { state, commentChance, commentCooldown, companion } = options;

  const config = DEFAULT_BUCKET_CONFIGS[bucket as CommentaryBucket];
  if (!config) return false;

  const now = state.now();

  // commentChance=0 silences everything
  const effectiveChance = config.chance * commentChance;
  if (effectiveChance <= 0) return false;

  // Buckets with 0s gaps (direct_address, session_start) bypass gap checks
  const bypassGaps = config.minGap === 0 && config.bucketGap === 0;

  if (!bypassGaps) {
    // Check global gap: time since last ANY commentary must exceed minGap × commentCooldown
    const effectiveMinGap = config.minGap * commentCooldown;
    if (effectiveMinGap > 0 && state.lastCommentAt > 0) {
      if (now - state.lastCommentAt < effectiveMinGap) return false;
    }

    // Check bucket gap: time since last SAME-BUCKET commentary must exceed bucketGap × commentCooldown
    const effectiveBucketGap = config.bucketGap * commentCooldown;
    const lastBucketTime = state.lastBucketCommentAt[bucket as CommentaryBucket] ?? 0;
    if (effectiveBucketGap > 0 && lastBucketTime > 0) {
      if (now - lastBucketTime < effectiveBucketGap) return false;
    }
  }

  // Compute final chance with stat modifiers
  let finalChance = effectiveChance;
  if (companion) {
    finalChance += statModifier(bucket as CommentaryBucket, companion.stats);
  }
  finalChance = Math.min(finalChance, CHANCE_CAP);

  // Roll the dice
  const roll = options.randomValue ?? Math.random();
  if (roll >= finalChance) return false;

  // Passed all checks — update state
  state.lastCommentAt = now;
  state.lastBucketCommentAt[bucket as CommentaryBucket] = now;

  return true;
}
