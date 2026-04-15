import { RARITIES, RARITY_STARS, SPECIES, type Companion, type Rarity, type Species } from "./types.ts";
import { renderFace, renderSprite, spriteFrameCount } from "./sprites.ts";
import type { GlobalBuddyStats, PerBuddyStats } from "./state.ts";

// ── ANSI helpers ───────────────────────────────────────────────────────

const BOLD = "\x1b[1m";
const INVERSE = "\x1b[7m";
const RESET = "\x1b[0m";

const RARITY_ANSI: Record<Rarity, string> = {
  common: "\x1b[90m",
  uncommon: "\x1b[32m",
  rare: "\x1b[94m",
  epic: "\x1b[95m",
  legendary: "\x1b[33m",
};

function wrap(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function renderBuddyCard(companion: Companion, reaction?: string): string {
  const lines: string[] = [];
  const stars = RARITY_STARS[companion.rarity];
  const art = renderSprite(companion, 0);
  const width = 42;
  const hr = "\u2500".repeat(width - 2);
  const dashSep = "\u2504".repeat(width - 2);
  lines.push(`\u256D${hr}\u256E`);
  for (const line of art) lines.push(`\u2502 ${line.padEnd(width - 4)} \u2502`);
  lines.push(`\u251C${dashSep}\u2524`);
  lines.push(`\u2502 ${`${companion.name}  ${stars}`.padEnd(width - 4)} \u2502`);
  lines.push(`\u2502 ${`${companion.rarity.toUpperCase()} ${companion.species}${companion.shiny ? " \u2728 SPARKLE" : ""}`.padEnd(width - 4)} \u2502`);
  lines.push(`\u2502 ${`${renderFace(companion)}`.padEnd(width - 4)} \u2502`);
  lines.push(`\u251C${dashSep}\u2524`);
  for (const [name, value] of Object.entries(companion.stats)) {
    const filled = Math.floor((value as number) / 5);
    const bar = "\u2588".repeat(filled) + "\u2591".repeat(20 - filled);
    const marker = name === companion.peak ? " \u25B2" : name === companion.dump ? " \u25BC" : "  ";
    lines.push(`\u2502 ${`${name.slice(0, 3)} ${bar} ${String(value).padStart(3)}${marker}`.padEnd(width - 4)} \u2502`);
  }
  if (reaction) {
    lines.push(`\u251C${dashSep}\u2524`);
    for (const line of wrap(reaction, width - 6)) lines.push(`\u2502 ${(`\uD83D\uDCAC ${line}`).padEnd(width - 4)} \u2502`);
  }
  lines.push(`\u251C${dashSep}\u2524`);
  for (const line of wrap(companion.personality, width - 4)) lines.push(`\u2502 ${line.padEnd(width - 4)} \u2502`);
  lines.push(`\u2570${hr}\u256F`);
  return lines.join("\n");
}

const BUDDY_CARD_INNER = 38;

/** Match buddy-card rule: body rows are `│ ` + inner + ` │` → corners span innerW+2 dashes (total width innerW+4). */
function columnBox(title: string, bodyRows: string[], innerW: number, bodyTarget: number): string[] {
  const hr = "\u2500".repeat(innerW + 2);
  const body: string[] = bodyRows.map(r =>
    `\u2502 ${r.slice(0, innerW).padEnd(innerW)} \u2502`,
  );
  while (body.length < bodyTarget) {
    body.push(`\u2502 ${" ".repeat(innerW)} \u2502`);
  }
  if (body.length > bodyTarget) body.length = bodyTarget;
  return [
    `\u256D${hr}\u256E`,
    `\u2502 ${title.slice(0, innerW).padEnd(innerW)} \u2502`,
    `\u251C${hr}\u2524`,
    ...body,
    `\u2570${hr}\u256F`,
  ];
}

/** Pad buddy card with blank body rows before the bottom border so height matches side columns. */
function padBuddyCardLines(lines: string[], targetH: number): string[] {
  if (lines.length >= targetH) return lines;
  const bottom = lines[lines.length - 1]!;
  const rest = lines.slice(0, -1);
  while (rest.length + 1 < targetH) {
    rest.push(`\u2502 ${"".padEnd(BUDDY_CARD_INNER)} \u2502`);
  }
  return [...rest, bottom];
}

/** Card (left) + this buddy’s counters (middle) + global hatches (right). */
export function renderBuddyDashboard(
  companion: Companion,
  reaction: string | undefined,
  perBuddy: PerBuddyStats,
  global: GlobalBuddyStats,
): string {
  const midInner = 32;
  const rightInner = 22;
  const midBody: string[] = [
    `Comments made: ${perBuddy.commentsMade}`,
    `Times petted: ${perBuddy.timesPetted}`,
    `Observations: ${perBuddy.observations}`,
    `Sessions: ${perBuddy.sessions}`,
    `Reactions seen: ${perBuddy.reactionsTriggered}`,
  ];
  const rightBody: string[] = [
    `Hatches (total): ${global.hatches}`,
    `Treats: ${global.treats ?? 0}`,
    `Lifetime earned: ${global.totalTreatsEarned ?? 0}`,
    `Shinies found: ${global.shiniesFound ?? 0}`,
  ];

  let cardLines = renderBuddyCard(companion, reaction).split("\n");
  const colMin = 4 + Math.max(midBody.length, rightBody.length);
  const H = Math.max(cardLines.length, colMin);
  cardLines = padBuddyCardLines(cardLines, H);
  const bodyTarget = H - 4;

  const midLines = columnBox("This buddy", midBody, midInner, bodyTarget);
  const rightLines = columnBox("All buddies", rightBody, rightInner, bodyTarget);

  const gap = " ";
  const out: string[] = [];
  for (let i = 0; i < H; i++) {
    out.push(`${cardLines[i]!}${gap}${midLines[i]!}${gap}${rightLines[i]!}`);
  }
  return out.join("\n");
}

export function renderWidget(companion: Companion, reaction: string | undefined, tick: number): string[] {
  const speaking = reaction ? wrap(`\u201C${reaction}\u201D`, 28) : [];
  const blink = tick % 14 === 0;
  const frameCount = spriteFrameCount(companion.species);
  const frame = Math.floor(tick / 2) % frameCount;
  const sprite = renderSprite(companion, frame).map(line => blink ? line.replaceAll(companion.eye, "-") : line);
  const title = `${companion.name} ${RARITY_STARS[companion.rarity]}`;
  const lines: string[] = [];
  for (const line of speaking) lines.push(` ${line}`);
  lines.push(title);
  lines.push(...sprite);
  return lines;
}

// ── Collection grid ────────────────────────────────────────────────────

/** A buddy entry with its full companion data (bones resolved). */
export interface CollectionEntry {
  id: string;
  companion: Companion;
}

/** Compute rarity distribution from buddy list — no new state required. */
export function renderRarityDistribution(buddies: CollectionEntry[]): string {
  const counts: Record<Rarity, number> = {
    common: 0,
    uncommon: 0,
    rare: 0,
    epic: 0,
    legendary: 0,
  };
  const speciesSeen = new Set<Species>();
  for (const b of buddies) {
    counts[b.companion.rarity]++;
    speciesSeen.add(b.companion.species);
  }
  const parts = RARITIES.map(r => `${RARITY_STARS[r]}x${counts[r]}`);
  return `Collection: ${speciesSeen.size}/${SPECIES.length} species | ${parts.join(" ")}`;
}


