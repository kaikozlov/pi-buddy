/**
 * src/editor.ts — BuddyEditor, BuddyTextOverlay, and sprite-in-editor rendering helpers.
 *
 * Extracted from index.ts during Sprint 0 restructure. All rendering of the buddy
 * sprite alongside the input box, plus the framed overlay panel, lives here.
 */

import { CustomEditor, Theme } from "@mariozechner/pi-coding-agent";
import {
  getKeybindings,
  truncateToWidth,
  visibleWidth,
  type AutocompleteItem,
  type Component,
  type EditorTheme,
  type TUI,
} from "@mariozechner/pi-tui";
import { renderFace, renderSprite, spriteFrameCount } from "./sprites.ts";
import { type Companion } from "./types.ts";

// ── ANSI constants ─────────────────────────────────────────────────────

export const RARITY_ANSI: Record<Companion["rarity"], string> = {
  common: "\x1b[90m",
  uncommon: "\x1b[32m",
  rare: "\x1b[94m",
  epic: "\x1b[95m",
  legendary: "\x1b[33m",
};
export const HEART_ANSI = "\x1b[91m";
export const DIM = "\x1b[2m";
export const BOLD = "\x1b[1m";
export const ITALIC = "\x1b[3m";
export const INVERSE = "\x1b[7m";
export const RESET = "\x1b[0m";

// ── Timing / layout constants ──────────────────────────────────────────

export const TICK_MS = 500;
export const BUBBLE_SHOW = 20;
export const FADE_WINDOW = 6;
export const PET_BURST_MS = 2500;
export const IDLE_SEQUENCE = [0, 0, 0, 0, 1, 0, 0, 0, -1, 0, 0, 2, 0, 0, 0] as const;

export const MIN_COLS_FOR_FULL_SPRITE = 100; // must match MIN_COLS_FOR_FOOTER_BUDDY in buddy-footer.ts
export const SPRITE_BODY_WIDTH = 12;
export const NAME_ROW_PAD = 2;
export const SPRITE_PADDING_X = 2;
export const BUBBLE_WIDTH = 36;
export const NARROW_QUIP_CAP = 24;

export const PET_HEARTS = [
  "   ♥    ♥   ",
  "  ♥  ♥   ♥  ",
  " ♥   ♥  ♥   ",
  "♥  ♥      ♥ ",
  "·    ·   ·  ",
] as const;

// ── Helper functions ───────────────────────────────────────────────────

