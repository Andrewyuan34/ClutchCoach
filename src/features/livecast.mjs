import { ROSTERS, HOME_FLAVOR } from "../data/commentary-data.mjs?v=action-motion-33";
import { SERIES_ATMOSPHERE } from "../data/series-pbp-data.mjs?v=action-motion-33";
import { S } from "../state.mjs?v=action-motion-33";
import { $, fill, rand } from "../utils.mjs?v=action-motion-33";
import { syncAiVerification } from "../ai-verify.mjs?v=action-motion-33";
import { registerLivecastTrace } from "../tactical.mjs?v=action-motion-33";

export function pushFeed(team, text, opt = {}) {
  const feed = $("feed");
  const row = document.createElement("div");
  const trace = registerLivecastTrace(team, text, opt);
  row.className = "feed-row";
  row.setAttribute("data-testid", "feed-row");
  row.dataset.aiTeam = team;
  row.dataset.aiQuarter = String(S.quarter);
  row.dataset.aiClock = fmtClock(S.clock);
  row.dataset.aiScore = `${S.score.knicks}-${S.score.spurs}`;
  row.dataset.aiLivecastId = trace.livecastId;
  if (trace.possessionId) row.dataset.aiPossessionId = trace.possessionId;
  if (trace.contextId) row.dataset.aiContextId = trace.contextId;
  if (trace.causeIds && trace.causeIds.length) row.dataset.aiCauseIds = trace.causeIds.join(" ");
  if (trace.coachActionId) row.dataset.aiCoachActionId = trace.coachActionId;
  if (trace.adjustmentId) row.dataset.aiAdjustmentId = trace.adjustmentId;
  if (trace.adaptationId) row.dataset.aiAdaptationId = trace.adaptationId;
  if (trace.commandSessionId) row.dataset.aiCommandSessionId = trace.commandSessionId;
  if (trace.adoptedAdviceId) row.dataset.aiAdoptedAdviceId = trace.adoptedAdviceId;
  if (trace.acceptedCost) row.dataset.aiAcceptedCost = trace.acceptedCost;
  if (trace.lessonId) row.dataset.aiLessonId = trace.lessonId;
  if (trace.feedbackKind) row.dataset.aiFeedbackKind = trace.feedbackKind;
  if (trace.source) row.dataset.aiTraceSource = trace.source;
  if (opt.score) row.classList.add(team === S.myTeam ? "score-mine" : "score-opp");
  if (opt.big) row.classList.add("big-play");
  if (opt.mini) row.classList.add("mini");
  if (opt.coach) row.classList.add("coach-effect");
  if (opt.coachResult) row.classList.add("coach-result");
  if (team === "system") row.classList.add("sys");

  const t = team === "system" ? "" :
    `<span class="ft-team" style="background:${ROSTERS[team].accent};color:#111">${ROSTERS[team].short}</span>`;
  const clk = team === "system" ? "" :
    `<span class="ft-clock">Q${S.quarter} ${fmtClock(S.clock)}</span>`;

  row.innerHTML =
    `<div class="ft-meta">${clk}${t}</div>` +
    `<div class="ft-text">${text}` +
    (opt.score ? ` <b class="ft-now">(${S.score.knicks}-${S.score.spurs})</b>` : "") +
    `</div>`;
  feed.appendChild(row);
  feed.scrollTop = feed.scrollHeight;
  while (feed.children.length > 60) feed.removeChild(feed.firstChild);
  syncAiVerification("feed:push");
  return trace;
}

export function fmtClock(sec) {
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function richPool(stage) {
  return SERIES_ATMOSPHERE[stage] || null;
}

export function richFeed(stage, team, map = {}, chance = 1, opt = {}) {
  const pool = richPool(stage);
  if (!pool || !pool.length || Math.random() > chance) return false;
  const text = fill(rand(pool), map);
  pushFeed(team || "system", text, { team, mini: opt.mini !== false, big: !!opt.big });
  return true;
}

export function maybeRichFeed(stage, team, map = {}, chance = 0.18, opt = {}) {
  return richFeed(stage, team, map, chance, opt);
}

export function homeCrowdText(kind, map = {}, chance = 1) {
  if (!S.homeTeam || Math.random() > chance) return false;
  const pool = HOME_FLAVOR[S.homeTeam] && HOME_FLAVOR[S.homeTeam][kind];
  if (!pool || !pool.length) return false;
  pushFeed("system", fill(rand(pool), { H: ROSTERS[S.homeTeam].name, A: ROSTERS[S.awayTeam].name, ...map }), { mini: kind !== "opening", big: kind === "clutch" });
  return true;
}
