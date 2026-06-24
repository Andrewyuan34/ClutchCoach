# Architecture

## Entry Point

`live.html` is intentionally thin. It owns only the HTML structure for the live simulator and loads:

- `src/styles/live.css`
- `src/live-sim.mjs` as an ES module

There is no `index.html` app path anymore. Use `/live.html` as the product entry.

## Module Boundaries

`src/live-sim.mjs`

- Orchestrates app startup, game flow, coach tutorial, decisions, command entry/exit, and playback timers.
- Imports all data, state, and shared helpers instead of relying on script-tag globals.
- This file is still the main behavior hub, but feature code should move into `src/features/` when it has a clear boundary.
- It should call feature modules instead of owning their full DOM/rendering implementation.

`src/features/tactic-board.mjs`

- Owns the tactic lesson board learning layer: lesson lookup, modal open/close, autoplay, scrubber seeking, 5v5 action-motion rendering, beat markers, and board-level AI DOM attributes.
- Reads declarative lessons from `src/data/tactical-data.mjs` and shared state from `src/state.mjs`.
- Keeps tactic-board UI behavior out of `src/live-sim.mjs`; live-sim should only call `initTacticBoardFeature`, `lessonForScheme`, `lessonIdForAdvice`, and `openTacticLesson`.
- Preserve the `five-v-five-action-motion-v2` snapshot fields when changing this module.

`src/features/command-center.mjs`

- Owns the pause/quarter-break command center domain layer: command UI state, command sessions, assistant staff reads, accepted costs, watch-for labels, final plan commits, command feedback text, and postgame command recap helpers.
- Reads shared state from `src/state.mjs` and tactic lessons from `src/data/tactical-data.mjs`; it accepts small callbacks from `live-sim.mjs` for cross-feature effects such as rendering, scheme drafts, livecast rows, lineup diffs, and coach-effect staging.
- Keeps staff recommendation rules and final-plan trace construction out of `src/live-sim.mjs`. live-sim should orchestrate command entry/exit and render remaining tightly coupled lineup/scheme controls.
- Preserve the command AI contract when changing this module: recommendation visibility, accepted cost, watch-for tags, final-plan trace ids, and feedback rows must remain traceable.

`src/features/livecast.mjs`

- Owns the text livecast rendering surface: `pushFeed`, feed-row DOM creation, stable `data-ai-*` trace attributes, scroll trimming, `fmtClock`, prior-series flavor insertion, and home-crowd flavor lines.
- Calls `registerLivecastTrace` from `src/tactical.mjs` so every rendered feed row can be traced back to possession, command, coach action, adjustment, or feedback metadata.
- Keeps row-level DOM and trace attributes out of `src/live-sim.mjs`; live-sim should generate event text and call `pushFeed` / `richFeed` / `homeCrowdText`.
- Preserve `data-testid="feed-row"` and the `dataset.ai*` fields when changing this module.

`src/features/postgame-recap.mjs`

- Owns the postgame coach recap feature: selecting command sessions, scoring which decisions matter, building recap items, rendering recap cards, trace `data-ai-*` attributes, and linking recap cards back to tactic lessons.
- Reads command summaries from `src/features/command-center.mjs` and opens lessons through `src/features/tactic-board.mjs`.
- Keeps postgame recap card construction out of `src/live-sim.mjs`; live-sim should decide when the postgame panel appears and call `renderPostCoachRecap`.
- Preserve `data-testid="post-recap-item"`, `data-testid="post-recap-lesson"`, `S.postgameRecap`, and recap trace ids when changing this module.

`src/state.mjs`

- Owns mutable singleton state `S`.
- Owns core simulation constants such as quarter length, home-court mapping, stat keys, and clutch modifiers.
- Keep DOM references and rendering functions out of this file.

`src/utils.mjs`

- Small dependency-free helpers.
- Keep this file generic. Feature-specific helpers should live near their feature module.

`src/ai-verify.mjs`

- Owns the AI-native verification contract.
- Exposes deterministic seed support, DOM/JSON snapshots, built-in assertions, and test-id query helpers.
- Includes a compact tactical trace snapshot so agents can connect coach actions, possessions, livecast rows, and adjustment outcomes.
- Exports `AI_VERIFY_CONTRACT`, which is consumed by `tools/check-ai-contract.mjs` and should be updated whenever the stable verification surface changes.
- This is the only public AI verification entry. Feature-specific snapshot helpers live in `src/ai/` and are imported here.
- Keep this module player-invisible: it should not add visible UI or change normal gameplay unless a seed URL parameter is provided.

