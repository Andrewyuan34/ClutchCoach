import { ROSTERS } from "./data/commentary-data.mjs?v=action-motion-33";
import { S } from "./state.mjs?v=action-motion-33";
import { compactTacticalState } from "./tactical.mjs?v=action-motion-33";
import {
  commandCommitSignals,
  commandLineupSignals,
  commandPanelMetrics,
  commandRecommendationSignals,
  commandStaffSignals,
} from "./ai/command-signals.mjs?v=action-motion-33";
import { postgameRecapSignals } from "./ai/postgame-signals.mjs?v=action-motion-33";
import { sampleTacticLessonMotion, tacticLessonSignals } from "./ai/tactic-lesson-signals.mjs?v=action-motion-33";

export const AI_VERIFY_CONTRACT = Object.freeze({
  protocol: "nba-live-ai-verification",
  version: "1.0.0",
  globalName: "__NBA_LIVE_VERIFY__",
  stateScriptId: "ai-verification-state",
  entryTestId: "app-root",
  requiredTestIds: Object.freeze([
    "app-root",
    "screen-select",
    "team-card-knicks",
    "team-card-spurs",
    "pick-team-knicks",
    "pick-team-spurs",
    "screen-series",
    "start-game",
    "screen-game",
    "score-knicks",
    "score-spurs",
    "game-clock",
    "game-feed",
    "postgame-panel",
    "post-coach-recap",
    "view-tabs",
    "tab-feed",
    "tab-box",
    "command-panel",
    "command-topbar",
    "command-continue",
    "command-briefing",
    "command-stage",
    "command-reason",
    "command-risk",
    "command-recent",
    "command-staff",
    "command-staff-problem",
    "command-staff-reads",
    "command-final-plan",
    "command-final-offense",
    "command-final-defense",
    "command-final-subs",
    "command-final-cost",
    "command-mode-bar",
    "command-mode-tactics",
    "command-mode-lineup",
    "command-tactics-body",
    "command-lineup-body",
    "command-lineup-recommendations",
    "command-lineup-full",
    "coach-help-toggle",
    "coach-read-panel",
    "coach-read-situation",
    "coach-read-scheme-fit",
    "coach-read-lineup-fit",
    "coach-read-risk",
    "coach-read-suggestion",
    "coach-intro-modal",
    "coach-intro-start",
    "coach-tutorial-modal",
    "tactic-lesson-modal",
    "tactic-lesson-title",
    "tactic-lesson-intent",
    "tactic-lesson-board",
    "tactic-lesson-scrubber",
    "tactic-lesson-time",
    "tactic-lesson-autoplay",
    "tactic-lesson-close",
    "ai-verification-state",
  ]),
  generatedTestIds: Object.freeze([
    "feed-row",
    "scheme-{kind}-{key}",
    "lesson-open-{lessonId}",
    "post-recap-item",
    "post-recap-lesson",
    "player-court-{playerId}",
    "player-bench-{playerId}",
  ]),
});

const VERIFY_VERSION = AI_VERIFY_CONTRACT.version;
const STATE_SCRIPT_ID = AI_VERIFY_CONTRACT.stateScriptId;
const GLOBAL_NAME = AI_VERIFY_CONTRACT.globalName;

let randomInfo = { mode: "native", seed: null };
let lastEvent = "bootstrap";
let syncCount = 0;

export function installAiDeterminism() {
  if (typeof window === "undefined") return randomInfo;

  const params = new URLSearchParams(window.location.search);
  const seed = params.get("seed") || params.get("ai_seed");
  if (!seed) return randomInfo;

  const seeded = makeSeededRandom(seed);
  Math.random = seeded;
  randomInfo = { mode: "seeded", seed };
  return randomInfo;
}

