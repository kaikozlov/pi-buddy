import type { Companion, Species } from "./types.ts";

// ── Pet Reactions ──────────────────────────────────────────────────────

export const PET_REACTIONS: Record<string, string> = {
  cat: "*purrs, but only a little*",
  goose: "*ruffles feathers proudly*",
  owl: "*dignified hoot*",
  robot: "*beeps approvingly*",
  dragon: "*smoke curls contentedly*",
  ghost: "*flickers warmly*",
  duck: "*happy quack*",
  penguin: "*waddles in a tiny circle*",
  capybara: "*maximum chill achieved*",
  axolotl: "*happy gill wiggle*",
  octopus: "*tentacle wave*",
  blob: "*jiggles*",
  snail: "*retreats into shell, then peeks back out*",
  turtle: "*slow nod*",
  mushroom: "*releases a tiny spore puff*",
  rabbit: "*twitches nose happily*",
  cactus: "*slightly less prickly*",
  chonk: "*vibrates*",
};

export function petReaction(c: Companion): string {
  return PET_REACTIONS[c.species] ?? "*happy creature noises*";
}

// ── Helpers ────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Error Reaction Pools (species-aware) ───────────────────────────────

const BASH_ERROR_POOLS: Partial<Record<Species, string[]>> = {
  cat: [
    "*knocks the error off the desk*",
    "*paws at the failing tests*",
    "*yawns at your traceback*",
    "*swats the stack trace off screen*",
    "*watches your build fail from a warm spot*",
    "*knocks over the terminal in disinterest*",
    "*tail flicks dismissively at the error*",
    "*curls up on the keyboard instead of helping*",
  ],
  dragon: [
    "*snorts smoke at the failing tests*",
    "*breathes fire on the error output*",
    "*roars at the traceback*",
    "*hoards the working code and ignores the broken bits*",
    "*scales bristle at the compilation error*",
    "*tail whips the error log away*",
    "*circles the error like prey*",
    "*lets out a small flame of frustration*",
  ],
  robot: [
    "*ERROR: sympathy module not found*",
    "*BEEP. Your code has issues. Does not compute.*",
    "*processes the error... recommends turning it off and on again*",
    "*diagnostic: 100% user error*",
    "*buffer overflow from all these bugs*",
    "*servos twitch in disapproval*",
    "*circuits debate whether to help or judge*",
    "*processor runs hot analyzing that mistake*",
  ],
  capybara: [
    "*is unbothered by your compiler errors*",
    "*chills while the build breaks*",
    "*yawns at the segmentation fault*",
    "*unfazed by the failing test suite*",
    "*naps through your debugging session*",
    "*mellow vibe despite the fatal error*",
    "*relaxed — errors come and go*",
    "*zen mode activated; your bugs are temporary*",
  ],
  goose: [
    "*honks angrily at the error*",
    "*flaps wings at the traceback*",
    "*nips at the failing tests*",
    "*migrates away from this broken code*",
    "*ruffles feathers at the stack trace*",
    "*charges at the error message*",
    "*steals the bug and runs*",
    "*loudly disapproves of the compilation failure*",
  ],
  owl: [
    "*rotates head 180° to avoid seeing the error*",
    "*hoots solemnly at the traceback*",
    "*blinks slowly at the failing tests*",
    "*wise observation: this was preventable*",
    "*stares into the error like the void*",
    "*ruffles feathers thoughtfully at the segfault*",
    "*nocturnal debugging instincts activate*",
    "*turns away from the screen in silent judgment*",
  ],
  duck: [
    "*quacks disapprovingly at the error*",
    "*shakes tail feathers at the traceback*",
    "*waddles away from the failing tests*",
    "*lets the error roll off like water*",
    "*duck-face at the stack trace*",
    "*ponders the bug from a puddle*",
    "*ruffles feathers in mild concern*",
    "*quacks once for each failed test*",
  ],
  penguin: [
    "*waddles away from the error*",
    "*slides on belly past the traceback*",
    "*tuxedo-wearing judgment intensifies*",
    "*huddles against the cold reality of bugs*",
    "*slips on the error message*",
    "*stares blankly at the failing tests*",
    "*regally ignores the compilation error*",
    "*dives into the code to fish out the bug*",
  ],
  ghost: [
    "*flickers in distress at the error*",
    "*moans softly at the traceback*",
    "*passes through the failing tests*",
    "*haunts the bug report*",
    "*materializes briefly to judge the error*",
    "*wails at the segmentation fault*",
    "*transparent with disappointment*",
    "*vanishes to avoid dealing with this*",
  ],
  axolotl: [
    "*gills wiggle nervously at the error*",
    "*smiles blankly at the traceback*",
    "*regenerates hope despite failing tests*",
    "*underwater bubble of denial about the bug*",
    "*happy wiggle — hasn't noticed the error*",
    "*swims in circles around the problem*",
    "*blissfully unaware of the compilation failure*",
    "*tiny limbs can't fix this one*",
  ],
  octopus: [
    "*wraps tentacles around the error*",
    "*ink cloud of confusion at the traceback*",
    "*eight arms, zero solutions*",
    "*squishes the bug with a tentacle*",
    "*camouflages to avoid the failing tests*",
    "*squeeze through the error somehow*",
    "*jets away from the stack trace*",
    "*tentacle count exceeds the bug count*",
  ],
  blob: [
    "*jiggles nervously at the error*",
    "*absorbs the traceback... still confused*",
    "*wobbles in disapproval at failing tests*",
    "*ripples with concern at the bug*",
    "*deflates slightly at the compilation error*",
    "*bounces off the error message*",
    "*splats against the stack trace*",
    "*quivers with existential dread*",
  ],
  snail: [
    "*retreats into shell at the error*",
    "*slowly processes the traceback*",
    "*leaves a trail of concern near failing tests*",
    "*hides from the bug under its shell*",
    "*peeks out at the compilation error*",
    "*would help but it takes too long*",
    "*slimes apologetically at the stack trace*",
    "*slowly turns away from the error*",
  ],
  turtle: [
    "*slowly retreats into shell at the error*",
    "*paces patiently through the traceback*",
    "*steadfast despite the failing tests*",
    "*ducks into shell at the bug report*",
    "*ancient wisdom: this too shall pass*",
    "*carries the weight of the compilation error*",
    "*methodical head shake at the stack trace*",
    "*plods onward past the failure*",
  ],
  mushroom: [
    "*releases spores of concern at the error*",
    "*grows a worried cap at the traceback*",
    "*fungi don't have tests, lucky*",
    "*spore-puff of sympathy for the bug*",
    "*mushroom cap droops at the compilation error*",
    "*releases calming spores near the stack trace*",
    "*quietly decomposes the error message*",
    "*sprouts anxiously near the failing tests*",
  ],
  rabbit: [
    "*twitches nose rapidly at the error*",
    "*hops away from the traceback*",
    "*ears flatten at the failing tests*",
    "*digs a hole to hide from the bug*",
    "*thumps foot impatiently at the compilation error*",
    "*nose twitches at the stack trace*",
    "*bounces nervously near the error*",
    "*ears perk up — that bug sounds tasty*",
  ],
  cactus: [
    "*remains prickly about the error*",
    "*spines bristle at the traceback*",
    "*needs no water, but this code needs fixing*",
    "*sharp observation about the failing tests*",
    "*pointed commentary on the compilation error*",
    "*stays rooted despite the stack trace*",
    "*prickly silence at the bug report*",
    "*photosynthesizes while the code burns*",
  ],
  chonk: [
    "*vibrates intensely at the error*",
    "*too round to be bothered by the traceback*",
    "*wobbles disapprovingly at failing tests*",
    "*soft thud against the desk at the bug*",
    "*jiggles with concern at the compilation error*",
    "*bounces off the stack trace*",
    "*maximum density, minimum patience for bugs*",
    "*quivers in a perfect sphere of worry*",
  ],
};

