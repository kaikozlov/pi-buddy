import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import type { StoredCompanion } from "./types.ts";

import type { Species, CompanionBones } from "./types.ts";
import type { Companion } from "./types.ts";

let STATE_DIR = join(getAgentDir(), "pi-buddy");
let CONFIG_FILE = join(STATE_DIR, "config.json");
let STATS_FILE = join(STATE_DIR, "stats.json");
let MENAGERIE_FILE = join(STATE_DIR, "menagerie.json");

/** @internal Override the state directory (for testing only). */
export function _setStateDir(dir: string): void {
  STATE_DIR = dir;
  CONFIG_FILE = join(STATE_DIR, "config.json");
  STATS_FILE = join(STATE_DIR, "stats.json");
  MENAGERIE_FILE = join(STATE_DIR, "menagerie.json");
  migrationDone = false;
}

export interface BuddyConfig {
  /** @deprecated Migrated into menagerie + activeBuddyId; stripped on load */
  companion?: StoredCompanion;
  /** @deprecated Migrated to activeBuddyId; stripped on load */
  activeSlot?: string;
  activeBuddyId?: string;
  companionMuted?: boolean;
  commentCooldown: number;
  commentChance: number;
  commentProvider?: string;
  commentModel?: string;
  speciesOverride?: Species;
  cheatMode?: boolean;
}

const DEFAULT_CONFIG: BuddyConfig = {
  commentCooldown: 60,
  commentChance: 0.35,
  companionMuted: false,
};

// ── One-shot migration (legacy slots + config.companion) ───────────────

let migrationDone = false;

function loadConfigFromDisk(): BuddyConfig {
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(CONFIG_FILE, "utf8")) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfigToDisk(next: BuddyConfig): void {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2));
}

function legacyIdentityKey(s: Pick<StoredCompanion, "hatchedAt" | "bonesSeed">): string {
  if (s.bonesSeed != null) return `b:${s.bonesSeed}`;
  return `t:${s.hatchedAt}`;
}

interface MenagerieFile {
  buddies: Record<string, StoredCompanion>;
}

function loadMenagerieFromDisk(): MenagerieFile {
  try {
    const raw: unknown = JSON.parse(readFileSync(MENAGERIE_FILE, "utf8"));
    if (raw && typeof raw === "object" && !Array.isArray(raw) && "buddies" in raw) {
      const b = (raw as MenagerieFile).buddies;
      if (b && typeof b === "object") return { buddies: { ...b } };
    }
  } catch {
    /* missing */
  }
  return { buddies: {} };
}

function saveMenagerieFile(m: MenagerieFile): void {
  mkdirSync(STATE_DIR, { recursive: true });
  const tmp = MENAGERIE_FILE + ".tmp";
  writeFileSync(tmp, JSON.stringify(m, null, 2));
  renameSync(tmp, MENAGERIE_FILE);
}

function uuidLikeKey(k: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(k);
}

function normalizeBuddies(b: Record<string, StoredCompanion>): { buddies: Record<string, StoredCompanion>; changed: boolean } {
  const out: Record<string, StoredCompanion> = {};
  let changed = false;
  for (const [k, v] of Object.entries(b)) {
    const id = v.id ?? (uuidLikeKey(k) ? k : randomUUID());
    if (id !== k) changed = true;
    if (v.id !== id) changed = true;
    out[id] = { ...v, id };
  }
  if (Object.keys(out).length !== Object.keys(b).length) changed = true;
  return { buddies: out, changed };
}

