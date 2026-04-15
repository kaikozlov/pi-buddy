/**
 * src/collection-view.ts — Interactive keyboard-navigable collection overlay.
 *
 * Shows the full menagerie as a scrollable list. UP/DOWN to browse,
 * Enter to summon, Esc to close. The selected buddy shows full stats
 * and sprite on the right side. Merges the old static list + collection
 * grid into one interactive view.
 */

import { type Theme } from "@mariozechner/pi-coding-agent";
import {
  Key,
  matchesKey,
  truncateToWidth,
  visibleWidth,
  type Component,
  type Focusable,
} from "@mariozechner/pi-tui";
import { RARITY_STARS, type Rarity } from "./types.ts";
import { renderSprite } from "./sprites.ts";
import {
  type CollectionEntry,
  renderRarityDistribution,
} from "./render.ts";
import { formatBuddyListId, loadTreats } from "./state.ts";

// ── ANSI ───────────────────────────────────────────────────────────────

const RARITY_ANSI: Record<Rarity, string> = {
  common: "\x1b[90m",
  uncommon: "\x1b[32m",
  rare: "\x1b[94m",
  epic: "\x1b[95m",
  legendary: "\x1b[33m",
};
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const ITALIC = "\x1b[3m";
const RESET = "\x1b[0m";

// ── Layout constants ───────────────────────────────────────────────────

const LIST_COL = 34;       // fixed width of left list column
const COL_GAP = 2;         // spaces between columns
const MAX_VISIBLE = 12;    // max list rows before scrolling

// ── Helpers ────────────────────────────────────────────────────────────

/** Pad `text` with trailing spaces so its visible width is exactly `target`. */
function padTo(text: string, target: number): string {
  const pad = target - visibleWidth(text);
  return pad > 0 ? text + " ".repeat(pad) : text;
}

/** Wrap text into lines of at most `width` visible characters. */
function wrapLines(text: string, width: number): string[] {
  if (width <= 0) return [];
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
  return lines.length > 0 ? lines : [""];
}

// ── Component ──────────────────────────────────────────────────────────

export interface CollectionViewCallbacks {
  onSummon(id: string): Promise<void>;
  onClose(): void;
}

export class CollectionView implements Component, Focusable {
  focused = false;

  private selected = 0;

  constructor(
    private readonly entries: CollectionEntry[],
    private readonly activeId: string | undefined,
    private readonly theme: Theme,
    private readonly cb: CollectionViewCallbacks,
  ) {}