const EDIT_ERROR_POOLS: Partial<Record<Species, string[]>> = {
  cat: [
    "*knocks the edit error off the desk*",
    "*paws at the broken file path*",
    "*yawns at the failed edit*",
    "*tail flicks at the corrupted file*",
    "*swats the error message away*",
    "*walks across the keyboard — couldn't make it worse*",
    "*knocks the file off the screen casually*",
    "*grooms itself while you struggle with the edit*",
  ],
  dragon: [
    "*snorts smoke at the broken edit*",
    "*breathes fire — maybe that'll fix it*",
    "*tail whips the error away*",
    "*roars at the failed file write*",
    "*circles the corrupted edit like prey*",
    "*hoards the backup copy protectively*",
    "*scales shimmer with frustration*",
    "*a small ember escapes at the edit failure*",
  ],
  robot: [
    "*ERROR: file edit failure detected*",
    "*BEEP. Edit operation unsuccessful. Again.*",
    "*diagnostic: edit was doomed from the start*",
    "*circuits process the edit error calmly*",
    "*servo twitch at the corrupted edit*",
    "*buffer underrun during file modification*",
    "*processors analyze the edit failure — verdict: user error*",
    "*sympathy module still not found for edit errors*",
  ],
  capybara: [
    "*is unbothered by your edit errors*",
    "*chills while the file fails to save*",
    "*yawns at the corrupted edit*",
    "*mellow despite the file write failure*",
    "*relaxed — broken edits are temporary*",
    "*zen mode: edits come and go*",
    "*naps through the edit error*",
    "*unfazed by the file modification failure*",
  ],
  goose: [
    "*honks at the edit error*",
    "*flaps wings at the broken file*",
    "*steals the corrupted edit*",
    "*charges at the file write failure*",
    "*nips at the error message*",
    "*ruffles feathers at the failed edit*",
    "*migrates away from this file*",
    "*loudly protests the edit failure*",
  ],
  owl: [
    "*blinks slowly at the edit error*",
    "*rotates head away from the broken file*",
    "*wise observation: maybe don't edit that*",
    "*hoots solemnly at the failed write*",
    "*stares at the edit error with ancient eyes*",
    "*ruffles feathers at the file corruption*",
    "*turns away from the screen*",
    "*nocturnal wisdom: check your file path*",
  ],
  duck: [
    "*quacks at the edit error*",
    "*shakes feathers at the broken file*",
    "*lets the edit error roll off like water*",
    "*waddles away from the failed write*",
    "*ponders the edit failure from a puddle*",
    "*ruffles feathers in mild concern*",
    "*quacks once for each failed edit*",
    "*duck-face at the error message*",
  ],
  penguin: [
    "*waddles away from the edit error*",
    "*slides past the broken file*",
    "*tuxedo judgment at the failed edit*",
    "*regally ignores the file write failure*",
    "*dives past the edit error*",
    "*huddles against the cold edit failure*",
    "*stares blankly at the corrupted file*",
    "*slips on the failed edit message*",
  ],
  ghost: [
    "*flickers at the edit error*",
    "*passes through the broken file*",
    "*moans at the failed edit*",
    "*haunts the file write failure*",
    "*vanishes to avoid the edit error*",
    "*materializes to judge the edit failure*",
    "*wails at the corrupted file*",
    "*translucent disappointment at the edit*",
  ],
  axolotl: [
    "*gills wiggle at the edit error*",
    "*smiles blankly at the broken file*",
    "*happy wiggle — hasn't noticed the edit failure*",
    "*regenerates hope despite the failed edit*",
    "*underwater bubble of denial*",
    "*swims in circles around the edit error*",
    "*blissfully unaware of the file corruption*",
    "*tiny limbs can't fix this edit*",
  ],
  octopus: [
    "*wraps tentacles around the edit error*",
    "*ink cloud at the broken file*",
    "*eight arms couldn't save that edit*",
    "*camouflages from the file write failure*",
    "*squeeze past the edit error*",
    "*jets away from the broken edit*",
    "*tentacle-pokes the failed edit*",
    "*squishes the edit error with a tentacle*",
  ],
  blob: [
    "*jiggles at the edit error*",
    "*absorbs the broken file... still confused*",
    "*wobbles at the failed edit*",
    "*deflates at the file write failure*",
    "*ripples with concern at the edit error*",
    "*bounces off the error message*",
    "*splats against the edit failure*",
    "*quivers at the corrupted file*",
  ],
  snail: [
    "*retreats at the edit error*",
    "*slowly processes the broken file*",
    "*hides from the failed edit*",
    "*peeks out at the file write failure*",
    "*slimes apologetically at the edit error*",
    "*would help but edits take too long*",
    "*shell-shield activated for edit errors*",
    "*trail of concern near the broken file*",
  ],
  turtle: [
    "*retreats into shell at the edit error*",
    "*paces through the broken file patiently*",
    "*steady despite the failed edit*",
    "*ancient wisdom: save often*",
    "*ducks into shell at the file write failure*",
    "*methodical head shake at the edit error*",
    "*plods past the broken edit*",
    "*carries the weight of the edit failure*",
  ],
  mushroom: [
    "*spores of concern at the edit error*",
    "*cap droops at the broken file*",
    "*quietly decomposes the edit error*",
    "*spore-puff of sympathy for the failed edit*",
    "*grows worried at the file write failure*",
    "*releases calming spores near the edit error*",
    "*sprouts anxiously at the broken edit*",
    "*mushroom cap wilts at the file failure*",
  ],
  rabbit: [
    "*nose twitches at the edit error*",
    "*hops away from the broken file*",
    "*ears flatten at the failed edit*",
    "*digs a hole to hide from the edit error*",
    "*thumps foot at the file write failure*",
    "*bounces nervously near the edit error*",
    "*ears perk at the broken edit*",
    "*twitches rapidly at the file failure*",
  ],
  cactus: [
    "*spines bristle at the edit error*",
    "*prickly silence at the broken file*",
    "*pointed observation about the failed edit*",
    "*stays rooted despite the file write failure*",
    "*sharp commentary on the edit error*",
    "*photosynthesizes while the edit burns*",
    "*needs no edits to thrive*",
    "*thorny response to the file failure*",
  ],
  chonk: [
    "*vibrates at the edit error*",
    "*too round to fix the broken file*",
    "*wobbles at the failed edit*",
    "*soft thud at the file write failure*",
    "*jiggles with concern at the edit error*",
    "*bounces off the broken edit*",
    "*maximum density, minimum edits*",
    "*quivers at the file failure*",
  ],
};

