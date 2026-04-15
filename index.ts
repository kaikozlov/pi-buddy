import { randomUUID } from "node:crypto";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
  buddySpeech,
  resolveBuddyModel,
  invalidateModelCache,
  speechHistory,
} from "./src/speech.ts";
import { BuddyPiFooter } from "./src/buddy-footer.ts";
import {
  BuddyEditor,
  buildNarrowBuddyLine,
  BUBBLE_SHOW,
  FADE_WINDOW,
  PET_BURST_MS,
  TICK_MS,
} from "./src/editor.ts";
import { buildCompanion, resolveBuddyUserId, rollFresh } from "./src/companion.ts";
import { companionIntroText, isDirectlyAddressingBuddy } from "./src/prompt.ts";
import { generateFallbackPersonality, generateSoul } from "./src/soul.ts";
import {
  addTreats,
  bumpGlobalHatch,
  bumpStat,
  getStoredCompanion,
  loadConfig,
  putBuddy,
  setActiveBuddyId,
  shinyTreatMultiplier,
} from "./src/state.ts";
import { type Companion } from "./src/types.ts";
import {
  detectBashReaction,
  detectEditReaction,
  detectWriteReaction,
  detectGrepReaction,
  detectReadReaction,
  detectBashError,
  detectEditError,
  pickGenericErrorReaction,
} from "./src/reactions.ts";
import {
  buddyArgumentCompletions,
  extractText,
  trunc,
  handleBuddyCommand,
  setAutocompleteContext,
  type CommandCallbacks,
} from "./src/commands.ts";
import { shouldComment, createCommentaryState, type CommentaryState } from "./src/commentary.ts";

// ── Shared mutable state (editor) ──────────────────────────────────────
// These variables are owned by index.ts and passed to editor.ts functions
// as parameters so that editor.ts remains stateless.

let editorCompanion: Companion | undefined;
let editorReaction: string | undefined;
let editorMuted = false;
let editorPetting = false;
let editorPetAt = 0;
let editorTick = 0;
let editorReactionAt = 0;
let activeBuddyEditor: BuddyEditor | undefined;


// ── Companion lifecycle ────────────────────────────────────────────────

let companionCache: Companion | undefined;

async function ensureCompanion(ctx: ExtensionContext): Promise<Companion | undefined> {
  if (companionCache) return companionCache;
  const stored = getStoredCompanion();
  const userId = resolveBuddyUserId();
  if (stored) {
    const c = buildCompanion(userId, stored);
    // Apply species override if set
    const cfg = loadConfig();
    if (cfg.speciesOverride && c.species !== cfg.speciesOverride) {
      companionCache = { ...c, species: cfg.speciesOverride };
    } else {
      companionCache = c;
    }
    return companionCache;
  }

  // First hatch - try to generate soul
  const fresh = rollFresh();
  const resolved = resolveBuddyModel(ctx);
  const soul = resolved
    ? await generateSoul(resolved.model, fresh.bones).catch(() => undefined)
    : undefined;
  const storedComp = {
    id: randomUUID(),
    name: soul?.name ?? "Buddy",
    personality: soul?.personality ?? generateFallbackPersonality(fresh.bones),
    hatchedAt: Date.now(),
    bonesSeed: fresh.seed,
  };
  putBuddy(storedComp);
  setActiveBuddyId(storedComp.id);
  bumpGlobalHatch();
  companionCache = buildCompanion(userId, storedComp);
  return companionCache;
}

function bustCompanionCache() {
  companionCache = undefined;
}

