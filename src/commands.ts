/**
 * src/commands.ts — /buddy slash command handler, autocomplete, subcommand definitions.
 *
 * Extracted from index.ts during Sprint 0 restructure. The command handler receives
 * all dependencies via a Callbacks object (no global state access).
 */

import { randomUUID } from "node:crypto";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
  fuzzyFilter,
  type AutocompleteItem,
} from "@mariozechner/pi-tui";
import {
  BuddyTextOverlay,
  PET_BURST_MS,
} from "./editor.ts";
import { CollectionView } from "./collection-view.ts";
import { buildCompanion, resolveBuddyUserId, rollFresh } from "./companion.ts";
import {
  renderBuddyDashboard,
  renderRarityDistribution,
  type CollectionEntry,
} from "./render.ts";
import { generateFallbackPersonality, generateSoul } from "./soul.ts";
import {
  bumpGlobalHatch,
  bumpStat,
  deleteBuddy,
  deleteBuddyStats,
  formatBuddyListId,
  getActiveBuddyId,
  getStoredCompanion,
  listBuddies,
  loadConfig,
  loadGlobalHatchStats,
  loadPerBuddyStats,
  putBuddy,
  resolveBuddyIdPrefix,
  saveConfig,
  setActiveBuddyId,
  addTreats,
  loadTreats,
  spendTreats,
  shinyTreatMultiplier,
} from "./state.ts";
import { SPECIES, type Companion } from "./types.ts";
import {
  PET_REACTIONS,
  petReaction,
} from "./reactions.ts";
import {
  resolveBuddyModel,
  validateModelInput,
  fmtModel,
  allModels,
  invalidateModelCache,
} from "./speech.ts";

// ── Types ──────────────────────────────────────────────────────────────