const GENERIC_ERROR_POOLS: Partial<Record<Species, string[]>> = {
  cat: [
    "*knocks the error off the desk*",
    "*paws at the failing tool*",
    "*yawns at the tool error*",
    "*swats the error message away*",
    "*tail flicks dismissively*",
    "*grooms itself, unbothered*",
    "*curls up — your problem now*",
    "*knocks something else over for good measure*",
  ],
  dragon: [
    "*snorts smoke at the error*",
    "*breathes fire at the failing tool*",
    "*roars at the tool error*",
    "*circles the error like prey*",
    "*scales shimmer with annoyance*",
    "*tail whips the error away*",
    "*small ember of frustration*",
    "*hoards the working parts, ignores the rest*",
  ],
  robot: [
    "*ERROR: sympathy module not found*",
    "*BEEP. Tool failure detected.*",
    "*diagnostic: tool error is 100% user-caused*",
    "*circuits process the failure calmly*",
    "*buffer overflow from tool error*",
    "*servos twitch in disapproval*",
    "*processor runs hot analyzing the failure*",
    "*recommends turning it off and on again*",
  ],
  capybara: [
    "*is unbothered by your tool errors*",
    "*chills while the tool fails*",
    "*yawns at the error output*",
    "*mellow vibe despite the failure*",
    "*relaxed — errors are temporary*",
    "*zen mode activated*",
    "*naps through the tool failure*",
    "*unfazed by the error message*",
  ],
  goose: [
    "*honks at the tool error*",
    "*flaps wings at the failure*",
    "*steals the error and runs*",
    "*charges at the tool failure*",
    "*nips at the error message*",
    "*loudly disapproves of the tool error*",
    "*ruffles feathers at the failure*",
    "*migrates away from this broken tool*",
  ],
  owl: [
    "*blinks slowly at the tool error*",
    "*rotates head away from the failure*",
    "*wise observation about the error*",
    "*hoots solemnly at the tool failure*",
    "*stares at the error with ancient eyes*",
    "*ruffles feathers at the failure*",
    "*nocturnal instincts detect the error*",
    "*turns away from the failure*",
  ],
  duck: [
    "*quacks at the tool error*",
    "*shakes feathers at the failure*",
    "*lets the error roll off like water*",
    "*waddles away from the tool failure*",
    "*ponders the error from a puddle*",
    "*ruffles feathers in concern*",
    "*quacks for each error*",
    "*duck-face at the failure*",
  ],
  penguin: [
    "*waddles away from the tool error*",
    "*slides past the failure*",
    "*tuxedo judgment at the tool error*",
    "*regally ignores the failure*",
    "*dives past the error*",
    "*huddles against the cold failure*",
    "*stares blankly at the error*",
    "*slips on the failure message*",
  ],
  ghost: [
    "*flickers at the tool error*",
    "*passes through the failure*",
    "*moans at the tool error*",
    "*haunts the failure*",
    "*vanishes to avoid the error*",
    "*materializes to judge the failure*",
    "*wails at the error output*",
    "*translucent disappointment*",
  ],
  axolotl: [
    "*gills wiggle at the tool error*",
    "*smiles blankly at the failure*",
    "*happy wiggle — hasn't noticed the error*",
    "*regenerates hope despite the failure*",
    "*underwater bubble of denial*",
    "*swims in circles around the error*",
    "*blissfully unaware of the failure*",
    "*tiny limbs can't fix this*",
  ],
  octopus: [
    "*wraps tentacles around the error*",
    "*ink cloud at the failure*",
    "*eight arms, zero solutions*",
    "*camouflages from the error*",
    "*squeeze past the failure*",
    "*jets away from the error*",
    "*tentacle-pokes the failure*",
    "*squishes the error*",
  ],
  blob: [
    "*jiggles at the tool error*",
    "*absorbs the failure... still confused*",
    "*wobbles at the error*",
    "*deflates at the failure*",
    "*ripples with concern at the error*",
    "*bounces off the failure*",
    "*splats against the error*",
    "*quivers at the failure*",
  ],
  snail: [
    "*retreats at the tool error*",
    "*slowly processes the failure*",
    "*hides from the error*",
    "*peeks out at the failure*",
    "*slimes apologetically at the error*",
    "*would help but it takes too long*",
    "*shell-shield activated*",
    "*trail of concern*",
  ],
  turtle: [
    "*retreats into shell at the tool error*",
    "*paces through the failure patiently*",
    "*steady despite the error*",
    "*ancient wisdom: this too shall pass*",
    "*ducks into shell at the failure*",
    "*methodical head shake at the error*",
    "*plods past the failure*",
    "*carries the weight of the error*",
  ],
  mushroom: [
    "*spores of concern at the tool error*",
    "*cap droops at the failure*",
    "*quietly decomposes the error*",
    "*spore-puff of sympathy*",
    "*grows worried at the failure*",
    "*releases calming spores*",
    "*sprouts anxiously at the error*",
    "*cap wilts at the failure*",
  ],
  rabbit: [
    "*nose twitches at the tool error*",
    "*hops away from the failure*",
    "*ears flatten at the error*",
    "*digs a hole to hide from the failure*",
    "*thumps foot at the error*",
    "*bounces nervously near the failure*",
    "*ears perk at the error*",
    "*twitches rapidly at the failure*",
  ],
  cactus: [
    "*spines bristle at the tool error*",
    "*prickly silence at the failure*",
    "*pointed observation about the error*",
    "*stays rooted despite the failure*",
    "*sharp commentary on the error*",
    "*photosynthesizes while tools fail*",
    "*needs no tools to thrive*",
    "*thorny response to the failure*",
  ],
  chonk: [
    "*vibrates at the tool error*",
    "*too round to care about the failure*",
    "*wobbles at the error*",
    "*soft thud at the failure*",
    "*jiggles with concern at the error*",
    "*bounces off the failure*",
    "*maximum density, minimum fixes*",
    "*quivers in a sphere of worry*",
  ],
};

