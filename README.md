# pi-buddy

A collectible gacha companion extension for [pi](https://github.com/mariozechner/pi). Hatch buddies, earn treats from coding, roll for new ones, and build your collection. Each buddy is unique: species, rarity, stats, personality, name.

**The loop: code → earn treats → roll → collect → repeat.**

## Install

```bash
pi install git:github.com/kaikozlov/pi-buddy
```

Or clone and install locally:

```bash
pi install /path/to/pi-buddy
```

## Quick Start

Your first buddy hatches automatically when you start a session. Start coding to earn treats, then spend them to roll new buddies.

- `/buddy` — Show companion card with sprite, stats, and treats
- `/buddy pet` — Pet your companion (+1 treat)
- `/buddy roll` — Hatch a new buddy (costs 50 treats, first one is free)
- `/buddy collection` — Browse all buddies interactively (↑↓ navigate, Enter to summon)
- `/buddy help` — Full command list

## Treats

Earn treats from coding events:

| Event | Treats |
|-------|--------|
| Session start | 5 |
| Tool error reaction | 2 |
| Scripted reaction | 1 |
| LLM observation | 2 |
| Petting | 1 |

Roll a new buddy for 50 treats. Release duplicates for 25 treats. Shiny buddies earn 2× treats.

## Commands

### Core

| Command | Description |
|---------|-------------|
| `/buddy` / `/buddy show` | Card + stats + treats (3-column dashboard) |
| `/buddy pet` | Pet your companion |
| `/buddy stats` | Same as `/buddy show` |
| `/buddy help` | Full command list |

### Collection

| Command | Description |
|---------|-------------|
| `/buddy roll` | Hatch a new buddy (50 treats) |
| `/buddy collection` | Browse all buddies — ↑↓ navigate, Enter to summon |
| `/buddy summon [id]` | Switch active buddy (omit for random) |
| `/buddy release <id>` | Release a buddy for 25 treats (not the active one) |
| `/buddy dismiss <id>` | Remove a buddy (no treat refund) |
| `/buddy reset` | Delete active companion and start fresh |

### Customization

| Command | Description |
|---------|-------------|
| `/buddy rename <name>` | Rename companion (1–14 chars) |
| `/buddy off` / `/buddy on` | Mute/unmute reactions |
| `/buddy model` | Show which model generates buddy comments |
| `/buddy model <provider/id>` | Set model for comments |
| `/buddy chance` | Show comment probability |
| `/buddy chance 0.35` | Set probability (0–1) |
| `/buddy frequency` | Show comment cooldown |
| `/buddy frequency 60` | Set cooldown in seconds (0–600) |

### Hidden Commands

Some commands that bypass the gacha system (`personality`, `species`) are hidden by default. They're only available when `cheatMode` is enabled — which you can do by editing `~/.pi/agent/pi-buddy/config.json` yourself. No toggle command here. If you want to cheat, commit to it.

## Rarity

5 tiers with weighted drop rates:

| Rarity | Drop Rate | Stat Floor |
|--------|-----------|------------|
| Common ★ | 60% | 5 |
| Uncommon ★★ | 25% | 15 |
| Rare ★★★ | 10% | 25 |
| Epic ★★★★ | 4% | 35 |
| Legendary ★★★★★ | 1% | 50 |

Each buddy has 5 stats: DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK. High/low stats influence personality and commentary frequency.

## Species

18 species: Duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk.

Each species has unique ASCII art (3 animation frames), species-themed reactions, and pet responses. Shiny variants (1% chance) have sparkle effects and earn 2× treats.

## Project Structure

```
index.ts                Extension entry point — event handlers, companion lifecycle
├── src/commands.ts     /buddy slash command handler, autocomplete, subcommand definitions
├── src/editor.ts       BuddyEditor, BuddyTextOverlay, sprite rendering
├── src/reactions.ts    Tool-result detection, error reactions, pet reactions
├── src/speech.ts       LLM speech, model resolution, speech dedup
├── src/commentary.ts   Commentary bucket system with rate limiting
├── src/state.ts        File-based persistence, treats economy, menagerie CRUD
├── src/companion.ts    Deterministic companion generation (seeded PRNG)
├── src/soul.ts         LLM-powered name/personality generation
├── src/sprites.ts      18 species × 3 frames ASCII art + hat overlays
├── src/collection-view.ts Interactive keyboard-navigable collection overlay
├── src/render.ts       Buddy card, dashboard, rarity distribution rendering
├── src/buddy-footer.ts Compact single-line buddy for narrow terminals
├── src/prompt.ts       System prompt injection, direct-address detection
└── src/types.ts        TypeScript types and constants
```

## Development

```bash
bun install          # Install dev dependencies
bunx tsc --noEmit    # Type-check (no build step — Bun runs .ts natively)
```

## Configuration

State is stored in `~/.pi/agent/pi-buddy/` (respects `PI_CODING_AGENT_DIR`):
- `config.json` — Active buddy, model, chance, cooldown, species override, cheat mode
- `stats.json` — Global stats (hatches, treats) + per-buddy counters
- `menagerie.json` — All collected buddies

## License

MIT