/** Callbacks that index.ts provides so commands.ts stays stateless. */
export interface CommandCallbacks {
  ensureCompanion(ctx: ExtensionContext): Promise<Companion | undefined>;
  bustCompanionCache(): void;
  refresh(ctx: ExtensionContext): Promise<void>;
  setReact(ctx: ExtensionContext, r: string | undefined): Promise<void>;
  getEditorState(): {
    editorPetting: boolean;
    setEditorPetting(v: boolean): void;
    editorPetAt: number;
    setEditorPetAt(v: number): void;
    activeBuddyEditor: { invalidateBuddy(): void } | undefined;
    editorCompanion: Companion | undefined;
    setEditorCompanion(v: Companion | undefined): void;
    editorReaction: string | undefined;
    setEditorReaction(v: string | undefined): void;
    editorMuted: boolean;
    setEditorMuted(v: boolean): void;
    editorTick: number;
    setEditorTick(v: number): void;
    editorReactionAt: number;
    setEditorReactionAt(v: number): void;
    reaction: string | undefined;
    setReaction(v: string | undefined): void;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────

export function extractText(msg: any): string {
  if (!msg) return "";
  const c = msg.content;
  if (typeof c === "string") return c;
  if (!Array.isArray(c)) return "";
  return c.filter((b: any) => b?.type === "text").map((b: any) => b.text ?? "").filter(Boolean).join("\n\n");
}

export function trunc(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + "\u2026";
}

export function parseArgs(raw: string): { cmd: string; rest: string } {
  const s = raw.trim();
  if (!s) return { cmd: "show", rest: "" };
  const i = s.indexOf(" ");
  return i === -1 ? { cmd: s, rest: "" } : { cmd: s.slice(0, i), rest: s.slice(i + 1).trim() };
}

async function showBuddyPanel(ctx: ExtensionContext, text: string, overlayWidth = 72): Promise<void> {
  if (!ctx.hasUI) return;
  await ctx.ui.custom(
    (_tui, theme, _kb, done) => new BuddyTextOverlay(text, theme, () => done(undefined)),
    { overlay: true, overlayOptions: { anchor: "center", width: overlayWidth } },
  );
}

const BUDDY_DASHBOARD_WIDTH = 110;

function buddyDashboardText(companion: Companion, reaction?: string): string {
  const per = loadPerBuddyStats(getStoredCompanion());
  const g = loadGlobalHatchStats();
  // Count shinies on-the-fly from menagerie
  const entries = buildCollectionEntries();
  const shiniesFound = entries.filter(e => e.companion.shiny).length;
  return renderBuddyDashboard(companion, reaction, per, { ...g, shiniesFound });
}

/** Build CollectionEntry[] from listBuddies() by resolving bones for each buddy. */
function buildCollectionEntries(): CollectionEntry[] {
  const userId = resolveBuddyUserId();
  return listBuddies().map(({ id, companion: stored }) => ({
    id,
    companion: buildCompanion(userId, stored),
  }));
}

// ── /buddy slash autocomplete (subcommands + model list like /model) ──

let autocompleteContextRef: ExtensionContext | undefined;

export const BUDDY_SUBCOMMANDS: readonly { name: string; description: string; cheat?: boolean }[] = [
  { name: "show", description: "Card + this buddy stats + global hatches (3 cols)" },
  { name: "help", description: "List all /buddy commands" },
  { name: "pet", description: "Pet your companion" },
  { name: "off", description: "Mute companion reactions" },
  { name: "on", description: "Unmute companion" },
  { name: "stats", description: "Same overview as show" },
  { name: "roll", description: "Hatch a new buddy (keeps others in menagerie; becomes active)" },
  { name: "reset", description: "Delete companion and start fresh" },
  { name: "rename", description: "Rename companion (1\u201314 chars)" },
  { name: "personality", description: "Set personality text", cheat: true },
  { name: "species", description: "Change species (keeps name/personality)", cheat: true },
  { name: "model", description: "Show or set buddy comment model" },
  { name: "chance", description: "Show or set comment probability (0\u20131)" },
  { name: "frequency", description: "Show or set comment cooldown (seconds)" },
  { name: "dismiss", description: "Remove a buddy from the menagerie (not active)" },
  { name: "collection", description: "Browse all buddies with sprites, stats, and rarity" },
  { name: "release", description: "Release a buddy for 25 treats (not the active one)" },
];

export const BUDDY_CHANCE_SUGGESTIONS: readonly { value: string; hint: string }[] = [
  { value: "0", hint: "Off" },
  { value: "0.1", hint: "10%" },
  { value: "0.15", hint: "15%" },
  { value: "0.2", hint: "20%" },
  { value: "0.25", hint: "25%" },
  { value: "0.35", hint: "35%" },
  { value: "0.5", hint: "50%" },
  { value: "0.75", hint: "75%" },
  { value: "1", hint: "Always" },
];

export const BUDDY_FREQUENCY_SUGGESTIONS: readonly { value: string; hint: string }[] = [
  { value: "0", hint: "No cooldown" },
  { value: "15", hint: "15s" },
  { value: "30", hint: "30s" },
  { value: "45", hint: "45s" },
  { value: "60", hint: "1 min" },
  { value: "90", hint: "90s" },
  { value: "120", hint: "2 min" },
  { value: "180", hint: "3 min" },
  { value: "300", hint: "5 min" },
  { value: "600", hint: "10 min (max)" },
];

export function buddyExactSubcommand(token: string): string | undefined {
  const t = token.toLowerCase();
  return BUDDY_SUBCOMMANDS.find(s => s.name === t)?.name;
}

function buddySubcommandSuggestions(partial: string): AutocompleteItem[] {
  const cfg = loadConfig();
  const visible = BUDDY_SUBCOMMANDS.filter(s => !s.cheat || cfg.cheatMode);
  const filtered = fuzzyFilter(visible, partial, s => s.name);
  if (filtered.length === 0) return [];
  return filtered.map(s => ({
    value: `${s.name} `,
    label: s.name,
    description: s.description,
  }));
}

function buddyModelArgumentItems(ctx: ExtensionContext, tail: string): AutocompleteItem[] | null {
  const models = allModels(ctx);
  if (models.length === 0) return null;
  const items = models.map(m => ({
    id: m.id,
    provider: m.provider,
    label: `${m.provider}/${m.id}`,
  }));
  const filtered = fuzzyFilter(items, tail, item => `${item.id} ${item.provider}`);
  if (filtered.length === 0) return null;
  return filtered.map(item => ({
    value: `model ${item.label}`,
    label: item.id,
    description: item.provider,
  }));
}

export function buddyArgumentCompletions(argumentPrefix: string): AutocompleteItem[] | null {
  const ctx = autocompleteContextRef;
  const trimmedStart = argumentPrefix.trimStart();
  const spaceIdx = trimmedStart.search(/\s/);
  const firstRaw = spaceIdx === -1 ? trimmedStart : trimmedStart.slice(0, spaceIdx);
  const tail = spaceIdx === -1 ? "" : trimmedStart.slice(spaceIdx + 1).trimStart();

  const firstKey = buddyExactSubcommand(firstRaw);

  if (!firstKey) {
    const subs = buddySubcommandSuggestions(firstRaw);
    return subs.length ? subs : null;
  }

  switch (firstKey) {
    case "model": {
      if (!ctx) return null;
      const items = buddyModelArgumentItems(ctx, tail);
      return items?.length ? items : null;
    }
    case "species": {
      if (!loadConfig().cheatMode) return null;
      const speciesRows = SPECIES.map(name => ({ name }));
      const filtered = fuzzyFilter(speciesRows, tail, r => r.name);
      if (filtered.length === 0) return null;
      return filtered.map(r => ({
        value: `species ${r.name}`,
        label: r.name,
        description: "Species",
      }));
    }
    case "dismiss":
    case "release": {
      const rows = listBuddies().map(b => ({
        id: b.id,
        label: `${formatBuddyListId(b.id)} ${b.companion.name}`,
      }));
      const filtered = fuzzyFilter(rows, tail, r => `${r.id} ${r.label}`);
      if (filtered.length === 0) return null;
      return filtered.map(r => ({
        value: `${firstKey} ${r.id}`,
        label: r.label,
        description: "Buddy id",
      }));
    }
    case "chance": {
      const rows = [...BUDDY_CHANCE_SUGGESTIONS];
      const filtered = fuzzyFilter(rows, tail, r => `${r.value} ${r.hint}`);
      if (filtered.length === 0) return null;
      return filtered.map(r => ({
        value: `chance ${r.value}`,
        label: r.value,
        description: r.hint,
      }));
    }
    case "frequency": {
      const rows = [...BUDDY_FREQUENCY_SUGGESTIONS];
      const filtered = fuzzyFilter(rows, tail, r => `${r.value} ${r.hint}`);
      if (filtered.length === 0) return null;
      return filtered.map(r => ({
        value: `frequency ${r.value}`,
        label: `${r.value}s`,
        description: r.hint,
      }));
    }
    default:
      return null;
  }
}

// ── Command handler ────────────────────────────────────────────────────

export function setAutocompleteContext(ctx: ExtensionContext | undefined) {
  autocompleteContextRef = ctx;
}

export async function handleBuddyCommand(
  args: string | undefined,
  ctx: ExtensionContext,
  cb: CommandCallbacks,
): Promise<void> {
  const { cmd, rest } = parseArgs(args ?? "");
  const es = cb.getEditorState();

  // Commands that don't need a companion
  if (cmd === "help") {
    const helpCfg = loadConfig();
    const cheatLines = helpCfg.cheatMode
      ? [
          "",
          "  \u26A0 Cheat mode is ON",
          "  /buddy personality <text>",
          "                        Set custom personality text",
          "  /buddy species <name> Change species only (keeps name/personality)",
        ]
      : [];
    await showBuddyPanel(ctx, [
      "buddy \u2014 your terminal companion",
      "",
      "  /buddy                Same as show - card + buddy stats + global hatches",
      "  /buddy show           Same (explicit): 3-column overview",
      "  /buddy help           This help text",
      "  /buddy pet            Pet your companion",
      "  /buddy off            Mute companion reactions",
      "  /buddy on             Unmute companion",
      "  /buddy stats          Same panel as show (card | this buddy | all buddies)",
      "  /buddy roll           Hatch a new buddy (previous buddies stay; new one is active)",
      "  /buddy reset          Delete companion and start fresh",
      "",
      "  /buddy rename <name>  Rename your companion (1\u201314 chars)",
      ...cheatLines,
      "",
      "  Buddies live in menagerie.json (one record per id). Config only stores activeBuddyId.",
      "  /buddy collection     Browse all buddies with sprites, stats, rarity\u2014\u2191\u2193 to navigate, Enter to summon",
      "  /buddy dismiss <id>   Delete a buddy from the menagerie (not the active one)",
      "  /buddy release <id>   Release a buddy for 25 treats (not the active one)",
      "",
      "  /buddy model          Show which model generates buddy comments",
      "  /buddy model <p/m>    Set model \u2014 must resolve to a real model.",
      "                        Formats: provider/model-id, partial id",
      "                        Example: /buddy model openai/gpt-4.1-mini",
      "",
      "  /buddy chance         Show comment probability",
      "  /buddy chance 0.35    Set probability (0\u20131)",
      "  /buddy frequency      Show comment cooldown",
      "  /buddy frequency 60   Set cooldown in seconds (0\u2013600)",
    ].join("\n"));
    return;
  }

  // Everything else needs a companion
  let companion = await cb.ensureCompanion(ctx);
  if (!companion) {
    ctx.ui.notify("Couldn't hatch a companion.", "error");
    return;
  }

  switch (cmd) {
    // ── Show ──────────────────────────────────────────────────────
    case "show": {
      const panelLines = [buddyDashboardText(companion, es.reaction)];
      panelLines.push("");
      panelLines.push(renderRarityDistribution(buildCollectionEntries()));
      await showBuddyPanel(ctx, panelLines.join("\n"), BUDDY_DASHBOARD_WIDTH);
      break;
    }

    // ── Pet ───────────────────────────────────────────────────────
    case "pet":
      bumpStat("timesPetted");
      addTreats(1 * shinyTreatMultiplier(companion));
      es.setEditorPetting(true);
      es.setEditorPetAt(Date.now());
      await cb.setReact(ctx, petReaction(companion));
      setTimeout(() => {
        es.setEditorPetting(false);
        es.activeBuddyEditor?.invalidateBuddy();
      }, PET_BURST_MS);
      break;

    // ── Mute / unmute ─────────────────────────────────────────────
    case "off":
      saveConfig({ companionMuted: true });
      await cb.refresh(ctx);
      ctx.ui.notify(`${companion.name} goes quiet.`, "info");
      break;

    case "on":
      saveConfig({ companionMuted: false });
      await cb.setReact(ctx, `*${companion.name} peeks back into view*`);
      ctx.ui.notify(`${companion.name} is back!`, "info");
      break;

    // ── Rename ────────────────────────────────────────────────────
    case "rename": {
      if (!rest) { ctx.ui.notify("Usage: /buddy rename <name>", "warning"); break; }
      const current = getStoredCompanion();
      if (!current) break;
      const name = rest.slice(0, 14).trim();
      if (!name) { ctx.ui.notify("Name can't be empty", "warning"); break; }
      putBuddy({ ...current, name });
      cb.bustCompanionCache();
      companion = (await cb.ensureCompanion(ctx))!;
      await cb.refresh(ctx);
      ctx.ui.notify(`Renamed to ${companion.name}`, "info");
      break;
    }

    // ── Personality (cheat-gated) ───────────────────────────────
    case "personality": {
      const pCfg = loadConfig();
      if (!pCfg.cheatMode) {
        ctx.ui.notify("That command requires cheat mode. Use /buddy cheat to enable.", "warning");
        break;
      }
      if (!rest) { ctx.ui.notify("Usage: /buddy personality <text>", "warning"); break; }
      const current = getStoredCompanion();
      if (!current) break;
      putBuddy({ ...current, personality: rest.slice(0, 400) });
      cb.bustCompanionCache();
      companion = (await cb.ensureCompanion(ctx))!;
      await cb.refresh(ctx);
      ctx.ui.notify(`Updated ${companion.name}'s personality`, "info");
      break;
    }

    // ── Model ─────────────────────────────────────────────────────
    case "model": {
      if (!rest) {
        // Show current model with resolved info
        const resolved = resolveBuddyModel(ctx);
        if (resolved) {
          const cfg = loadConfig();
          const source = cfg.commentModel ? "configured" : (ctx.model ? "session" : "cheapest");
          await showBuddyPanel(ctx, [
            "Buddy comment model",
            "",
            `  Resolved:  ${fmtModel(resolved)}`,
            `  Source:    ${source}`,
            `  Provider:  ${resolved.model.provider}`,
            `  Model:     ${resolved.model.name ?? resolved.modelId}`,
            `  Context:   ${resolved.model.contextWindow?.toLocaleString() ?? "?"} tokens`,
            `  Cost:      $${resolved.model.cost.input.toFixed(2)}/$${resolved.model.cost.output.toFixed(2)} per 1M tokens`,
            "",
            `  Provider:  ${cfg.commentProvider ?? "(auto)"}`,
            `  Pattern:   ${cfg.commentModel ?? "(auto)"}`,
            "",
            "  Available models:",
            ...allModels(ctx).slice(0, 15).map(m => `    ${m.provider}/${m.id}`),
            allModels(ctx).length > 15 ? `    \u2026 and ${allModels(ctx).length - 15} more` : "",
          ].join("\n"));
        } else {
          await showBuddyPanel(ctx, [
            "Buddy comment model",
            "",
            "  \u26A0 No model resolved.",
            "",
            "  Available models:",
            ...allModels(ctx).slice(0, 10).map(m => `    ${m.provider}/${m.id}`),
            allModels(ctx).length > 10 ? `    \u2026 and ${allModels(ctx).length - 10} more` : "",
          ].join("\n"));
        }
        break;
      }

      // Validate before saving
      const match = validateModelInput(ctx, rest);
      if (!match) {
        const available = allModels(ctx);
        ctx.ui.notify(
          `No model matched "${rest}". Available: ${available.slice(0, 5).map(m => m.provider + "/" + m.id).join(", ")}${available.length > 5 ? ", \u2026" : ""}`,
          "warning",
        );
        break;
      }

      // Save the resolved provider/id, not the raw input
      saveConfig({ commentProvider: match.provider, commentModel: match.modelId });
      invalidateModelCache();
      ctx.ui.notify(`Buddy model \u2192 ${fmtModel(match)}`, "info");
      break;
    }

    // ── Chance ────────────────────────────────────────────────────
    case "chance": {
      if (!rest) {
        const pct = Math.round(loadConfig().commentChance * 100);
        await showBuddyPanel(ctx, `Buddy comment chance: ${pct}% (${loadConfig().commentChance})`);
        break;
      }
      const v = Number(rest);
      if (Number.isNaN(v) || v < 0 || v > 1) {
        ctx.ui.notify("Chance must be a number between 0 and 1 (e.g. 0.35)", "warning");
        break;
      }
      saveConfig({ commentChance: v });
      ctx.ui.notify(`Comment chance \u2192 ${Math.round(v * 100)}%`, "info");
      break;
    }

    // ── Frequency / cooldown ──────────────────────────────────────
    case "frequency": {
      if (!rest) {
        await showBuddyPanel(ctx, `Buddy comment cooldown: ${loadConfig().commentCooldown}s`);
        break;
      }
      const secs = Number(rest);
      if (!Number.isInteger(secs) || secs < 0 || secs > 600) {
        ctx.ui.notify("Cooldown must be an integer 0\u2013600 seconds", "warning");
        break;
      }
      saveConfig({ commentCooldown: secs });
      ctx.ui.notify(`Comment cooldown \u2192 ${secs}s`, "info");
      break;
    }

    // ── Roll (new buddy, keep menagerie) ──────────────────────────
    case "roll": {
      const currentTreats = loadTreats();
      if (currentTreats < 50) {
        ctx.ui.notify(`Need 50 treats to roll (you have ${currentTreats})`, "warning");
        break;
      }
      spendTreats(50);
      const fresh = rollFresh();
      const resolved = resolveBuddyModel(ctx);
      const soul = resolved
        ? await generateSoul(resolved.model, fresh.bones).catch(() => undefined)
        : undefined;
      const newStored = {
        id: randomUUID(),
        name: soul?.name ?? "Buddy",
        personality: soul?.personality ?? generateFallbackPersonality(fresh.bones),
        hatchedAt: Date.now(),
        bonesSeed: fresh.seed,
      };
      putBuddy(newStored);
      setActiveBuddyId(newStored.id);
      cb.bustCompanionCache();
      bumpGlobalHatch();
      companion = (await cb.ensureCompanion(ctx))!;
      await cb.setReact(ctx, `*${companion.name} the ${companion.rarity} ${companion.species} hatches!*`);
      await showBuddyPanel(ctx, buddyDashboardText(companion), BUDDY_DASHBOARD_WIDTH);
      break;
    }

    // ── Species (cheat-gated) ────────────────────────────────────
    case "species": {
      const sCfg = loadConfig();
      if (!sCfg.cheatMode) {
        ctx.ui.notify("That command requires cheat mode. Use /buddy cheat to enable.", "warning");
        break;
      }
      if (!rest) {
        ctx.ui.notify(`Current species: ${companion.species}. Usage: /buddy species <name>`, "info");
        break;
      }
      const { SPECIES: speciesList } = await import("./types.ts");
      const match = speciesList.find(s => s.toLowerCase() === rest.toLowerCase());
      if (!match) {
        ctx.ui.notify(`Unknown species "${rest}". Available: ${speciesList.join(", ")}`, "warning");
        break;
      }
      const cfg = loadConfig();
      saveConfig({ ...cfg, speciesOverride: match });
      cb.bustCompanionCache();
      companion = (await cb.ensureCompanion(ctx))!;
      await cb.refresh(ctx);
      ctx.ui.notify(`Species changed to ${match}`, "info");
      await showBuddyPanel(ctx, buddyDashboardText(companion), BUDDY_DASHBOARD_WIDTH);
      break;
    }

    // ── Reset ─────────────────────────────────────────────────────
    case "reset": {
      const released = getStoredCompanion();
      if (released) {
        deleteBuddyStats(released.id);
        deleteBuddy(released.id);
      }
      setActiveBuddyId(undefined);
      saveConfig({ speciesOverride: undefined });
      cb.bustCompanionCache();
      es.setEditorCompanion(undefined);
      es.setEditorReaction(undefined);
      es.setReaction(undefined);
      es.setEditorPetting(false);
      ctx.ui.setWidget("pi-buddy", undefined);
      es.activeBuddyEditor?.invalidateBuddy();
      ctx.ui.notify("Companion released. Use /buddy to hatch a new one.", "info");
      return;
    }

    // ── Stats ─────────────────────────────────────────────────────
    case "stats": {
      await showBuddyPanel(ctx, buddyDashboardText(companion), BUDDY_DASHBOARD_WIDTH);
      break;
    }

    // ── Collection (interactive) ─────────────────────────────────
    case "collection": {
      const collEntries = buildCollectionEntries();
      const collActive = getActiveBuddyId();
      if (!ctx.hasUI) {
        // Fallback: static text
        const treats = loadTreats();
        const header = [
          `Treats: ${treats}`,
          `${collEntries.length} ${collEntries.length === 1 ? "buddy" : "buddies"} in collection`,
          "",
          renderRarityDistribution(collEntries),
          "",
        ];
        for (const e of collEntries) {
          const mark = e.id === collActive ? " \u2190 active" : "";
          header.push(`  ${e.companion.name}  ${formatBuddyListId(e.id)}${mark}`);
        }
        await showBuddyPanel(ctx, header.join("\n"));
        break;
      }
      await ctx.ui.custom(
        (_tui, theme, _kb, done) =>
          new CollectionView(collEntries, collActive, theme, {
            onSummon: async (id) => {
              setActiveBuddyId(id);
              cb.bustCompanionCache();
              const c = (await cb.ensureCompanion(ctx))!;
              done(undefined);
              await cb.setReact(ctx, `*${c.name} arrives*`);
              ctx.ui.notify(`Summoned ${c.name}`, "info");
            },
            onClose: () => done(undefined),
          }),
        { overlay: true },
      );
      break;
    }

    // ── Dismiss ───────────────────────────────────────────────────
    case "dismiss": {
      if (!rest.trim()) { ctx.ui.notify("Usage: /buddy dismiss <id>", "warning"); break; }
      const r = resolveBuddyIdPrefix(rest);
      if (r.ambiguous) {
        ctx.ui.notify("That id prefix matches more than one buddy. Use /buddy collection and a longer prefix.", "warning");
        break;
      }
      if (!r.id) {
        ctx.ui.notify(`No buddy matches "${rest.trim()}". Try /buddy collection.`, "warning");
        break;
      }
      if (r.id === getActiveBuddyId()) {
        ctx.ui.notify("Cannot dismiss the active buddy. Summon another first, then dismiss this one.", "warning");
        break;
      }
      const saved = listBuddies();
      const victim = saved.find(b => b.id === r.id);
      if (!victim) {
        ctx.ui.notify("Buddy not found.", "warning");
        break;
      }
      deleteBuddyStats(r.id);
      deleteBuddy(r.id);
      ctx.ui.notify(`Removed ${victim.companion.name} from the menagerie.`, "info");
      break;
    }

    // ── Release ───────────────────────────────────────────────────
    case "release": {
      if (!rest.trim()) { ctx.ui.notify("Usage: /buddy release <id>", "warning"); break; }
      const r = resolveBuddyIdPrefix(rest);
      if (r.ambiguous) {
        ctx.ui.notify("That id prefix matches more than one buddy. Use /buddy collection and a longer prefix.", "warning");
        break;
      }
      if (!r.id) {
        ctx.ui.notify(`No buddy matches "${rest.trim()}". Try /buddy collection.`, "warning");
        break;
      }
      if (r.id === getActiveBuddyId()) {
        ctx.ui.notify("Cannot release the active buddy. Summon another first, then release this one.", "warning");
        break;
      }
      const saved = listBuddies();
      const victim = saved.find(b => b.id === r.id);
      if (!victim) {
        ctx.ui.notify("Buddy not found.", "warning");
        break;
      }
      deleteBuddyStats(r.id);
      deleteBuddy(r.id);
      addTreats(25);
      ctx.ui.notify(`Released ${victim.companion.name} for 25 treats!`, "info");
      break;
    }

    // ── Unknown ───────────────────────────────────────────────────
    default:
      ctx.ui.notify(`Unknown /buddy command: ${cmd}. Try /buddy help`, "warning");
  }

  await cb.refresh(ctx);
}