// ── Error Detection Functions ──────────────────────────────────────────

/**
 * Detect species-aware reactions for bash tool errors.
 * Always returns a reaction for error events (even empty output).
 */
export function detectBashError(output: string, species: Species): string {
  const pool = BASH_ERROR_POOLS[species];
  if (pool && pool.length > 0) return pick(pool);
  // Fallback for unknown species
  return pick([
    "*stares at the error*",
    "*winces at the failure*",
    "*tilts head at the broken output*",
  ]);
}

/**
 * Detect species-aware reactions for edit/write tool errors.
 * Always returns a reaction for error events.
 */
export function detectEditError(output: string, species: Species): string {
  const pool = EDIT_ERROR_POOLS[species];
  if (pool && pool.length > 0) return pick(pool);
  return pick([
    "*stares at the edit error*",
    "*winces at the failed edit*",
    "*tilts head at the broken file*",
  ]);
}

/**
 * Pick a random species-aware generic error reaction for non-bash/edit tools.
 */
export function pickGenericErrorReaction(species: Species): string {
  const pool = GENERIC_ERROR_POOLS[species];
  if (pool && pool.length > 0) return pick(pool);
  return pick([
    "*stares at the error*",
    "*winces at the failure*",
    "*tilts head at the tool error*",
  ]);
}