`src/ai/dom-utils.mjs`

- Shared browser snapshot helpers such as cloning, visibility checks, and percent parsing.
- Keep this file small and DOM-oriented; game rules and feature semantics belong in feature-specific AI helpers.

`src/ai/command-signals.mjs`

- Owns command-center snapshot helpers for recommendation visibility, staff reads, lineup confirmation, panel metrics, committed plan traces, accepted costs, and draft-spam detection.
- Update this with `src/features/command-center.mjs` when changing command UI trace fields.

`src/ai/tactic-lesson-signals.mjs`

- Owns tactic-board snapshot helpers for lesson metadata, 5v5 actor counts, board DOM coordinates, active actions, beat phases, ball samples, and `sampleTacticLessonMotion()`.
- Update this with `src/features/tactic-board.mjs` and `src/data/tactical-data.mjs` when changing the action-motion grammar.

`src/ai/postgame-signals.mjs`

- Owns postgame recap snapshot helpers for recap card visibility, trace ids, lesson links, accepted costs, and evidence livecast ids.
- Update this with `src/features/postgame-recap.mjs` when changing recap DOM or trace fields.

`src/tactical.mjs`

- Owns the tactical cause layer for possessions, substitutions, scheme changes, timeout decisions, clutch choices, opponent adaptation, livecast tracing, and AI-debug events.
- Produces stable ids for `coachActionId`, `adjustmentId`, `possessionId`, `contextId`, and `livecastId`.
- Keep this module mostly pure state/analysis logic. DOM rendering should stay in `src/live-sim.mjs`; declarative balancing data should stay in `src/data/tactical-data.mjs`.

`src/data/commentary-data.mjs`

- Roster ratings, rotation targets, team tactics, shot flavor, officiating flavor, home-court flavor, and scheme matchup data.
- It should stay declarative: no DOM work, timers, or mutation of `S`.

`src/data/series-pbp-data.mjs`

- Compact extract of prior play-by-play data plus atmosphere snippets.
- This is large by design. If startup size becomes a problem, split this into JSON and lazy-load it after the first screen renders.

`src/data/tactical-data.mjs`

- Declarative player tactical traits, scheme fit requirements, tactic lessons, cause templates, and opponent adaptation rules.
- Update this when adding teams, players, schemes, new tactic-board lessons, or new traceable tactical causes.

`src/styles/live.css`

- All live page styling.
- Keep layout and responsive rules here rather than inline in `live.html`.

`tools/check-ai-contract.mjs`

- Dependency-free Node smoke check for the AI verification contract.
- Reads `AI_VERIFY_CONTRACT`, verifies required test ids, docs, browser global wiring, runtime generated id patterns, and optionally a served URL.
- Its JSON output is intentionally machine-readable for AI agents and CI.

`tools/player-smoke.mjs`

- Browser-driven player-path smoke check for evidence gathering.
- Starts a temporary static server, opens `live.html?ai_verify=1&seed=...`, walks through select team, start game, timeout command panel, assistant help, tactic board playback/scrub, resume play, and assertion summary.
- Writes screenshots plus `player-smoke.json` under `snapshots/player-smoke/`, which is ignored by git.
- Use this when local manual evidence matters; keep `tools/check-ai-contract.mjs` as the faster static/URL contract gate.

## Maintenance Notes

- Preserve `live.html` as a static-server entry. ES module imports require serving files over HTTP.
- Follow `docs/ai-readable-structure-refactor-plan.md` for structure work. Current pattern is to extract one feature module at a time, keep player behavior unchanged, and update AI verification in the same patch.
- Prefer extracting feature modules with stable boundaries. Good next candidates are coach tutorial, substitutions, box score rendering, clutch decisions, and any remaining tightly coupled command-control UI pieces.
- Avoid reintroducing script-tag globals. New modules should use `import` / `export`.
- Preserve the AI verification contract when refactoring UI or state names. Update `docs/ai-verification.md` when stable test ids or snapshot fields change.
- When moving verifier internals, keep `src/ai-verify.mjs` as the public entry and move only feature-specific helper logic into `src/ai/`.
- Keep `pbp_g1.json` through `pbp_g4.json` as raw audit data unless the data-generation workflow is replaced.