export function initAiVerification() {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  ensureStateScript();
  window[GLOBAL_NAME] = {
    version: VERIFY_VERSION,
    getContract: () => clone(AI_VERIFY_CONTRACT),
    getState: () => buildSnapshot(),
    getAssertions: () => buildAssertions(),
    getAssertSummary: () => summarizeAssertions(buildAssertions()),
    sync: (eventName = "manual") => syncAiVerification(eventName),
    sampleTacticLessonMotion: (lessonId, sampleMs = null) => sampleTacticLessonMotion(lessonId, sampleMs),
    queryByTestId: (testId) => document.querySelector(`[data-testid="${cssEscape(testId)}"]`),
    clickByTestId: (testId) => {
      const el = document.querySelector(`[data-testid="${cssEscape(testId)}"]`);
      if (!el) return false;
      el.click();
      syncAiVerification(`click:${testId}`);
      return true;
    },
  };

  document.documentElement.dataset.aiVerify = "ready";
  syncAiVerification("init");
}

export function syncAiVerification(eventName = "sync") {
  if (typeof document === "undefined") return null;

  lastEvent = eventName;
  syncCount += 1;
  const snapshot = buildSnapshot();
  const stateScript = ensureStateScript();
  stateScript.textContent = JSON.stringify(snapshot);

  document.documentElement.dataset.aiVerify = "ready";
  document.body.dataset.aiScreen = snapshot.screen.active || "";
  document.body.dataset.aiView = snapshot.game.view || "";
  document.body.dataset.aiPhase = snapshot.game.phase || "";
  document.body.dataset.aiScore = `${snapshot.game.score.knicks}-${snapshot.game.score.spurs}`;
  document.body.dataset.aiRunning = String(snapshot.game.running);
  document.body.dataset.aiTutorial = String(snapshot.tutorial.open);

  return snapshot;
}