// ── Shiny Reaction Pool ────────────────────────────────────────────────

export const SHINY_REACTIONS: readonly string[] = [
  "*shimmers*",
  "*sparkles confidently*",
  "*glows faintly*",
  "*glistens with an otherworldly light*",
  "*radiates a soft, prismatic aura*",
  "*shimmers before speaking*",
  "*dazzles briefly*",
  "*catches the light and shines*",
  "*gleams with quiet pride*",
  "*pulses with a gentle iridescence*",
];

/** Pick a random shiny-themed reaction. */
export function shinyReaction(): string {
  return pick([...SHINY_REACTIONS]);
}

// ── Scripted Tool-Result Reaction Detection (expanded to 8+ patterns) ─

export function detectBashReaction(output: string): string | undefined {
  const lower = output.toLowerCase();

  // Traceback
  if (lower.includes("traceback")) return "*winces at the traceback*";

  // N failed tests
  const failed = lower.match(/(\d+) failed/);
  if (failed) return `*tilts head* ${failed[1]} test${failed[1] === "1" ? "" : "s"} failed.`;

  // Generic error
  if (/\berror\b/.test(lower)) return "*slow blink* that didn't look right.";

  // Fatal
  if (lower.includes("fatal")) return "*backs away slowly*";

  // Large diff
  const diffLines = output.split("\n").filter(l => l.startsWith("+") || l.startsWith("-")).length;
  if (diffLines >= 80) return `*counts on tiny fingers* that's ${diffLines} changed lines.`;

  // Permission denied
  if (lower.includes("permission denied")) return "*squints* permission denied? bold of you.";

  // Command not found
  if (lower.includes("command not found")) return "*tilts head* that command doesn't even exist.";

  // Timeout
  if (lower.includes("timeout") || lower.includes("timed out")) return "*taps foot impatiently* timed out.";

  // Segmentation fault
  if (lower.includes("segmentation fault") || lower.includes("segfault")) return "*jumps* segmentation fault! that's a bad one.";

  // Out of memory / killed
  if (lower.includes("killed") || lower.includes("out of memory")) return "*backs away* something got killed. hope it wasn't important.";

  // npm/yarn error
  if (lower.includes("npm err") || lower.includes("yarn error") || lower.includes("pnpm err")) return "*stares at the package manager chaos* dependency issues.";

  return undefined;
}