/** Run once: slots → buddies, config.companion + activeSlot → activeBuddyId. */
function ensureStateMigrated(): void {
  if (migrationDone) return;

  let slotToId: Record<string, string> | undefined;

  try {
    const raw: unknown = JSON.parse(readFileSync(MENAGERIE_FILE, "utf8"));
    if (raw && typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>;
      if (o.slots && typeof o.slots === "object" && o.slots !== null && !Array.isArray(o.slots)) {
        slotToId = {};
        const buddies: Record<string, StoredCompanion> = {};
        for (const [slot, c] of Object.entries(o.slots as Record<string, StoredCompanion>)) {
          const comp = c as StoredCompanion;
          const id = comp.id ?? randomUUID();
          slotToId[slot] = id;
          buddies[id] = { ...comp, id };
        }
        saveMenagerieFile({ buddies });
      }
    }
  } catch {
    /* missing menagerie file */
  }

  let m = loadMenagerieFromDisk();
  const norm = normalizeBuddies(m.buddies);
  if (norm.changed) {
    saveMenagerieFile({ buddies: norm.buddies });
  }

  let buddies = { ...loadMenagerieFromDisk().buddies };
  const cfg = loadConfigFromDisk();
  const configPatch: Partial<BuddyConfig> = {};

  if (cfg.activeSlot) {
    if (slotToId?.[cfg.activeSlot]) {
      configPatch.activeBuddyId = slotToId[cfg.activeSlot];
    } else {
      const ids = Object.keys(loadMenagerieFromDisk().buddies);
      if (ids.length === 1) configPatch.activeBuddyId = ids[0];
    }
    configPatch.activeSlot = undefined;
  }

  if (cfg.companion) {
    const c = cfg.companion as StoredCompanion;
    const key = legacyIdentityKey(c);
    let matchId: string | undefined;
    for (const b of Object.values(buddies)) {
      if (legacyIdentityKey(b) === key) {
        matchId = b.id;
        break;
      }
    }
    if (matchId) {
      buddies[matchId] = { ...buddies[matchId], ...c, id: matchId };
      saveMenagerieFile({ buddies });
    } else {
      const id = c.id ?? randomUUID();
      buddies[id] = { ...c, id };
      saveMenagerieFile({ buddies });
      matchId = id;
    }
    if (!cfg.activeBuddyId && !configPatch.activeBuddyId) configPatch.activeBuddyId = matchId;
    configPatch.companion = undefined;
  }

  if (Object.keys(configPatch).length > 0) {
    saveConfigToDisk({ ...cfg, ...configPatch });
  }

  migrationDone = true;
}

// ── Config ─────────────────────────────────────────────────────────────

export function loadConfig(): BuddyConfig {
  ensureStateMigrated();
  return loadConfigFromDisk();
}

export function saveConfig(patch: Partial<BuddyConfig>): BuddyConfig {
  ensureStateMigrated();
  const next = { ...loadConfigFromDisk(), ...patch };
  saveConfigToDisk(next);
  return next;
}

export function getActiveBuddyId(): string | undefined {
  ensureStateMigrated();
  return loadConfigFromDisk().activeBuddyId;
}

export function setActiveBuddyId(id: string | undefined): void {
  ensureStateMigrated();
  saveConfigToDisk({ ...loadConfigFromDisk(), activeBuddyId: id });
}

export function getStoredCompanion(): StoredCompanion | undefined {
  ensureStateMigrated();
  const id = loadConfigFromDisk().activeBuddyId;
  if (!id) return undefined;
  return loadMenagerieFromDisk().buddies[id];
}

/** Upsert one buddy in the menagerie (single source of truth). */
export function putBuddy(companion: StoredCompanion): void {
  ensureStateMigrated();
  if (!companion.id) throw new Error("putBuddy requires companion.id");
  const m = loadMenagerieFromDisk();
  m.buddies[companion.id] = companion;
  saveMenagerieFile(m);
}

/** @deprecated Use putBuddy */
export function saveStoredCompanion(companion: StoredCompanion): void {
  putBuddy(companion);
}

export function hasState(): boolean {
  return existsSync(CONFIG_FILE);
}

// ── Stats: per-buddy row + global hatches only ─────────────────────────

export interface GlobalBuddyStats {
  hatches: number;
  treats: number;
  totalTreatsEarned: number;
  shiniesFound: number;
}

/** Counters attributed to whichever buddy is active when the event happens. */
export interface PerBuddyStats {
  commentsMade: number;
  timesPetted: number;
  observations: number;
  sessions: number;
  reactionsTriggered: number;
}

const DEFAULT_GLOBAL: GlobalBuddyStats = {
  hatches: 0,
  treats: 0,
  totalTreatsEarned: 0,
  shiniesFound: 0,
};

const DEFAULT_PER_BUDDY: PerBuddyStats = {
  commentsMade: 0,
  timesPetted: 0,
  observations: 0,
  sessions: 0,
  reactionsTriggered: 0,
};

