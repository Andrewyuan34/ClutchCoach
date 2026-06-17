import { ROSTERS } from "./data/commentary-data.mjs";
import { S } from "./state.mjs";
import { compactTacticalState } from "./tactical.mjs";

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
    "tab-feed",
    "tab-command",
    "tab-box",
    "command-panel",
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
    "ai-verification-state",
  ]),
  generatedTestIds: Object.freeze([
    "feed-row",
    "scheme-{kind}-{key}",
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

function isVisible(el) {
  const style = getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
  return String(value).replace(/["\\]/g, "\\$&");
}
