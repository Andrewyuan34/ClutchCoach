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
window.__NBA_LIVE_VERIFY__.sampleTacticLessonMotion("motion")
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
postgame-panel
post-coach-recap
view-tabs
tab-feed
tab-box
command-panel
command-topbar
command-continue
command-briefing
command-stage
command-reason
command-risk
command-recent
command-staff
command-staff-problem
command-staff-reads
command-final-plan
command-final-offense
command-final-defense
command-final-subs
command-final-cost
command-mode-bar
command-mode-tactics
command-mode-lineup
command-tactics-body
command-lineup-body
command-lineup-recommendations
command-lineup-full
coach-help-toggle
coach-read-panel
coach-read-situation
coach-read-scheme-fit
coach-read-lineup-fit
coach-read-risk
coach-read-suggestion
box-score
pause-toggle
coach-intro-modal
coach-intro-start
coach-tutorial-modal
tactic-lesson-modal
tactic-lesson-title
tactic-lesson-intent
tactic-lesson-board
tactic-lesson-scrubber
tactic-lesson-time
tactic-lesson-autoplay
tactic-lesson-close
ai-verification-state
```

Generated live-feed rows use repeated `data-testid="feed-row"` and include machine-readable attributes:

```text
data-ai-team
data-ai-quarter
data-ai-clock
data-ai-score
data-ai-livecast-id
data-ai-possession-id
data-ai-context-id
data-ai-cause-ids
data-ai-coach-action-id
data-ai-adjustment-id
data-ai-adaptation-id
data-ai-command-session-id
data-ai-adopted-advice-id
data-ai-accepted-cost
data-ai-feedback-kind
data-ai-trace-source
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
- Every feed row has a livecast trace id.
- The command panel is not exposed as a persistent tab.
- The command panel is hidden during live play and visible only during the timeout/break command window.
- The command panel has a visible continue action while open.
- The compact command UI exposes a final plan summary.
- The default command UI keeps full tactics and full lineup collapsed unless the player expands them.
- Recommendations stay hidden during a command window unless assistant mode or `助教提示` is active.
- Coach staff reads expose the current problem, 1-2 visible assistant reads when help is active, and a cost for every visible read.
- If the player adopts a staff read, the final plan exposes the accepted cost before continuing.
- A committed command window writes one traceable `最终布置` livecast summary instead of replaying every draft click.
- A committed staff read carries `adoptedAdviceId`, `acceptedCost`, and follow-up feedback rows that can reference the accepted cost.
- The tactic lesson board exposes `motion` and `paint` as pure 5v5 animation systems.
- Each tactic lesson has exactly 10 rendered actors, 10 tracked actors, a `five-v-five-action-motion-v2` system id, 5 primary actors, 5 context actors, timeline duration, ball motion, active actions / zones, beat phase, action type list, cause tags, risk tags, and a cost path that overlaps its `watchFor` tags.
- When a tactic lesson modal is open, the rendered board must contain exactly 10 actor coordinates, side counts of 5 offense / 5 defense, a ball marker, and a scrubber synced to the timeline.
- If a committed tradeoff links to a tactic lesson, the committed `watchFor` tags overlap that lesson's `watchFor` tags.
- Tactical state exists once the verifier is initialized.
- Selected-team lineup profiles exist after a team/game is active.
- Required `data-testid` anchors are present.

## Tactic Lesson Timeline Snapshot

`getState().tacticLessons` exposes both authored data and rendered board state:

```text
available
openedLessonId
visible
currentLesson.system
currentLesson.playheadMs
currentLesson.durationMs
currentLesson.actorCount
currentLesson.pureAnimation
currentLesson.personnel
currentLesson.primaryPersonnel
currentLesson.primarySide
currentLesson.subject
currentLesson.movingActorCount
currentLesson.ballTransfers
currentLesson.actionCount
currentLesson.activeActions[]
currentLesson.actionTypes[]
currentLesson.beatPhase
currentLesson.causeTags[]
currentLesson.riskTags[]
currentLesson.costPath
currentLesson.board.sideCounts
currentLesson.board.primaryActorCount
currentLesson.board.contextActorCount
currentLesson.board.actors[]
currentLesson.board.ball
currentLesson.board.activeArrows
currentLesson.board.activeActions[]
currentLesson.board.activeActionTypes[]
currentLesson.board.activeZones
currentLesson.motionProbe
lessons[].timeline.system
lessons[].timeline.actionCount
lessons[].timeline.actionTypes
lessons[].timeline.beatPhases
lessons[].timeline.causeTags
lessons[].timeline.riskTags
lessons[].timeline.pureAnimation
lessons[].timeline.personnel
lessons[].timeline.primaryPersonnel
lessons[].timeline.primarySide
lessons[].timeline.sideCounts
lessons[].timeline.trackedActorCount
lessons[].timeline.maxActorTravel
```

