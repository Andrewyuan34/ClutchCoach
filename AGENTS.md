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
node --check src/ai-verify.mjs
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

## Important Files

```text
src/live-sim.mjs             game flow, UI actions, livecast
src/tactical.mjs             tactical cause layer and trace ids
src/data/tactical-data.mjs   tactical resources
src/ai-verify.mjs            browser verification snapshot
tools/check-ai-contract.mjs  contract smoke check
```