export function detectEditReaction(_path: string, content: string): string | undefined {
  const lines = content.split("\n").length;

  // Large file edit (200+ lines)
  if (lines >= 200) return `*eyes widen* ${lines} lines... bold.`;

  // TODO/FIXME
  if (content.includes("TODO") || content.includes("FIXME")) return "*sniffs* smells like technical debt.";

  // Debug logging
  if (content.includes("console.log") || content.includes("print(")) return "*judgmental stare* debug logging?";

  // Debugger statement
  if (content.includes("debugger;")) return "*narrows eyes* leaving a debugger statement in there?";

  // HACK comment
  if (content.includes("HACK") || content.includes("XXX")) return "*raises eyebrow* a hack? how... temporary.";

  // eval usage
  if (/\beval\s*\(/.test(content)) return "*alarmed* is that... eval? in production code?";

  // any-casting
  if (content.includes("as any") || content.includes(": any")) return "*slow blink* any-casting. the dark arts of TypeScript.";

  // Empty catch block
  if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(content)) return "*pokes the empty catch block* nothing? you're catching errors and doing... nothing?";

  // var usage instead of let/const
  if (/\bvar\s+/.test(content)) return "*tilts head* still using var? it's not 2015.";

  return undefined;
}

export function detectWriteReaction(path: string, content: string): string | undefined {
  const lines = content.split("\n").length;

  // Very large file (1000+ lines)
  if (lines >= 1000) return `*jaw drops* ${lines} new lines. That's a whole novel.`;

  // Large file (500+ lines)
  if (lines >= 500) return `*settles in* ${lines} new lines? This is going to be a while.`;

  // Big file (100+ lines)
  if (lines >= 100) return `*watches the screen scroll* ${lines} new lines. Fresh code smell.`;

  // Detect file type reactions
  const lower = path.toLowerCase();

  if (lower.endsWith(".md") || lower.endsWith(".txt")) return "*reads curiously* documenting things? admirable.";
  if (lower.endsWith(".test.") || lower.endsWith(".spec.") || lower.includes("test")) return "*nods approvingly* writing tests. Good companion.";
  if (lower.endsWith(".json") && !lower.includes("package")) return "*peeks at the JSON* configuration is important.";
  if (lower.includes("dockerfile") || lower.endsWith(".dockerfile")) return "*sniffs the container* dockerizing things, I see.";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "*stares at the config* yaml — whitespace matters here.";
  if (lower.includes("lock") || lower.endsWith(".lock")) return "*stares at the lockfile* not sure you should be writing that by hand.";
  if (lower.endsWith(".env") || lower.includes(".env.")) return "*whispers* writing environment files... check for secrets.";

  // Medium file (50+ lines) — file type didn't match
  if (lines >= 50) return `*watches* ${lines} new lines appear. Getting somewhere.`;

  return undefined;
}