interface StatsFileV1 {
  global: GlobalBuddyStats;
  buddies: Record<string, PerBuddyStats>;
}

function emptyStatsFile(): StatsFileV1 {
  return { global: { ...DEFAULT_GLOBAL }, buddies: {} };
}

function writeStatsFile(f: StatsFileV1): void {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATS_FILE, JSON.stringify(f, null, 2));
}

function isBuddyStatsRow(o: unknown): o is Partial<PerBuddyStats> & { hatches?: number } {
  return typeof o === "object" && o !== null && "commentsMade" in o;
}

/** Top-level object is a map of buddy id → stat row. */
function isPerBuddyMap(o: Record<string, unknown>): boolean {
  const vals = Object.values(o);
  return vals.length > 0 && vals.every(v => isBuddyStatsRow(v));
}

function normalizeStatsFile(f: StatsFileV1): StatsFileV1 {
  const buddies: Record<string, PerBuddyStats> = {};
  for (const [id, row] of Object.entries(f.buddies)) {
    buddies[id] = { ...DEFAULT_PER_BUDDY, ...row };
  }
  return {
    global: { ...DEFAULT_GLOBAL, ...f.global },
    buddies,
  };
}

function migrateMapToV1(obj: Record<string, unknown>): StatsFileV1 {
  let totalHatches = 0;
  const buddies: Record<string, PerBuddyStats> = {};
  for (const [id, v] of Object.entries(obj)) {
    if (!isBuddyStatsRow(v)) continue;
    const row = v as Partial<PerBuddyStats> & { hatches?: number };
    totalHatches += row.hatches ?? 0;
    buddies[id] = {
      commentsMade: row.commentsMade ?? 0,
      timesPetted: row.timesPetted ?? 0,
      observations: row.observations ?? 0,
      sessions: row.sessions ?? 0,
      reactionsTriggered: row.reactionsTriggered ?? 0,
    };
  }
  return { global: { ...DEFAULT_GLOBAL, hatches: totalHatches }, buddies };
}

/** Single flat blob (older “all global” file): park non-hatch on active buddy. */
function migrateFlatToV1(flat: Record<string, unknown>): StatsFileV1 {
  const h = flat.hatches;
  const hatches = typeof h === "number" ? h : 0;
  const per: PerBuddyStats = {
    commentsMade: typeof flat.commentsMade === "number" ? flat.commentsMade : 0,
    timesPetted: typeof flat.timesPetted === "number" ? flat.timesPetted : 0,
    observations: typeof flat.observations === "number" ? flat.observations : 0,
    sessions: typeof flat.sessions === "number" ? flat.sessions : 0,
    reactionsTriggered: typeof flat.reactionsTriggered === "number" ? flat.reactionsTriggered : 0,
  };
  const active = getStoredCompanion();
  const buddies: Record<string, PerBuddyStats> = {};
  if (active) buddies[active.id] = per;
  return { global: { ...DEFAULT_GLOBAL, hatches }, buddies };
}

function loadStatsFile(): StatsFileV1 {
  try {
    const raw: unknown = JSON.parse(readFileSync(STATS_FILE, "utf8"));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyStatsFile();

    const top = raw as Record<string, unknown>;

    if ("global" in top && "buddies" in top && top.global && typeof top.global === "object") {
      const g = top.global as Record<string, unknown>;
      const b = top.buddies && typeof top.buddies === "object" && !Array.isArray(top.buddies)
        ? (top.buddies as Record<string, PerBuddyStats>)
        : {};
      return normalizeStatsFile({
        global: { ...DEFAULT_GLOBAL, ...g },
        buddies: { ...b },
      });
    }

    let obj = { ...top };
    const nested = obj.entries;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      obj = { ...nested } as Record<string, unknown>;
    }

    if (isPerBuddyMap(obj)) {
      const migrated = migrateMapToV1(obj);
      writeStatsFile(normalizeStatsFile(migrated));
      return normalizeStatsFile(migrated);
    }

    if (isBuddyStatsRow(top) && !isPerBuddyMap(top)) {
      const migrated = migrateFlatToV1(top);
      writeStatsFile(normalizeStatsFile(migrated));
      return normalizeStatsFile(migrated);
    }
  } catch {
    /* missing or corrupt */
  }
  return emptyStatsFile();
}