// ── Extension ──────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  let timer: ReturnType<typeof setInterval> | undefined;
  /** Fresh session context for BuddyPiFooter (built-in footer is not on-screen when custom footer is set). */
  let latestExtensionCtx: ExtensionContext | undefined;
  let tick = 0;
  let reaction: string | undefined;
  let reactionAt = 0;
  let lastUser = "";
  let introDone = false;
  let directPending = false;
  let streaming = false;
  let commentaryState: CommentaryState = createCommentaryState();

  async function runSafely(label: string, fn: () => Promise<void> | void) {
    try {
      await fn();
    } catch (err) {
      console.warn(`[pi-buddy] ${label}:`, err instanceof Error ? err.message : err);
    }
  }

  const refresh = async (ctx: ExtensionContext) => {
    latestExtensionCtx = ctx;
    if (!ctx?.hasUI) return;
    const cfg = loadConfig();
    editorReaction = reaction;
    editorMuted = cfg.companionMuted ?? false;
    editorTick = tick;
    if (!streaming) {
      const c = getStoredCompanion() ? await ensureCompanion(ctx) : undefined;
      editorCompanion = c ?? undefined;
    }
    if (activeBuddyEditor) activeBuddyEditor.invalidateBuddy();
  };

  const setReact = async (ctx: ExtensionContext, r: string | undefined) => {
    reaction = r;
    if (r) {
      reactionAt = Date.now();
      editorReactionAt = reactionAt;
    }
    await refresh(ctx);
  };

  // ── /buddy command ───────────────────────────────────────────────────

  const cb: CommandCallbacks = {
    ensureCompanion,
    bustCompanionCache,
    refresh,
    setReact,
    getEditorState: () => ({
      editorPetting,
      setEditorPetting: (v) => { editorPetting = v; },
      editorPetAt,
      setEditorPetAt: (v) => { editorPetAt = v; },
      activeBuddyEditor,
      editorCompanion,
      setEditorCompanion: (v) => { editorCompanion = v; },
      editorReaction,
      setEditorReaction: (v) => { editorReaction = v; },
      editorMuted,
      setEditorMuted: (v) => { editorMuted = v; },
      editorTick,
      setEditorTick: (v) => { editorTick = v; },
      editorReactionAt,
      setEditorReactionAt: (v) => { editorReactionAt = v; },
      reaction,
      setReaction: (v) => { reaction = v; },
    }),
  };

  pi.registerCommand("buddy", {
    description: "Coding companion \u2014 show, pet, configure, or manage your terminal buddy",
    getArgumentCompletions: buddyArgumentCompletions,
    handler: async (args, ctx) => {
      await handleBuddyCommand(args, ctx, cb);
    },
  });

  // ── Session lifecycle ──────────────────────────────────────────────

  pi.on("session_start", async (_e, ctx) => {
    await runSafely("session_start", async () => {
    setAutocompleteContext(ctx);
    introDone = false;
    directPending = false;
    lastUser = "";
    tick = 0;
    invalidateModelCache();
    companionCache = undefined;
    reaction = undefined;
    editorPetting = false;
    editorPetAt = 0;
    editorReactionAt = 0;
    streaming = false;
    speechHistory.length = 0;
    commentaryState = createCommentaryState();
    bumpStat("sessions");
    {
      const c = await ensureCompanion(ctx);
      addTreats(5 * shinyTreatMultiplier(c ?? {}));
    }

    // Register BuddyEditor (full sprite when wide) and cwd-line buddy on narrow terminals
    if (ctx.hasUI) {
      latestExtensionCtx = ctx;
      ctx.ui.setEditorComponent((tui, theme, keybindings) =>
        new BuddyEditor(
          tui, theme, keybindings,
          () => ({
            companion: editorCompanion,
            reaction: editorReaction,
            muted: editorMuted,
            petting: editorPetting,
            petAt: editorPetAt,
            tick: editorTick,
            reactionAt: editorReactionAt,
          }),
          (editor) => { activeBuddyEditor = editor; },
        )
      );
      ctx.ui.setFooter((_tui, _piTheme, footerData) => {
        return new BuddyPiFooter(footerData, () => latestExtensionCtx, () => {
          if (editorMuted || !editorCompanion) return undefined;
          const speaking = !!editorReaction && !editorMuted;
          const fading =
            speaking && (Date.now() - editorReactionAt) >= (BUBBLE_SHOW - FADE_WINDOW) * TICK_MS;
          const petting = editorPetting && (Date.now() - editorPetAt) < PET_BURST_MS;
          return buildNarrowBuddyLine(
            editorCompanion,
            speaking ? editorReaction : undefined,
            activeBuddyEditor?.focused ?? false,
            petting,
            fading,
          );
        });
      });
    }

    ctx.ui.setWidget("pi-buddy", undefined);
    await refresh(ctx);

    // Teaser: if no companion yet, show a hint
    if (!getStoredCompanion() && ctx.hasUI) {
      ctx.ui.notify("Use /buddy to hatch a terminal companion!", "info");
    }

    if (ctx.hasUI) {
      clearInterval(timer);
      timer = setInterval(() => {
        tick++;
        if (reaction && Date.now() - reactionAt > BUBBLE_SHOW * TICK_MS) {
          reaction = undefined;
          editorReaction = undefined;
        }
        if (editorPetting && Date.now() - editorPetAt >= PET_BURST_MS) editorPetting = false;
        void refresh(ctx);
      }, TICK_MS);
    }
    }); // runSafely
  });

  pi.on("session_shutdown", async (_e, ctx) => {
    await runSafely("session_shutdown", async () => {
    setAutocompleteContext(undefined);
    if (timer) clearInterval(timer);
    timer = undefined;
    editorCompanion = undefined;
    editorReaction = undefined;
    editorReactionAt = 0;
    editorPetting = false;
    if (ctx.hasUI) {
      ctx.ui.setWidget("pi-buddy", undefined);
      ctx.ui.setFooter(undefined);
      ctx.ui.setEditorComponent(undefined);
      activeBuddyEditor = undefined;
    }
    latestExtensionCtx = undefined;
    }); // runSafely
  });

  // ── Streaming guard ───────────────────────────────────────────────

  pi.on("agent_start", async () => {
    await runSafely("agent_start", () => { streaming = true; });
  });

  pi.on("agent_end", async (_e, ctx) => {
    await runSafely("agent_end", async () => { streaming = false; await refresh(ctx); });
  });

  // ── Model change detection ────────────────────────────────────────

  pi.on("model_select", async () => {
    await runSafely("model_select", () => { invalidateModelCache(); });
  });

  // ── Input ──────────────────────────────────────────────────────────

  pi.on("input", async (event, ctx) => {
    lastUser = event.text;
    const c = getStoredCompanion() ? await ensureCompanion(ctx) : undefined;
    directPending = c ? isDirectlyAddressingBuddy(event.text, c) : false;
    return { action: "continue" as const };
  });

  // ── System prompt injection (thin - just "you're not the buddy") ──

  pi.on("before_agent_start", async (event, ctx) => {
    const cfg = loadConfig();
    const c = getStoredCompanion() ? await ensureCompanion(ctx) : undefined;
    if (!c || cfg.companionMuted) return;

    // Inject once for intro, or again if user is directly addressing buddy
    if (introDone && !directPending) return;

    // Only inject if there's actual conversation context (not empty session)
    if (!introDone && !lastUser) {
      // Skip intro on empty sessions - it'll get injected on first real turn
      return;
    }
    introDone = true;

    const extra = companionIntroText(c.name, c.species);
    return {
      systemPrompt: event.systemPrompt
        ? `${event.systemPrompt}\n\n${extra}`
        : extra,
    };
  });

  // ── Tool result reactions (full observer) ──────────────────────────

  pi.on("tool_result", async (event, ctx) => {
    await runSafely("tool_result", async () => {
    const output = event.content
      .filter((item: any) => item.type === "text")
      .map((item: any) => item.text ?? "")
      .join("\n\n");

    const cfg = loadConfig();
    const c = getStoredCompanion() ? await ensureCompanion(ctx) : undefined;

    let r: string | undefined;

    // ── Error path: check isError FIRST ────────────────────────────
    if (event.isError) {
      if (c && shouldComment("tool_error", {
        state: commentaryState,
        commentChance: cfg.commentChance,
        commentCooldown: cfg.commentCooldown,
        companion: c,
      })) {
        switch (event.toolName) {
          case "bash": {
            r = detectBashError(output, c.species);
            break;
          }
          case "edit":
          case "write": {
            r = detectEditError(output, c.species);
            break;
          }
          default: {
            r = pickGenericErrorReaction(c.species);
            break;
          }
        }
        if (r) {
          addTreats(2 * shinyTreatMultiplier(c));
          bumpStat("reactionsTriggered");
          await setReact(ctx, r);
          return; // skip normal scripted detection
        }
      }
      // Error path didn't produce a reaction — fall through to normal detection
    }

    // ── Normal scripted detection (non-error) ───────────────────────
    switch (event.toolName) {
      case "bash": {
        r = detectBashReaction(output);
        break;
      }
      case "edit":
      case "write": {
        const input = event.input as Record<string, unknown>;
        const path = (input.file_path ?? input.path ?? "") as string;
        // pi's edit tool uses { path, edits: [{oldText, newText}] };
        // write uses { path, content }. Claude Code uses file_path + new_text.
        let content: string;
        if (event.toolName === "edit") {
          const edits = input.edits as Array<{ oldText?: string; newText?: string }> | undefined;
          content = edits?.map(e => e.newText ?? "").join("\n") ?? (input.content as string ?? input.new_text as string ?? output);
        } else {
          content = (input.content as string ?? output);
        }
        r = event.toolName === "edit"
          ? detectEditReaction(path, content)
          : detectWriteReaction(path, content);
        break;
      }
      case "grep":
      case "ripgrep":
      case "search": {
        r = detectGrepReaction(output);
        break;
      }
      case "read":
      case "view": {
        const input = event.input as Record<string, unknown>;
        const path = (input.file_path ?? input.path ?? "") as string;
        r = detectReadReaction(path, output);
        break;
      }
    }

    // Scripted one-liners from tool output (not the LLM "observer" comment path).
    if (r && c && shouldComment("scripted_reaction", {
      state: commentaryState,
      commentChance: cfg.commentChance,
      commentCooldown: cfg.commentCooldown,
      companion: c,
    })) {
      bumpStat("reactionsTriggered");
      addTreats(1 * shinyTreatMultiplier(c));
      await setReact(ctx, r);
    }
    }); // runSafely
  });

  // ── Out-of-band buddy comment ──────────────────────────────────────

  pi.on("message_end", async (event, ctx) => {
    await runSafely("message_end", async () => {
    if (event.message.role !== "assistant") return;
    const cfg = loadConfig();
    const c = getStoredCompanion() ? await ensureCompanion(ctx) : undefined;
    if (!c || cfg.companionMuted) return;

    const text = extractText(event.message);
    if (!text) return;

    // Direct address → always respond
    if (directPending) {
      directPending = false;
      const reply = await buddySpeech(ctx, c, `The user directly addressed ${c.name} by name.\n\nUser: ${trunc(lastUser, 500)}`);
      if (reply) {
        bumpStat("commentsMade");
        await setReact(ctx, reply);
      }
      return;
    }

    // Ambient comment: use commentary bucket system
    if (!shouldComment("message_end_assistant", {
      state: commentaryState,
      commentChance: cfg.commentChance,
      commentCooldown: cfg.commentCooldown,
      companion: c,
    })) return;

    const comment = await buddySpeech(
      ctx, c,
      `Recent exchange:\n\nUser: ${trunc(lastUser, 500)}\nAssistant: ${trunc(text, 1200)}\n\nMake one short in-character remark about something specific.`,
    );
    if (comment) {
      bumpStat("observations");
      addTreats(2 * shinyTreatMultiplier(c));
      await setReact(ctx, comment);
    }
    }); // runSafely
  });
}