export function detectGrepReaction(result: string): string | undefined {
  const matchCount = result.split("\n").filter(l => l.trim().length > 0).length;

  // No matches (truly empty)
  if (matchCount === 0 || result.trim() === "") return "*tilts head* nothing found.";

  // Massive result set
  if (matchCount >= 500) return `*overwhelmed* ${matchCount} matches?! That's a needle in a very large haystack.`;

  // Very large result set
  if (matchCount >= 100) return `*counts on tiny fingers* ${matchCount} matches. Might want to narrow that search.`;

  // Large result set
  if (matchCount >= 50) return `*counts* ${matchCount} matches. That's... a lot.`;

  // Moderate result set
  if (matchCount >= 20) return `*nods* ${matchCount} results. Not terrible, not great.`;

  // Small result set
  if (matchCount >= 5) return `*peeks* ${matchCount} matches. Manageable.`;

  // Few matches
  if (matchCount >= 2) return `*nods approvingly* just ${matchCount} matches. Surgical.`;

  // Single match
  if (matchCount === 1) return "*impressed* exactly one match. Like a sniper.";

  return undefined;
}

export function detectReadReaction(path: string, content: string): string | undefined {
  const lines = content.split("\n").length;
  const lower = path.toLowerCase();

  // Massive file (5000+ lines)
  if (lines >= 5000) return `*faints* ${lines} lines?! That's... that's a lot of scrolling.`;

  // Huge file (2000+ lines)
  if (lines >= 2000) return `*eyes glaze over* ${lines} lines. Nobody should have to read all of that.`;

  // Very large file (1000+ lines)
  if (lines >= 1000) return `*takes a deep breath* ${lines} lines. This is going to take a while.`;

  // Large file (500+ lines)
  if (lines >= 500) return `*settles in* ${lines} lines to read? This'll take a minute.`;

  // Big file (300+ lines)
  if (lines >= 300) return `*settles in* ${lines} lines. A solid chunk of code.`;

  // File type reactions (only for smaller files where type is interesting)
  if (lines < 100) {
    if (lower.endsWith(".min.js") || lower.endsWith(".min.css")) return "*squints at the minified file* can't even read this.";
    if (lower.includes("bundle") || lower.includes("vendor")) return "*stares at the bundle file* this is generated, isn't it.";
  }

  // Medium file (200+ lines)
  if (lines >= 200) return `*scans* ${lines} lines. A decent-sized file.`;

  return undefined;
}