function buildSnapshot() {
  const activeScreen = document.querySelector(".screen.active");
  const activeScreens = [...document.querySelectorAll(".screen.active")].map((el) => el.id);
  const feedRows = [...document.querySelectorAll("#feed .feed-row")];
  const tracedFeedRows = feedRows.filter((el) => !!el.dataset.aiLivecastId);
  const lastFeed = feedRows.length ? feedRows[feedRows.length - 1] : null;
  const tactical = compactTacticalState();
  const visibleModals = [...document.querySelectorAll(".coach-modal")]
    .filter((el) => isVisible(el) && !el.classList.contains("hidden"))
    .map((el) => el.id);

  return {
    protocol: AI_VERIFY_CONTRACT.protocol,
    version: VERIFY_VERSION,
    updatedAt: new Date().toISOString(),
    lastEvent,
    syncCount,
    random: randomInfo,
    screen: {
      active: activeScreen ? activeScreen.id.replace(/^screen-/, "") : "",
      activeId: activeScreen ? activeScreen.id : "",
      activeScreens,
    },
    game: {
      selectedTeam: S.myTeam,
      opponentTeam: S.oppTeam,
      gameNo: S.gameNo,
      seriesWins: { ...S.seriesWins },
      score: { ...S.score },
      quarter: S.quarter,
      clock: S.clock,
      clockText: formatClock(S.clock),
      possessionTeam: S.possessionTeam,
      running: !!S.running,
      gameOver: !!S.gameOver,
      view: S.view,
      phase: S.phase || (S.subWindow ? "command" : "live"),
      subWindow: !!S.subWindow,
      timeouts: { ...S.timeouts },
      scheme: clone(S.scheme),
      momentum: { ...S.momentum },
    },
    tutorial: {
      open: !!S.tutorialOpen,
      assistantMode: !!S.assistantMode,
      step: S.assistantStep || "",
      targetId: S.assistantTarget ? JSON.stringify(S.assistantTarget) : "",
      modalVisible: visibleModals.includes("coach-tutorial-modal"),
    },
    coach: {
      introOpen: !!S.coachIntroOpen,
      task: S.coachTask ? { name: S.coachTask.name, desc: S.coachTask.desc } : null,
      prompt: S.coachPrompt ? { type: S.coachPrompt.type, text: S.coachPrompt.text, focus: S.coachPrompt.focus } : null,
      crisisPending: !!S.crisisPending,
      helpOpen: !!(S.coachHelpOpen || S.assistantMode),
    },
    command: {
      active: !!S.subWindow,
      visible: isVisible(document.getElementById("cmd-wrap")) && !document.getElementById("cmd-wrap")?.classList.contains("hidden"),
      sessionId: S.commandSession?.id || "",
      reason: S.commandSession?.reason || "",
      reasonText: S.commandSession?.reasonText || "",
      by: S.commandSession?.by || "",
      sourceContextIds: clone(S.commandSession?.sourceContextIds || []),
      recentFeed: clone(S.commandSession?.recentFeed || []),
      committed: !!S.commandSession?.committed,
      lastCommitted: S.lastCommandSession ? clone(S.lastCommandSession) : null,
      commit: commandCommitSignals(feedRows),
    },
    postgame: {
      panelVisible: isVisible(document.getElementById("postgame-panel")) && !document.getElementById("postgame-panel")?.classList.contains("hidden"),
      recap: postgameRecapSignals(),
    },
    commandStaff: commandStaffSignals(),
    tacticLessons: tacticLessonSignals(),
    commandUi: {
      mode: S.commandUi?.mode || "",
      compact: !(S.commandUi?.expandedOffense || S.commandUi?.expandedDefense || S.commandUi?.expandedLineup || S.commandUi?.expandedRecent),
      expanded: {
        recent: !!S.commandUi?.expandedRecent,
        offense: !!S.commandUi?.expandedOffense,
        defense: !!S.commandUi?.expandedDefense,
        lineup: !!S.commandUi?.expandedLineup,
      },
      continueVisible: isVisible(document.getElementById("command-continue")),
      finalPlan: {
        offense: document.getElementById("command-final-offense")?.innerText.trim() || "",
        defense: document.getElementById("command-final-defense")?.innerText.trim() || "",
        subs: document.getElementById("command-final-subs")?.innerText.trim() || "",
        cost: document.getElementById("command-final-cost")?.innerText.trim() || "",
      },
      visibleSchemeButtons: [...document.querySelectorAll("#my-off .sch-btn, #my-def .sch-btn")]
        .filter(isVisible)
        .map((el) => el.dataset.aiSchemeKey || el.id || ""),
      recommendations: commandRecommendationSignals(),
      lineup: commandLineupSignals(),
      layout: commandPanelMetrics(),
      fullLineupVisible: isVisible(document.getElementById("command-lineup-full")) && !document.getElementById("command-lineup-full")?.classList.contains("hidden"),
    },
    dom: {
      title: document.title,
      url: location.href,
      visibleModals,
      feedRows: feedRows.length,
      tracedFeedRows: tracedFeedRows.length,
      lastFeedText: lastFeed ? lastFeed.innerText.trim() : "",
      lastFeedTrace: lastFeed ? {
        livecastId: lastFeed.dataset.aiLivecastId || "",
        possessionId: lastFeed.dataset.aiPossessionId || "",
        contextId: lastFeed.dataset.aiContextId || "",
        causeIds: lastFeed.dataset.aiCauseIds || "",
        coachActionId: lastFeed.dataset.aiCoachActionId || "",
        adjustmentId: lastFeed.dataset.aiAdjustmentId || "",
        adaptationId: lastFeed.dataset.aiAdaptationId || "",
        commandSessionId: lastFeed.dataset.aiCommandSessionId || "",
        adoptedAdviceId: lastFeed.dataset.aiAdoptedAdviceId || "",
        acceptedCost: lastFeed.dataset.aiAcceptedCost || "",
        lessonId: lastFeed.dataset.aiLessonId || "",
        feedbackKind: lastFeed.dataset.aiFeedbackKind || "",
        source: lastFeed.dataset.aiTraceSource || "",
      } : null,
      requiredTestIds: requiredTestIds().reduce((acc, id) => {
        acc[id] = !!document.querySelector(`[data-testid="${cssEscape(id)}"]`);
        return acc;
      }, {}),
    },
    tactical,
    rosters: rosterSnapshot(),
    assertions: summarizeAssertions(buildAssertions()),
  };
}

