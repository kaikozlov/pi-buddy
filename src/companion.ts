import { homedir } from "node:os";
import {
  type Companion,
  type CompanionBones,
  EYES,
  HATS,
  RARITIES,
  RARITY_WEIGHTS,
  type Rarity,
  SPECIES,
  STAT_NAMES,
  type StatName,
  type StoredCompanion,
} from "./types.ts";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  if (typeof Bun !== "undefined") return Number(BigInt(Bun.hash(s)) & 0xffffffffn);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function rollRarity(rng: () => number): Rarity {
  const total = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (const rarity of RARITIES) {
    roll -= RARITY_WEIGHTS[rarity];
    if (roll < 0) return rarity;
  }
  return "common";
}

const RARITY_FLOOR: Record<Rarity, number> = {
  common: 5,
  uncommon: 15,
  rare: 25,
  epic: 35,
  legendary: 50,
};

function rollStats(rng: () => number, rarity: Rarity, peak: StatName, dump: StatName): Record<StatName, number> {
  const floor = RARITY_FLOOR[rarity];

  const stats = {} as Record<StatName, number>;
  for (const name of STAT_NAMES) {
    if (name === peak) stats[name] = Math.min(100, floor + 50 + Math.floor(rng() * 30));
    else if (name === dump) stats[name] = Math.max(1, floor - 10 + Math.floor(rng() * 15));
    else stats[name] = floor + Math.floor(rng() * 40);
  }
  return stats;
}

const SALT = "friend-2026-401";

export type Roll = {
  bones: CompanionBones;
  seed: number;
};

function rollFromSeed(seed: number): Roll {
  const rng = mulberry32(seed);
  const rarity = rollRarity(rng);
  const species = pick(rng, SPECIES);
  const peak = pick(rng, STAT_NAMES);
  let dump = pick(rng, STAT_NAMES);
  while (dump === peak) dump = pick(rng, STAT_NAMES);
  const bones: CompanionBones = {
    rarity,
    species,
    eye: pick(rng, EYES),
    hat: rarity === "common" ? "none" : pick(rng, HATS),
    shiny: rng() < 0.01,
    stats: rollStats(rng, rarity, peak, dump),
    peak,
    dump,
  };
  return { bones, seed };
}

let rollCache: { key: string; value: Roll } | undefined;
export function roll(userId: string): Roll {
  const key = userId + SALT;
  if (rollCache?.key === key) return rollCache.value;
  const seed = hashString(key);
  const value = { ...rollFromSeed(seed) };
  rollCache = { key, value };
  return value;
}

/** Roll a fresh companion using a random seed (independent of user id). */
export function rollFresh(): Roll {
  const seed = Math.floor(Math.random() * 0xffffffff);
  return rollFromSeed(seed);
}

/** Roll bones from a numeric seed (for reproducible rolls / hatches). */
export function rollWithSeed(seed: number): Roll {
  return rollFromSeed(seed);
}

export function resolveBuddyUserId(): string {
  return process.env.USER ?? homedir();
}

export function buildCompanion(userId: string, stored: StoredCompanion): Companion {
  if (stored.bonesSeed != null) {
    const { bones } = rollWithSeed(stored.bonesSeed);
    return { ...stored, ...bones };
  }
  const { bones } = roll(userId);
  return { ...stored, ...bones };
}