export function wrap(text: string, width: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur.length + w.length + 1 > width && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function colorize(text: string, color: string, extra = ""): string {
  return `${extra}${color}${text}${RESET}`;
}

export function styleLabel(companion: Companion, text: string, focused: boolean, reaction: boolean, fading: boolean): string {
  const color = fading ? "\x1b[90m" : (RARITY_ANSI[companion.rarity] ?? RESET);
  if (reaction) return `${ITALIC}${color}${text}${RESET}`;
  if (focused) return `${ITALIC}${BOLD}${INVERSE}${RARITY_ANSI[companion.rarity]}${text}${RESET}`;
  return `${ITALIC}${DIM}${text}${RESET}`;
}

export function spriteColWidth(nameWidth: number): number {
  return Math.max(SPRITE_BODY_WIDTH, nameWidth + NAME_ROW_PAD);
}

export function speechBubbleLines(text: string, color: string, fading: boolean): string[] {
  const innerWidth = 30;
  const lines = wrap(text, innerWidth);
  const border = fading ? "\x1b[90m" : color;
  const top = `${border}╭${"─".repeat(innerWidth + 2)}╮${RESET}`;
  const bottom = `${border}╰${"─".repeat(innerWidth + 2)}╯${RESET}`;
  const out = [top];
  for (const line of lines) {
    out.push(`${border}│${RESET} ${ITALIC}${fading ? "\x1b[90m" : ""}${line.padEnd(innerWidth)}${RESET} ${border}│${RESET}`);
  }
  out.push(bottom);
  const tailRow = Math.max(1, Math.floor(out.length / 2));
  return out.map((line, i) => `${line}${i === tailRow ? `${border}─${RESET}` : " "}`);
}

export function padRight(text: string, width: number): string {
  const pad = Math.max(0, width - visibleWidth(text));
  return text + " ".repeat(pad);
}

export function padCenter(text: string, width: number): string {
  const textW = visibleWidth(text);
  const pad = Math.max(0, width - textW);
  const left = Math.floor(pad / 2);
  const right = pad - left;
  return " ".repeat(left) + text + " ".repeat(right);
}

// ── Sprite block builders ──────────────────────────────────────────────

export function buildFullBuddyBlock(
  companion: Companion,
  reaction: string | undefined,
  tick: number,
  focused: boolean,
  petting: boolean,
  fading: boolean,
  editorPetAt: number,
): { lines: string[]; width: number } {
  const color = RARITY_ANSI[companion.rarity] ?? RESET;
  const frameCount = spriteFrameCount(companion.species);
  const petAge = petting ? Math.floor((Date.now() - editorPetAt) / TICK_MS) : Infinity;
  const heartFrame = petting ? PET_HEARTS[petAge % PET_HEARTS.length] : null;

  let spriteFrame: number;
  let blink = false;
  if (reaction || petting) {
    spriteFrame = tick % frameCount;
  } else {
    const step = IDLE_SEQUENCE[tick % IDLE_SEQUENCE.length]!;
    if (step === -1) {
      spriteFrame = 0;
      blink = true;
    } else {
      spriteFrame = step % frameCount;
    }
  }

  const body = renderSprite(companion, spriteFrame).map(line =>
    blink ? line.replaceAll(companion.eye, "-") : line,
  );
  const sprite = heartFrame ? [heartFrame, ...body] : body;
  const spritePlainW = Math.max(...sprite.map(line => visibleWidth(line)), 1);
  const colWidth = Math.max(spriteColWidth(visibleWidth(companion.name)), spritePlainW);
  const rawName = focused ? ` ${companion.name} ` : companion.name;
  // Style after centering so focused inverse / dim covers padding too (matches visual "tag" to column).
  const nameLabel = styleLabel(companion, padCenter(rawName, colWidth), focused, false, false);
  const spriteLines = [
    ...sprite.map((line, i) => padCenter(colorize(line, i === 0 && heartFrame ? HEART_ANSI : color), colWidth)),
    nameLabel,
  ];

  if (!reaction) {
    return { lines: spriteLines, width: colWidth };
  }

  const bubble = speechBubbleLines(reaction, color, fading);
  const height = Math.max(bubble.length, spriteLines.length);
  const bubbleWidth = BUBBLE_WIDTH;
  const bubbleTopPad = height - bubble.length;
  const spriteTopPad = height - spriteLines.length;
  const lines: string[] = [];
  for (let i = 0; i < height; i++) {
    const left = padRight(i < bubbleTopPad ? "" : (bubble[i - bubbleTopPad] ?? ""), bubbleWidth);
    const right = padRight(i < spriteTopPad ? "" : (spriteLines[i - spriteTopPad] ?? ""), colWidth);
    lines.push(`${left}${right}`);
  }
  return { lines, width: bubbleWidth + colWidth };
}

export function buildNarrowBuddyLine(
  companion: Companion,
  reaction: string | undefined,
  focused: boolean,
  petting: boolean,
  fading: boolean,
): string {
  const quip = reaction && reaction.length > NARROW_QUIP_CAP ? reaction.slice(0, NARROW_QUIP_CAP - 1) + "..." : reaction;
  const label = quip ? `"${quip}"` : focused ? ` ${companion.name} ` : companion.name;
  const face = colorize(renderFace(companion), RARITY_ANSI[companion.rarity] ?? RESET, BOLD);
  const heart = petting ? `${HEART_ANSI}♥${RESET} ` : "";
  return `${heart}${face} ${styleLabel(companion, label, focused, !!reaction, fading)}`;
}

// ── BuddyTextOverlay ───────────────────────────────────────────────────
//
// Framed overlay (like REFERENCE/pi-mcp-adapter mcp-panel): title in the top rule,
// body inside │ ... │, hint row above the bottom rule - no floating chrome.

export class BuddyTextOverlay implements Component {
  focused = false;
  private readonly onClose: () => void;
  constructor(
    private readonly body: string,
    private readonly theme: Theme,
    onClose: () => void,
  ) {
    this.onClose = onClose;
  }

  invalidate(): void {}

  handleInput(data: string): void {
    const kb = getKeybindings();
    if (kb.matches(data, "tui.select.confirm") || kb.matches(data, "tui.select.cancel")) this.onClose();
  }

  render(width: number): string[] {
    const innerW = width - 2;
    const b = (s: string) => this.theme.fg("dim", s);
    const lines: string[] = [];

    const titleStyled = this.theme.bold(this.theme.fg("accent", " Buddy "));
    let borderLen = innerW - visibleWidth(titleStyled);
    if (borderLen < 0) borderLen = 0;
    const leftB = Math.floor(borderLen / 2);
    const rightB = borderLen - leftB;
    lines.push(b("\u256D" + "\u2500".repeat(leftB)) + titleStyled + b("\u2500".repeat(rightB) + "\u256E"));

    const row = (content: string) =>
      b("\u2502") + truncateToWidth(" " + content, innerW, "\u2026", true) + b("\u2502");

    lines.push(row(""));

    for (const raw of this.body.split("\n")) {
      lines.push(row(raw));
    }

    lines.push(row(""));
    lines.push(b("\u251C" + "\u2500".repeat(innerW) + "\u2524"));
    lines.push(row(""));
    const hint = this.theme.fg("dim", "Enter or Esc \u2014 close");
    lines.push(row(hint));
    lines.push(row(""));
    lines.push(b("\u2570" + "\u2500".repeat(innerW) + "\u256F"));
    return lines;
  }
}

// ── BuddyEditor ────────────────────────────────────────────────────────
//
// Direct port of Claude Code's companion layout logic, adapted to pi's
// string-based CustomEditor rendering.

export class BuddyEditor extends CustomEditor {
  constructor(
    tui: TUI,
    theme: EditorTheme,
    keybindings: any,
    private readonly getEditorState: () => {
      companion: Companion | undefined;
      reaction: string | undefined;
      muted: boolean;
      petting: boolean;
      petAt: number;
      tick: number;
      reactionAt: number;
    },
    private readonly onActive: (editor: BuddyEditor) => void,
  ) {
    super(tui, theme, keybindings);
    this.onActive(this);
  }

  invalidateBuddy(): void {
    this.tui.requestRender();
  }

  override handleInput(data: string): void {
    super.handleInput(data);
  }

  override render(width: number): string[] {
    const state = this.getEditorState();
    const companion = state.companion;
    const speaking = !!state.reaction && !state.muted;
    const hasBuddy = !!companion && !state.muted;
    if (!hasBuddy) return super.render(width);

    const fading = speaking && (Date.now() - state.reactionAt) >= (BUBBLE_SHOW - FADE_WINDOW) * TICK_MS;
    const petting = state.petting && (Date.now() - state.petAt) < PET_BURST_MS;

    // Narrow terminals: full-width input; compact buddy lives on the footer cwd line (BuddyPiFooter).
    if (width < MIN_COLS_FOR_FULL_SPRITE) return super.render(width);

    const block = buildFullBuddyBlock(companion!, speaking ? state.reaction : undefined, state.tick, this.focused, petting, fading, state.petAt);
    const reserved = block.width + SPRITE_PADDING_X;
    const editorWidth = Math.max(20, width - reserved);
    const base = super.render(editorWidth);
    const height = Math.max(base.length, block.lines.length);
    const out: string[] = [];
    const editorTopPad = height - base.length;
    const buddyTopPad = height - block.lines.length;

    for (let i = 0; i < height; i++) {
      const left = i < editorTopPad ? "" : (base[i - editorTopPad] ?? "");
      const right = i < buddyTopPad ? "" : (block.lines[i - buddyTopPad] ?? "");
      out.push(truncateToWidth(`${padRight(left, editorWidth)}${" ".repeat(SPRITE_PADDING_X)}${right}`, width, ""));
    }
    return out;
  }

  override invalidate(): void {
    super.invalidate();
    this.onActive(this);
  }
}
