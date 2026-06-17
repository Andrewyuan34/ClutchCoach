# Architecture

## Entry Point

`live.html` is intentionally thin. It owns only the HTML structure for the live simulator and loads:

- `src/styles/live.css`
- `src/live-sim.mjs` as an ES module

There is no `index.html` app path anymore. Use `/live.html` as the product entry.

## Module Boundaries

`src/live-sim.mjs`

- Orchestrates app startup, game flow, coach tutorial, decisions, rendering, and playback timers.
- Imports all data, state, and shared helpers instead of relying on script-tag globals.
- This file is still the main behavior hub; future refactors should split by feature area without changing gameplay in the same patch.

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
- Keep this module player-invisible: it should not add visible UI or change normal gameplay unless a seed URL parameter is provided.

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

- Declarative player tactical traits, scheme fit requirements, cause templates, and opponent adaptation rules.
- Update this when adding teams, players, schemes, or new traceable tactical causes.

`src/styles/live.css`

- All live page styling.
- Keep layout and responsive rules here rather than inline in `live.html`.

`tools/check-ai-contract.mjs`

- Dependency-free Node smoke check for the AI verification contract.
- Reads `AI_VERIFY_CONTRACT`, verifies required test ids, docs, browser global wiring, runtime generated id patterns, and optionally a served URL.
- Its JSON output is intentionally machine-readable for AI agents and CI.

## Maintenance Notes

- Preserve `live.html` as a static-server entry. ES module imports require serving files over HTTP.
- Prefer extracting pure data/config first, then feature modules. Good next candidates are coach tutorial, substitutions, box score rendering, and clutch decisions.
- Avoid reintroducing script-tag globals. New modules should use `import` / `export`.
- Preserve the AI verification contract when refactoring UI or state names. Update `docs/ai-verification.md` when stable test ids or snapshot fields change.
- Keep `pbp_g1.json` through `pbp_g4.json` as raw audit data unless the data-generation workflow is replaced.