function buildAssertions() {
  const scoreDom = {
    knicks: numberText("sb-knicks"),
    spurs: numberText("sb-spurs"),
  };
  const activeScreens = document.querySelectorAll(".screen.active").length;
  const missingTestIds = requiredTestIds().filter((id) => !document.querySelector(`[data-testid="${cssEscape(id)}"]`));
  const feedRowEls = [...document.querySelectorAll("#feed .feed-row")];
  const feedRows = feedRowEls.length;
  const tracedFeedRows = feedRowEls.filter((el) => !!el.dataset.aiLivecastId).length;
  const tactical = compactTacticalState();
  const selectedTeam = S.myTeam;
  const selectedProfile = selectedTeam ? tactical.lineupProfiles?.[selectedTeam] : null;
  const commandPanel = document.querySelector('[data-testid="command-panel"]');
  const commandVisible = !!commandPanel && isVisible(commandPanel) && !commandPanel.classList.contains("hidden");
  const commandTab = document.querySelector('[data-testid="tab-command"]');
  const continueVisible = isVisible(document.getElementById("command-continue"));
  const hintsOpen = !!(S.coachHelpOpen || S.assistantMode);
  const recSignals = commandRecommendationSignals();
  const commitSignals = commandCommitSignals(feedRowEls);
  const staffSignals = commandStaffSignals();
  const lessonSignals = tacticLessonSignals();
  const postgameSignals = postgameRecapSignals();
  const hasCommittedTradeoff = (S.commandHistory || []).some((session) => !!session?.committedPlan?.acceptedCost);
  const finalPlanText = [
    document.getElementById("command-final-offense")?.innerText.trim() || "",
    document.getElementById("command-final-defense")?.innerText.trim() || "",
    document.getElementById("command-final-subs")?.innerText.trim() || "",
    document.getElementById("command-final-cost")?.innerText.trim() || "",
  ].join(" ");
  const visibleSchemeButtons = [...document.querySelectorAll("#my-off .sch-btn, #my-def .sch-btn")].filter(isVisible).length;
  const fullLineupVisible = isVisible(document.getElementById("command-lineup-full")) && !document.getElementById("command-lineup-full")?.classList.contains("hidden");

  return [
    {
      id: "app.root.present",
      pass: !!document.querySelector('[data-testid="app-root"]'),
      details: "Root app container is queryable by data-testid.",
    },
    {
      id: "screen.active.exactly_one",
      pass: activeScreens === 1,
      details: `Active screen count: ${activeScreens}.`,
    },
    {
      id: "score.dom_matches_state",
      pass: scoreDom.knicks === S.score.knicks && scoreDom.spurs === S.score.spurs,
      details: `DOM ${scoreDom.knicks}-${scoreDom.spurs}, state ${S.score.knicks}-${S.score.spurs}.`,
    },
    {
      id: "feed.row_limit",
      pass: feedRows <= 60,
      details: `Feed rows: ${feedRows}.`,
    },
    {
      id: "livecast.trace.dom_present",
      pass: feedRows === 0 || tracedFeedRows === feedRows,
      details: `Traced feed rows: ${tracedFeedRows}/${feedRows}.`,
    },
    {
      id: "tactical.state.present",
      pass: !!S.tactical,
      details: "Tactical cause/trace state is initialized.",
    },
    {
      id: "tactical.lineup_profiles.present",
      pass: !selectedTeam || !!(selectedProfile && selectedProfile.playerIds && selectedProfile.playerIds.length),
      details: selectedTeam ? `Selected ${selectedTeam} profile present: ${!!selectedProfile}.` : "No selected team yet.",
    },
    {
      id: "live.no_command_tab",
      pass: !commandTab,
      details: commandTab ? "Command tab is still present." : "Command is no longer exposed as a persistent tab.",
    },
    {
      id: "command.hidden_during_live",
      pass: !!S.subWindow || !commandVisible,
      details: `subWindow=${!!S.subWindow}, commandVisible=${commandVisible}.`,
    },
    {
      id: "command.visible_only_during_window",
      pass: !commandVisible || !!S.subWindow,
      details: `commandVisible=${commandVisible}, subWindow=${!!S.subWindow}.`,
    },
    {
      id: "command.phase_matches_window",
      pass: (S.phase || (S.subWindow ? "command" : "live")) === (S.subWindow ? "command" : "live") || !!S.gameOver,
      details: `phase=${S.phase || ""}, subWindow=${!!S.subWindow}.`,
    },
    {
      id: "command.first_screen_has_continue",
      pass: !commandVisible || continueVisible,
      details: `commandVisible=${commandVisible}, continueVisible=${continueVisible}.`,
    },
    {
      id: "command.final_plan.present",
      pass: !commandVisible || (finalPlanText.includes("进攻") && finalPlanText.includes("防守")),
      details: finalPlanText || "Final plan text missing.",
    },
    {
      id: "command.compact_by_default",
      pass: !commandVisible || !!S.commandUi?.expandedOffense || !!S.commandUi?.expandedDefense || visibleSchemeButtons <= 8,
      details: `visibleSchemeButtons=${visibleSchemeButtons}, expandedOffense=${!!S.commandUi?.expandedOffense}, expandedDefense=${!!S.commandUi?.expandedDefense}.`,
    },
    {
      id: "command.full_lineup_collapsed_by_default",
      pass: !commandVisible || !!S.commandUi?.expandedLineup || !fullLineupVisible,
      details: `expandedLineup=${!!S.commandUi?.expandedLineup}, fullLineupVisible=${fullLineupVisible}.`,
    },
    {
      id: "command.recommendations_hidden_without_help",
      pass: !commandVisible || hintsOpen || (
        recSignals.schemeBadgesVisible === 0 &&
        !recSignals.summaryMentionsRecommendation &&
        !recSignals.lineupRecommendationVisible
      ),
      details: `hintsOpen=${hintsOpen}, schemeBadgesVisible=${recSignals.schemeBadgesVisible}, summaryMentionsRecommendation=${recSignals.summaryMentionsRecommendation}, lineupRecommendationVisible=${recSignals.lineupRecommendationVisible}.`,
    },
    {
      id: "staff.primary_problem.traceable",
      pass: !commandVisible || !S.commandSession || staffSignals.sourceLivecastIds.length > 0 || staffSignals.sourceContextIds.length > 0 || (S.commandSession.recentFeed || []).length > 0,
      details: `problem=${staffSignals.primaryProblem || "none"}, livecastSources=${staffSignals.sourceLivecastIds.length}, contextSources=${staffSignals.sourceContextIds.length}.`,
    },
    {
      id: "staff.visible_reads.count_between_1_and_2",
      pass: !commandVisible || !hintsOpen || (staffSignals.visibleReads >= 1 && staffSignals.visibleReads <= 2),
      details: `hintsOpen=${hintsOpen}, visibleReads=${staffSignals.visibleReads}.`,
    },
    {
      id: "staff.visible_reads.each_has_cost",
      pass: !commandVisible || !hintsOpen || staffSignals.reads.every((read) => !!read.cost),
      details: `costs=${staffSignals.reads.map((read) => read.cost || "missing").join(",") || "none"}.`,
    },
    {
      id: "command.final_plan.accepted_cost_visible",
      pass: !commandVisible || !staffSignals.adoptedAdviceId || (staffSignals.finalCostText && !staffSignals.finalCostText.includes("待拍板")),
      details: `adoptedAdviceId=${staffSignals.adoptedAdviceId || "none"}, finalCost=${staffSignals.finalCostText || "none"}.`,
    },
    {
      id: "command.commit_summary.single",
      pass: !commitSignals.hasCommittedPlan || commitSignals.summaryRows === 1,
      details: `hasCommittedPlan=${commitSignals.hasCommittedPlan}, summaryRows=${commitSignals.summaryRows}.`,
    },
    {
      id: "command.commit_summary.traceable",
      pass: !commitSignals.hasCommittedPlan || commitSignals.summaryTracePresent,
      details: `coachActionId=${commitSignals.coachActionId || "none"}, summaryTracePresent=${commitSignals.summaryTracePresent}.`,
    },
    {
      id: "command.commit_summary.no_draft_spam",
      pass: !commitSignals.hasCommittedPlan || commitSignals.draftSpamRows === 0,
      details: `draftSpamRows=${commitSignals.draftSpamRows}, draftCount=${commitSignals.draftCount}.`,
    },
    {
      id: "command.commit.accepted_cost.present",
      pass: !commitSignals.hasCommittedPlan || !commitSignals.adoptedAdviceId || !!commitSignals.acceptedCost,
      details: `adoptedAdviceId=${commitSignals.adoptedAdviceId || "none"}, acceptedCost=${commitSignals.acceptedCost || "none"}.`,
    },
    {
      id: "command.feedback.references_accepted_cost",
      pass: !commitSignals.hasCommittedPlan || !commitSignals.acceptedCost || commitSignals.feedbackRows === 0 || commitSignals.feedbackReferencesAcceptedCost,
      details: `acceptedCost=${commitSignals.acceptedCost || "none"}, feedbackRows=${commitSignals.feedbackRows}, references=${commitSignals.feedbackReferencesAcceptedCost}.`,
    },
    {
      id: "command.feedback.explain_rows_lte_two",
      pass: !commitSignals.hasCommittedPlan || !commitSignals.acceptedCost || commitSignals.feedbackRows <= 2,
      details: `acceptedCost=${commitSignals.acceptedCost || "none"}, feedbackRows=${commitSignals.feedbackRows}.`,
    },
    {
      id: "lesson.available.mvp_two",
      pass: lessonSignals.available.includes("motion") && lessonSignals.available.includes("paint"),
      details: `available=${lessonSignals.available.join(",")}.`,
    },
    {
      id: "lesson.every_scheme_has_intent",
      pass: lessonSignals.lessons.every((lesson) => !!lesson.intent),
      details: `missing=${lessonSignals.lessons.filter((lesson) => !lesson.intent).map((lesson) => lesson.lessonId).join(",") || "none"}.`,
    },
    {
      id: "lesson.every_scheme_has_risks",
      pass: lessonSignals.lessons.every((lesson) => lesson.risks.length > 0),
      details: `missing=${lessonSignals.lessons.filter((lesson) => !lesson.risks.length).map((lesson) => lesson.lessonId).join(",") || "none"}.`,
    },
    {
      id: "lesson.timeline.present",
      pass: lessonSignals.lessons.every((lesson) => lesson.timeline.durationMs > 0 && lesson.timeline.actorCount === 10),
      details: lessonSignals.lessons.map((lesson) => `${lesson.lessonId}:${lesson.timeline.durationMs}ms/${lesson.timeline.actorCount}actors`).join(","),
    },
    {
      id: "lesson.timeline.five_v_five_system",
      pass: lessonSignals.lessons.every((lesson) => lesson.timeline.system === "five-v-five-action-motion-v2" && lesson.timeline.pureAnimation && lesson.timeline.personnel === 10 && lesson.timeline.primaryPersonnel === 5 && lesson.timeline.trackedActorCount === 10),
      details: lessonSignals.lessons.map((lesson) => `${lesson.lessonId}:system=${lesson.timeline.system}/pure=${lesson.timeline.pureAnimation}/personnel=${lesson.timeline.personnel}/primary=${lesson.timeline.primaryPersonnel}/tracks=${lesson.timeline.trackedActorCount}`).join(","),
    },
    {
      id: "lesson.timeline.action_grammar",
      pass: lessonSignals.lessons.every((lesson) => lesson.timeline.actionCount >= 8 && lesson.timeline.actionTypes.includes("pass") && lesson.timeline.actionTypes.some((type) => ["dribble", "cut", "roll", "handoff"].includes(type)) && lesson.timeline.actionTypes.some((type) => ["help", "recover", "closeout", "stunt"].includes(type))),
      details: lessonSignals.lessons.map((lesson) => `${lesson.lessonId}:actions=${lesson.timeline.actionCount}/types=${lesson.timeline.actionTypes.join("|")}`).join(","),
    },
    {
      id: "lesson.timeline.beat_causality",
      pass: lessonSignals.lessons.every((lesson) => ["problem", "trigger", "solution", "reaction", "cost"].every((phase) => lesson.timeline.beatPhases.includes(phase)) && lesson.timeline.beatsWithActions === lesson.frameCount && lesson.timeline.riskTags.every((tag) => lesson.watchFor.includes(tag))),
      details: lessonSignals.lessons.map((lesson) => `${lesson.lessonId}:phases=${lesson.timeline.beatPhases.join("|")}/beatsWithActions=${lesson.timeline.beatsWithActions}/${lesson.frameCount}/risks=${lesson.timeline.riskTags.join("|")}`).join(","),
    },
    {
      id: "lesson.timeline.side_counts",
      pass: lessonSignals.lessons.every((lesson) => lesson.timeline.sideCounts.offense === 5 && lesson.timeline.sideCounts.defense === 5 && lesson.timeline.primaryActorCount === 5 && lesson.timeline.contextActorCount === 5),
      details: lessonSignals.lessons.map((lesson) => `${lesson.lessonId}:off=${lesson.timeline.sideCounts.offense}/def=${lesson.timeline.sideCounts.defense}/primary=${lesson.timeline.primaryActorCount}/context=${lesson.timeline.contextActorCount}`).join(","),
    },
    {
      id: "lesson.timeline.moving_actors",
      pass: lessonSignals.lessons.every((lesson) => lesson.timeline.primaryMovingActorCount === 5 && lesson.timeline.contextMovingActorCount === 5),
      details: lessonSignals.lessons.map((lesson) => `${lesson.lessonId}:primary=${lesson.timeline.primaryMovingActorCount}/context=${lesson.timeline.contextMovingActorCount}`).join(","),
    },
    {
      id: "lesson.timeline.motion_distance",
      pass: lessonSignals.lessons.every((lesson) => lesson.timeline.maxActorTravel >= 8),
      details: lessonSignals.lessons.map((lesson) => `${lesson.lessonId}:${lesson.timeline.maxActorTravel}`).join(","),
    },
    {
      id: "lesson.timeline.ball_transfers",
      pass: lessonSignals.lessons.every((lesson) => lesson.timeline.ballTransfers >= 1),
      details: lessonSignals.lessons.map((lesson) => `${lesson.lessonId}:${lesson.timeline.ballTransfers}`).join(","),
    },
    {
      id: "lesson.timeline.cost_path_present",
      pass: lessonSignals.lessons.every((lesson) => lesson.timeline.costPath.some((tag) => lesson.watchFor.includes(tag))),
      details: lessonSignals.lessons.map((lesson) => `${lesson.lessonId}:${lesson.timeline.costPath.join("/") || "none"}`).join(","),
    },
    {
      id: "lesson.modal.renders_timeline",
      pass: !lessonSignals.visible || (
        lessonSignals.currentLesson?.board.actorCount === 10 &&
        lessonSignals.currentLesson?.board.sideCounts.offense === 5 &&
        lessonSignals.currentLesson?.board.sideCounts.defense === 5 &&
        lessonSignals.currentLesson?.board.primaryActorCount === 5 &&
        lessonSignals.currentLesson?.board.contextActorCount === 5 &&
        lessonSignals.currentLesson?.board.ballPresent &&
        lessonSignals.currentLesson?.board.scrubberMax >= lessonSignals.currentLesson?.durationMs &&
        lessonSignals.currentLesson?.board.pureAnimation &&
        lessonSignals.currentLesson?.board.personnel === 10 &&
        lessonSignals.currentLesson?.system === "five-v-five-action-motion-v2" &&
        lessonSignals.currentLesson?.actionCount >= 8 &&
        lessonSignals.currentLesson?.activeActions.length >= 1 &&
        lessonSignals.currentLesson?.beatPhase &&
        lessonSignals.currentLesson?.board.activeActions.length >= 1
      ),
      details: lessonSignals.currentLesson
        ? `visible=${lessonSignals.visible}, actors=${lessonSignals.currentLesson.board.actorCount}/${lessonSignals.currentLesson.actorCount}, off=${lessonSignals.currentLesson.board.sideCounts.offense}, def=${lessonSignals.currentLesson.board.sideCounts.defense}, ball=${lessonSignals.currentLesson.board.ballPresent}, scrubber=${lessonSignals.currentLesson.board.scrubberValue}/${lessonSignals.currentLesson.board.scrubberMax}, pure=${lessonSignals.currentLesson.board.pureAnimation}, phase=${lessonSignals.currentLesson.beatPhase}, active=${lessonSignals.currentLesson.activeActions.join("|")}`
        : `visible=${lessonSignals.visible}`,
    },
    {
      id: "lesson.watchfor_used_by_feedback",
      pass: !commitSignals.lessonId || lessonSignals.lessons.some((lesson) => lesson.lessonId === commitSignals.lessonId && commitSignals.watchFor.some((tag) => lesson.watchFor.includes(tag))),
      details: `commitLesson=${commitSignals.lessonId || "none"}, watchFor=${commitSignals.watchFor.join(",") || "none"}.`,
    },
    {
      id: "postgame.recap.entries_lte_two",
      pass: !S.gameOver || postgameSignals.count <= 2,
      details: `gameOver=${!!S.gameOver}, count=${postgameSignals.count}.`,
    },
    {
      id: "postgame.recap.available_for_committed_tradeoff",
      pass: !S.gameOver || !hasCommittedTradeoff || !postgameSignals.visible || postgameSignals.count >= 1,
      details: `gameOver=${!!S.gameOver}, recapVisible=${postgameSignals.visible}, hasCommittedTradeoff=${hasCommittedTradeoff}, count=${postgameSignals.count}.`,
    },
    {
      id: "postgame.recap.traceable_when_present",
      pass: postgameSignals.items.every((item) => !!item.coachActionId && !!item.adjustmentId && !!item.acceptedCost && (!!item.summaryLivecastId || item.feedbackLivecastIds.length > 0 || item.sourceLivecastIds.length > 0)),
      details: `items=${postgameSignals.items.map((item) => `${item.id}:${item.coachActionId || "no-ca"}/${item.adjustmentId || "no-adj"}/${item.acceptedCost || "no-cost"}`).join(",") || "none"}.`,
    },
    {
      id: "postgame.recap.lesson_link_traceable",
      pass: postgameSignals.items.every((item) => !item.lessonId || postgameSignals.lessonLinks.includes(item.lessonId)),
      details: `itemLessons=${postgameSignals.items.map((item) => item.lessonId).filter(Boolean).join(",") || "none"}, links=${postgameSignals.lessonLinks.join(",") || "none"}.`,
    },
    {
      id: "testids.required.present",
      pass: missingTestIds.length === 0,
      details: missingTestIds.length ? `Missing: ${missingTestIds.join(", ")}` : "All required test ids present.",
    },
  ];
}

