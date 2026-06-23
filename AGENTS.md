# Agent Quickstart

This project is a static ES module game. The only product entry is `live.html`.

For full onboarding, read:

```text
docs/newcomer-ai-agent-human-guide.md
```

## Run Locally

From the repository root:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:8000/live.html
```

Use this deterministic verification URL when testing:

```text
http://127.0.0.1:8000/live.html?ai_verify=1&seed=demo-001
```

Do not use `index.html`; it has intentionally been removed as an app entry.

## Verify

```powershell
node --check src/live-sim.mjs
node --check src/features/tactic-board.mjs
node --check src/features/command-center.mjs
node --check src/features/livecast.mjs
node --check src/features/postgame-recap.mjs
node --check src/ai-verify.mjs
node --check src/ai/dom-utils.mjs
node --check src/ai/command-signals.mjs
node --check src/ai/tactic-lesson-signals.mjs
node --check src/ai/postgame-signals.mjs
node --check src/tactical.mjs
node --check src/state.mjs
node --check src/utils.mjs
node --check src/data/commentary-data.mjs
node --check src/data/series-pbp-data.mjs
node --check src/data/tactical-data.mjs
node --check tools/check-ai-contract.mjs
node tools/check-ai-contract.mjs --url='http://127.0.0.1:8000/live.html?ai_verify=1&seed=demo-001'
```

## Player-Visible Smoke Test

1. Open `live.html`.
2. Pick a team and start the game.
3. Enter the command panel.
4. Confirm recommendations are hidden by default.
5. Click `助教提示` and confirm recommendations appear.
6. Call timeout, click multiple schemes, resume.
7. Confirm only the final offense/defense schemes are committed to livecast and tactical trace.
8. Open `看战术板`, click `播放跑位`, and confirm actor/ball coordinates change in `window.__NBA_LIVE_VERIFY__.getState().tacticLessons.currentLesson.board`.

## Important Files

```text
src/live-sim.mjs             game flow, UI actions, livecast
src/features/tactic-board.mjs tactic lesson modal, 5v5 action board, autoplay/scrubber
src/features/command-center.mjs command sessions, staff reads, accepted costs, final plan traces
src/features/livecast.mjs    feed rows, trace DOM attributes, rich/home-crowd livecast helpers
src/features/postgame-recap.mjs postgame command recap cards and tactic lesson links
src/ai/*.mjs                 feature-scoped snapshot helpers for the public AI verifier
src/tactical.mjs             tactical cause layer and trace ids
src/data/tactical-data.mjs   tactical resources
src/ai-verify.mjs            browser verification snapshot
tools/check-ai-contract.mjs  contract smoke check
docs/ai-readable-structure-refactor-plan.md structure refactor execution plan
```
