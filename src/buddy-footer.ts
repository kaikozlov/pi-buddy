import {
  FooterComponent,
  type AgentSession,
  type ExtensionContext,
  type ReadonlyFooterDataProvider,
} from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth, type Component } from "@mariozechner/pi-tui";

const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
/** Match FooterComponent pwd truncation ellipsis styling without importing the interactive theme module. */
const DIM_ELLIPSIS = `${DIM}...${RESET}`;

/** Match `MIN_COLS_FOR_FULL_SPRITE` in index — footer buddy only when editor uses narrow layout. */
export const MIN_COLS_FOR_FOOTER_BUDDY = 100;

function getThinkingLevel(sessionManager: ExtensionContext["sessionManager"]): string {
  const entries = sessionManager.getEntries();
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]!;
    if (e.type === "thinking_level_change") return e.thinkingLevel;
  }
  return "off";
}

function createFooterSessionProxy(getCtx: () => ExtensionContext | undefined): AgentSession {
  return new Proxy({} as AgentSession, {
    get(_target, prop) {
      const ctx = getCtx();
      if (!ctx) return undefined;
      switch (prop) {
        case "state":
          return { model: ctx.model, thinkingLevel: getThinkingLevel(ctx.sessionManager) };
        case "sessionManager":
          return ctx.sessionManager;
        case "modelRegistry":
          return ctx.modelRegistry;
        case "getContextUsage":
          return () => ctx.getContextUsage();
        default:
          return undefined;
      }
    },
  });
}

/**
 * Default pi footer with the narrow buddy merged onto the cwd line (right-aligned),
 * for terminals where the editor does not show the full sprite.
 */
export class BuddyPiFooter implements Component {
  focused = false;
  private readonly inner: FooterComponent;

  invalidate(): void {}

  constructor(
    footerData: ReadonlyFooterDataProvider,
    private readonly getCtx: () => ExtensionContext | undefined,
    private readonly getBuddyLabel: () => string | undefined,
  ) {
    this.inner = new FooterComponent(createFooterSessionProxy(getCtx), footerData);
  }

  dispose(): void {
    this.inner.dispose();
  }

  render(width: number): string[] {
    const lines = this.inner.render(width);
    if (width >= MIN_COLS_FOR_FOOTER_BUDDY || lines.length === 0) return lines;

    const buddy = this.getBuddyLabel();
    if (!buddy) return lines;

    const bw = visibleWidth(buddy);
    const gap = 1;
    const maxPwd = width - bw - gap;
    if (maxPwd < 12) return lines;

    const pwdLine = lines[0]!;
    const pwdTrunc = truncateToWidth(pwdLine, maxPwd, DIM_ELLIPSIS);
    const pw = visibleWidth(pwdTrunc);
    const spaces = width - pw - bw;
    if (spaces < gap) return lines;

    lines[0] = truncateToWidth(`${pwdTrunc}${" ".repeat(spaces)}${buddy}`, width, "");
    return lines;
  }
}