function summarizeAssertions(assertions) {
  const failed = assertions.filter((a) => !a.pass);
  return {
    pass: failed.length === 0,
    total: assertions.length,
    failed: failed.map((a) => a.id),
  };
}

function rosterSnapshot() {
  return Object.fromEntries(["knicks", "spurs"].map((team) => [
    team,
    {
      name: ROSTERS[team].name,
      players: ROSTERS[team].players.map((p) => ({
        id: p.id,
        name: p.name,
        onCourt: Array.isArray(S.onCourt[team]) ? S.onCourt[team].includes(p.id) : false,
        stamina: Math.round(p.stamina ?? 100),
        heat: Math.round(p.heat ?? 0),
        pts: p.st ? p.st.pts : 0,
        reb: p.st ? p.st.oreb + p.st.dreb : 0,
        ast: p.st ? p.st.ast : 0,
      })),
    },
  ]));
}

function requiredTestIds() {
  return AI_VERIFY_CONTRACT.requiredTestIds;
}

function ensureStateScript() {
  let script = document.getElementById(STATE_SCRIPT_ID);
  if (!script) {
    script = document.createElement("script");
    script.id = STATE_SCRIPT_ID;
    script.type = "application/json";
    script.setAttribute("data-testid", "ai-verification-state");
    document.body.appendChild(script);
  }
  return script;
}

function makeSeededRandom(seedText) {
  let state = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    state ^= seedText.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  return function seededRandom() {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function formatClock(sec) {
  const safe = Math.max(0, Number(sec) || 0);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function numberText(id) {
  return Number(document.getElementById(id)?.textContent || 0);
}

function parsePercent(value) {
  return Number(String(value || "").replace("%", "")) || 0;
}

function isVisible(el) {
  if (!el) return false;
  let cur = el;
  while (cur && cur.nodeType === 1) {
    const style = getComputedStyle(cur);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    cur = cur.parentElement;
  }
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
  return String(value).replace(/["\\]/g, "\\$&");
}
