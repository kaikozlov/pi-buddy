# AGENTS.md

## Project Overview

pi-buddy is a pi extension — a Tamagotchi-style ASCII coding companion that lives in the terminal. It is loaded directly as TypeScript by the pi runtime (Bun). There is no build step; Bun runs `.ts` files natively.

## Development Commands

```bash
bun install          # Install dev dependencies
bunx tsc --noEmit    # Type-check only (no emit — project uses noEmit)
```

No build, test, or lint commands exist. There are no tests or CI.

## Architecture

**Entry point**: `index.ts` — the default export is a function receiving `ExtensionAPI`. It registers the `/buddy` slash command and event handlers (`session_start`, `message_end`, `tool_result`, `input`, `before_agent_start`, etc.).

**Key classes in index.ts**:
- `BuddyEditor extends CustomEditor` — renders the companion sprite alongside the input box
- `BuddyTextOverlay implements Component` — framed overlay panel for `/buddy show`, `/buddy help`, etc.
- `Mutex` — serializes concurrent LLM calls for buddy speech

**src/ modules**:
- `companion.ts` — deterministic companion generation (seeded `mulberry32` PRNG, species/rarity/stats/hat/eyes)
- `soul.ts` — LLM-powered name and personality generation with fallback to deterministic names
- `state.ts` — file-based persistence in `~/.pi/agent/pi-buddy/` with multi-version migration logic
- `sprites.ts` — 18 species × 3 animation frames of ASCII art + hat overlays
- `render.ts` — buddy card, 3-column dashboard, rarity distribution rendering
- `collection-view.ts` — interactive keyboard-navigable collection overlay (↑↓ browse, Enter summon)
- `buddy-footer.ts` — compact single-line buddy for narrow terminals
- `prompt.ts` — system prompt injection for the main agent + buddy-name detection regex
- `commands.ts` — /buddy slash command handler, autocomplete, subcommand definitions
- `commentary.ts` — commentary bucket system with rate limiting
- `speech.ts` — LLM speech, model resolution, speech dedup
- `reactions.ts` — tool-result detection, scripted reactions, pet reactions, error reactions
- `types.ts` — all TypeScript types and constants (species, rarities, eyes, hats)

**Key patterns**:
- Species names in `types.ts` use `String.fromCharCode()` obfuscation rather than string literals
- Rarity tiers (common/uncommon/rare/epic/legendary) determine stat floors and ANSI colors
- Model resolution for buddy speech uses a 4-step fallback chain: exact config → pattern match → session model → cheapest available
- State files (`config.json`, `stats.json`, `menagerie.json`) live in `~/.pi/agent/pi-buddy/`
- `species` and `personality` commands are gated behind `cheatMode` in config (no toggle command — edit config.json to enable)

## Pi Extension API Dependencies

All three pi packages are **peer dependencies** (provided by the host pi runtime):
- `@mariozechner/pi-ai` — `complete()`, `Model`, `Context`
- `@mariozechner/pi-coding-agent` — `ExtensionAPI`, `ExtensionContext`, `CustomEditor`, `Theme`
- `@mariozechner/pi-tui` — `Component`, `TUI`, `fuzzyFilter`, `truncateToWidth`

The extension is declared in `package.json` under the `"pi".extensions` field pointing to `./index.ts`.

## Conventions

- Imports use `.ts` extensions (e.g., `from "./src/types.ts"`)
- Terminal rendering uses raw ANSI escape sequences — no styling library
- All rendering is rarity-colored: common=gray, uncommon=green, rare=blue, epic=magenta, legendary=yellow