  invalidate(): void {}

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape)) {
      this.cb.onClose();
      return;
    }
    if (matchesKey(data, Key.up)) {
      this.selected = this.selected > 0 ? this.selected - 1 : this.entries.length - 1;
      return;
    }
    if (matchesKey(data, Key.down)) {
      this.selected = this.selected < this.entries.length - 1 ? this.selected + 1 : 0;
      return;
    }
    if (matchesKey(data, Key.enter) || matchesKey(data, Key.return)) {
      const entry = this.entries[this.selected];
      if (entry) this.cb.onSummon(entry.id);
      return;
    }
  }

  render(width: number): string[] {
    if (this.entries.length === 0) {
      return this.renderEmpty(width);
    }

    const th = this.theme;
    const b = (s: string) => th.fg("border", s);
    const innerW = width - 2; // total content width between outer borders

    // Two-column layout: everything must sum to innerW.
    // │ LIST_COL │ GAP │ detailCol │  =>  LIST_COL + COL_GAP + detailCol = innerW
    const detailCol = innerW - LIST_COL - COL_GAP;

    const lines: string[] = [];

    // ── Header ───────────────────────────────────────────────────
    const treats = loadTreats();
    const headerText = ` Collection: ${this.entries.length} ${this.entries.length === 1 ? "buddy" : "buddies"} · Treats: ${treats} `;
    const headerPad = innerW - visibleWidth(headerText);
    const leftPad = Math.floor(headerPad / 2);
    const rightPad = headerPad - leftPad;
    lines.push(b("\u256D" + "\u2500".repeat(leftPad)) + th.fg("accent", headerText) + b("\u2500".repeat(rightPad) + "\u256E"));

    // Rarity distribution
    const dist = renderRarityDistribution(this.entries);
    lines.push(b("\u2502") + padTo(` ${dist}`, innerW) + b("\u2502"));
    lines.push(b("\u251C" + "\u2500".repeat(innerW) + "\u2524"));

    // ── Two-column: list | detail ────────────────────────────────

    // Scroll window
    const maxVisible = Math.min(MAX_VISIBLE, this.entries.length);
    let start = Math.max(0, this.selected - Math.floor(maxVisible / 2));
    const maxStart = Math.max(0, this.entries.length - maxVisible);
    if (start > maxStart) start = maxStart;

    // Build list rows
    const listRows: string[] = [];
    for (let i = start; i < start + maxVisible; i++) {
      const entry = this.entries[i];
      if (!entry) break;
      const comp = entry.companion;
      const isActive = entry.id === this.activeId;
      const isSel = i === this.selected;
      const color = RARITY_ANSI[comp.rarity];
      const stars = RARITY_STARS[comp.rarity];
      const marker = isActive ? " \u2190" : "";
      const prefix = isSel ? "\u25B6 " : "  ";
      const raw = `${prefix}${comp.name} ${stars}${marker}`;
      const styled = isSel
        ? `${BOLD}${color}${raw}${RESET}`
        : `${DIM}${color}${raw}${RESET}`;
      listRows.push(padTo(truncateToWidth(styled, LIST_COL, ""), LIST_COL));
    }

    // Build detail for selected entry
    const sel = this.entries[this.selected];
    const detailLines = sel ? this.buildDetail(sel, detailCol) : [];

    // Row height = max(list rows, detail lines)
    const rowHeight = Math.max(listRows.length, detailLines.length);

    // Render side-by-side: │ list (LIST_COL) │ gap │ detail (detailCol) │
    const rowBorder = b("\u2502");
    const gapStr = " ".repeat(COL_GAP);
    for (let r = 0; r < rowHeight; r++) {
      const left = r < listRows.length ? listRows[r]! : " ".repeat(LIST_COL);
      const right = r < detailLines.length ? detailLines[r]! : " ".repeat(detailCol);
      lines.push(rowBorder + left + gapStr + right + rowBorder);
    }

    // ── Footer ───────────────────────────────────────────────────
    lines.push(b("\u251C" + "\u2500".repeat(innerW) + "\u2524"));

    const scrollInfo = this.entries.length > maxVisible
      ? `(${this.selected + 1}/${this.entries.length}) `
      : "";
    const hint = `${scrollInfo}\u2191\u2193 browse · Enter summon · Esc close`;
    lines.push(rowBorder + padTo(` ${th.fg("dim", hint)}`, innerW) + rowBorder);
    lines.push(b("\u2570" + "\u2500".repeat(innerW) + "\u256F"));
    return lines;
  }

  // ── Detail panel for selected buddy ────────────────────────────

  private buildDetail(entry: CollectionEntry, colW: number): string[] {
    const comp = entry.companion;
    const color = RARITY_ANSI[comp.rarity];
    const stars = RARITY_STARS[comp.rarity];
    const lines: string[] = [];

    // Sprite (frame 0)
    const sprite = renderSprite(comp, 0);
    for (const line of sprite) {
      lines.push(padTo(`${color}${line}${RESET}`, colW));
    }

    // Name + rarity + shiny
    const nameLine = `${BOLD}${color}${comp.name}${RESET}  ${stars}${comp.shiny ? " \u2728" : ""}`;
    lines.push(padTo(nameLine, colW));

    // Species + rarity label
    const speciesLine = `${color}${comp.rarity.toUpperCase()} ${comp.species}${RESET}`;
    lines.push(padTo(speciesLine, colW));

    // Blank
    lines.push(" ".repeat(colW));

    // Stats bars — scale bar to fit column
    const barWidth = Math.min(20, colW - 12); // "DBG ████████░░░░  42 ▲"
    for (const [name, value] of Object.entries(comp.stats)) {
      const v = value as number;
      const filled = Math.round((v / 100) * barWidth);
      const bar = "\u2588".repeat(filled) + "\u2591".repeat(barWidth - filled);
      const marker = name === comp.peak ? " \u25B2" : name === comp.dump ? " \u25BC" : "  ";
      const statLine = `${name.slice(0, 3)} ${color}${bar}${RESET} ${String(v).padStart(3)}${marker}`;
      lines.push(padTo(statLine, colW));
    }

    // Blank
    lines.push(" ".repeat(colW));

    // Personality — word-wrap to fill the column
    const persLines = wrapLines(comp.personality, colW);
    for (const pl of persLines) {
      lines.push(padTo(`${ITALIC}${DIM}${pl}${RESET}`, colW));
    }

    return lines;
  }

  // ── Empty state ────────────────────────────────────────────────

  private renderEmpty(width: number): string[] {
    const th = this.theme;
    const b = (s: string) => th.fg("border", s);
    const innerW = width - 2;
    const rowBorder = b("\u2502");
    const lines: string[] = [];
    lines.push(b("\u256D" + "\u2500".repeat(innerW) + "\u256E"));
    lines.push(rowBorder + " ".repeat(innerW) + rowBorder);
    const msg = `  No buddies yet. Use ${th.fg("accent", "/buddy roll")} to hatch one!`;
    lines.push(rowBorder + padTo(msg, innerW) + rowBorder);
    lines.push(rowBorder + " ".repeat(innerW) + rowBorder);
    lines.push(b("\u2570" + "\u2500".repeat(innerW) + "\u256F"));
    return lines;
  }
}