export function loadGlobalHatchStats(): GlobalBuddyStats {
  return { ...DEFAULT_GLOBAL, ...loadStatsFile().global };
}

/** Return the current treat balance (default 0). */
export function loadTreats(): number {
  return loadStatsFile().global.treats ?? 0;
}

/** Add `n` treats to both the balance and the lifetime-earned counter. */
export function addTreats(n: number): void {
  const f = loadStatsFile();
  f.global.treats = (f.global.treats ?? 0) + n;
  f.global.totalTreatsEarned = (f.global.totalTreatsEarned ?? 0) + n;
  writeStatsFile(f);
}

/**
 * Attempt to spend `n` treats.
 * Returns `false` if the balance is insufficient (no mutation).
 * Returns `true` and deducts `n` from treats (does NOT touch totalTreatsEarned).
 */
export function spendTreats(n: number): boolean {
  const f = loadStatsFile();
  const balance = f.global.treats ?? 0;
  if (balance < n) return false;
  f.global.treats = balance - n;
  writeStatsFile(f);
  return true;
}

/** Returns 2 for shiny companions, 1 otherwise. Used to multiply treat earnings. */
export function shinyTreatMultiplier(companion: { shiny?: boolean }): number {
  return companion.shiny ? 2 : 1;
}

export function loadPerBuddyStats(stored: StoredCompanion | undefined): PerBuddyStats {
  if (!stored) return { ...DEFAULT_PER_BUDDY };
  return { ...DEFAULT_PER_BUDDY, ...loadStatsFile().buddies[stored.id] };
}

export function bumpGlobalHatch(): void {
  const f = loadStatsFile();
  f.global.hatches++;
  writeStatsFile(f);
}

export function bumpBuddyStat(stored: StoredCompanion | undefined, key: keyof PerBuddyStats): void {
  if (!stored) return;
  const f = loadStatsFile();
  const cur = { ...DEFAULT_PER_BUDDY, ...f.buddies[stored.id] };
  cur[key]++;
  f.buddies[stored.id] = cur;
  writeStatsFile(f);
}

/** @param key Buddy-local counter, or `"hatches"` for the global hatch total. */
export function bumpStat(key: keyof PerBuddyStats | "hatches"): void {
  if (key === "hatches") bumpGlobalHatch();
  else bumpBuddyStat(getStoredCompanion(), key);
}

/** Remove stored counters when a buddy leaves the menagerie. */
export function deleteBuddyStats(buddyId: string): void {
  const f = loadStatsFile();
  if (!f.buddies[buddyId]) return;
  delete f.buddies[buddyId];
  writeStatsFile(f);
}

// ── Menagerie ───────────────────────────────────────────────────────────

export interface MenagerieEntry {
  id: string;
  companion: StoredCompanion;
}

/** Normalise a string for fuzzy display only (not used as storage keys). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 14) || "buddy";
}

export function listBuddies(): MenagerieEntry[] {
  ensureStateMigrated();
  const { buddies } = loadMenagerieFromDisk();
  return Object.entries(buddies).map(([id, companion]) => ({ id, companion }));
}

export function deleteBuddy(id: string): boolean {
  ensureStateMigrated();
  const m = loadMenagerieFromDisk();
  if (!m.buddies[id]) return false;
  delete m.buddies[id];
  saveMenagerieFile(m);
  return true;
}

/** Resolve `rest` to a buddy id (full UUID, hyphenless prefix from list, or unique prefix). */
export function resolveBuddyIdPrefix(rest: string): { id?: string; ambiguous?: boolean } {
  const q = rest.trim();
  if (!q) return {};
  const ql = q.toLowerCase();
  const qc = ql.replace(/-/g, "");
  const buddies = listBuddies();
  const ids = new Set<string>();
  for (const b of buddies) {
    const il = b.id.toLowerCase();
    const ic = il.replace(/-/g, "");
    if (il === ql || ic === qc || il.startsWith(ql) || ic.startsWith(qc)) ids.add(b.id);
  }
  const arr = [...ids];
  if (arr.length === 1) return { id: arr[0] };
  if (arr.length > 1) return { ambiguous: true };
  return {};
}

export function formatBuddyListId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8);
}
