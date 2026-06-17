# AI Native Verification

The game exposes a stable verification surface for AI agents and automated checks. The player UI is unchanged; all verification data is available through DOM attributes, a JSON state node, and a browser global.

## URL Options

Use a deterministic seed when a reproducible run is needed:

```text
/live.html?ai_verify=1&seed=demo-001
```

`seed` or `ai_seed` replaces `Math.random` with a deterministic generator before gameplay starts. Without a seed, the simulator uses native browser randomness.

## Browser Global

After `DOMContentLoaded`, the page exposes:

```js
window.__NBA_LIVE_VERIFY__
```

Useful calls:

```js
window.__NBA_LIVE_VERIFY__.getState()
window.__NBA_LIVE_VERIFY__.getAssertions()
window.__NBA_LIVE_VERIFY__.getAssertSummary()
window.__NBA_LIVE_VERIFY__.getContract()
window.__NBA_LIVE_VERIFY__.queryByTestId("score-knicks")
window.__NBA_LIVE_VERIFY__.clickByTestId("pick-team-knicks")
```

`getState()` returns a fresh snapshot; it does not rely on a stale cache.
`getContract()` returns the protocol version, global name, JSON node id, required test ids, and generated test-id patterns.

## JSON State Node

The latest synchronized snapshot is also written to:

```html
<script id="ai-verification-state" type="application/json">
```

This is useful for tools that can read DOM but cannot execute page JavaScript.

## Stable DOM Contract

Key controls and readouts have stable `data-testid` values:

```text
app-root
screen-select
team-card-knicks
team-card-spurs
pick-team-knicks
pick-team-spurs
screen-series
start-game
screen-game
score-knicks
score-spurs
game-quarter
game-clock
game-status
game-feed
tab-feed
tab-command
tab-box
command-panel
box-score
pause-toggle
coach-intro-modal
coach-intro-start
coach-tutorial-modal
ai-verification-state
```

Generated live-feed rows use repeated `data-testid="feed-row"` and include machine-readable attributes:

```text
data-ai-team
data-ai-quarter
data-ai-clock
data-ai-score
```

Generated command buttons use stable ids such as:

```text
scheme-off-motion
scheme-def-zone
player-court-brunson
player-bench-mcbride
```

## Built-In Assertions

`getAssertions()` currently checks:

- Root app is present.
- Exactly one screen is active.
- DOM score matches simulator state.
- Feed row count stays within the pruning limit.
- Required `data-testid` anchors are present.

`getAssertSummary()` returns `{ pass, total, failed }` for quick CI-style checks.

## Command-Line Contract Check

Agents can validate the static verification contract without opening a browser:

```powershell
node tools/check-ai-contract.mjs
```

When the local server is running, include the served URL as an extra check:

```powershell
node tools/check-ai-contract.mjs --url='http://127.0.0.1:8000/live.html?ai_verify=1&seed=demo-001'
```

The command prints a JSON report with `pass`, `failed`, and per-check details. It exits non-zero when any required contract piece is missing.