`currentLesson.board.actors[]` contains `id`, `side`, `role`, `primary`, `x`, and `y`, read from the live DOM. `currentLesson.board.ball` contains the current holder or free-ball label plus position. This lets an agent drag `tactic-lesson-scrubber`, call `getState()` again, and prove the visible 5v5 board, ball, active actions, and beat phase moved together.

For data-only checks, call:

```js
window.__NBA_LIVE_VERIFY__.sampleTacticLessonMotion("paint", [0, 1500, 3250, 5400])
```

The sampler returns deterministic actor positions, ball holders, and `maxActorTravel` without needing to advance the match clock.

## Tactical Trace Snapshot

`getState().tactical` contains a compact AI-debug view:

```text
lastPossessionContext
lineupProfiles
activeAdjustmentWindows
resolvedAdjustmentWindows
lastCoachAction
opponentAdaptation
livecastTrace
debugEvents
```

This links coach actions, scheme changes, substitutions, clutch choices, opponent adaptations, and livecast rows through stable ids such as `coachActionId`, `adjustmentId`, `possessionId`, `contextId`, and `livecastId`.

`getState().commandUi` contains the compact command-center UI state:

```text
mode
compact
expanded.recent
expanded.offense
expanded.defense
expanded.lineup
continueVisible
finalPlan.offense
finalPlan.defense
finalPlan.subs
finalPlan.cost
visibleSchemeButtons
recommendations.schemeBadgesVisible
recommendations.summaryMentionsRecommendation
recommendations.lineupRecommendationVisible
lineup.confirmationVisible
lineup.confirmationText
lineup.applyVisible
layout.clientHeight
layout.scrollHeight
layout.firstScreenFits
fullLineupVisible
```

This lets an agent verify that the UI is visually compressed without losing the underlying decision data.

`getState().commandStaff` summarizes the currently visible or last committed staff briefing:

```text
primaryProblem
primaryProblemText
sourceLivecastIds
sourceContextIds
visibleReads
reads[].adviceId / role / cost / adopted / aligned
adoptedAdviceId
acceptedCost
finalCostText
```

`getState().command.commit` contains the post-command commit audit:

```text
hasLastCommitted
hasCommittedPlan
coachActionId
adjustmentId
livecastId
adoptedAdviceId
acceptedCost
acceptedCostText
watchFor
summaryText
summaryRows
commitRows
feedbackRows
feedbackKinds
feedbackReferencesAcceptedCost
summaryTracePresent
draftCount
draftSpamRows
draftSpamText
```

This lets an agent verify that timeout-window choices remain drafts, the resumed livecast contains only the final command summary, and that summary remains linked to `coachActionId`, `adjustmentId`, and `livecastId` for later debugging.

`getState().tacticLessons` contains the optional tactic-board learning layer:

```text
available
openedLessonId
visible
watched
currentLesson.id
currentLesson.system
currentLesson.pureAnimation
currentLesson.personnel
currentLesson.primaryPersonnel
currentLesson.primarySide
currentLesson.subject
currentLesson.actionCount
currentLesson.activeActions[]
currentLesson.actionTypes[]
currentLesson.beatPhase
currentLesson.playheadMs
currentLesson.durationMs
currentLesson.board.actorCount
currentLesson.board.sideCounts
currentLesson.board.primaryActorCount
currentLesson.board.contextActorCount
currentLesson.board.actors[]
currentLesson.board.ball
currentLesson.needs
currentLesson.risks
currentLesson.watchFor
lessons[].intent / risks / watchFor / timeline
```

This verifies that tactic learning stays optional: no live-play modal is required, and no tactic receives a numeric boost from being watched.

`getState().postgame.recap` contains the end-of-game coaching review:

```text
visible
count
items[].id
items[].coachActionId
items[].adjustmentId
items[].adoptedAdviceId
items[].acceptedCost
items[].lessonId
items[].result
items[].summaryLivecastId
items[].sourceLivecastIds
items[].sourceContextIds
items[].feedbackLivecastIds
lessonLinks
```

This verifies that the final recap is not a detached summary. Every visible recap row is tied back to the command session, accepted tradeoff, adjustment window, and either original or follow-up livecast evidence.

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
