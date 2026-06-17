import { ROSTERS, OFF_SCHEMES, DEF_SCHEMES, MATCHUP } from "./data/commentary-data.mjs";
import {
  ADAPTATION_RULES,
  CAUSE_TEMPLATES,
  SCHEME_REQUIREMENTS,
  TACTICAL_TRAITS,
  TRAIT_KEYS,
} from "./data/tactical-data.mjs";
import { S } from "./state.mjs";

const HISTORY_LIMIT = 12;
const TRACE_LIMIT = 40;
const DEBUG_LIMIT = 80;
const ADJUSTMENT_LIMIT = 10;

export function makeTacticalState() {
  return {
    possessionSeq: 0,
    coachActionSeq: 0,
    adjustmentSeq: 0,
    livecastSeq: 0,
    adaptationSeq: 0,
    lastContext: null,
    currentContext: null,
    contextHistory: [],
    lineupProfiles: { knicks: null, spurs: null },
    lastCoachAction: null,
    activeAdjustmentWindows: [],
    resolvedAdjustmentWindows: [],
    playerPatterns: { recentOffSchemes: [], recentDefSchemes: [], starUsage: {} },
    opponentAdaptation: null,
    adaptationHistory: [],
    livecastTrace: [],
    debugEvents: [],
  };
}

export function resetTacticalState() {
  S.tactical = makeTacticalState();
  refreshLineupProfiles("reset");
  debugEvent("tactical.reset", {});
  return S.tactical;
}

export function ensureTacticalState() {
  if (!S.tactical) S.tactical = makeTacticalState();
  return S.tactical;
}

export function refreshLineupProfiles(reason = "refresh") {
  const t = ensureTacticalState();
  ["knicks", "spurs"].forEach((team) => {
    t.lineupProfiles[team] = buildLineupProfile(team);
  });
  debugEvent("lineup.profile.updated", { reason, profiles: compactLineupProfiles() });
  return t.lineupProfiles;
}

export function buildLineupProfile(team) {
  const players = playersOnCourt(team);
  const profile = {
    team,
    playerIds: players.map((p) => p.id),
    averageStamina: average(players.map((p) => p.stamina ?? 100)),
    hotPlayers: players.filter((p) => (p.heat || 0) >= 24).map((p) => p.id),
    coldPlayers: players.filter((p) => (p.heat || 0) <= -24).map((p) => p.id),
    tiredPlayers: players.filter((p) => (p.stamina ?? 100) < 42).map((p) => p.id),
    strengths: [],
    weaknesses: [],
  };
  TRAIT_KEYS.forEach((key) => {
    profile[key] = Math.round(average(players.map((p) => getPlayerTraits(p)[key])));
  });
  profile.strengths = TRAIT_KEYS.filter((key) => profile[key] >= 72);
  profile.weaknesses = TRAIT_KEYS.filter((key) => profile[key] <= 45);
  profile.summary = summarizeProfile(profile);
  return profile;
}

export function getPlayerTraits(playerOrId) {
  const id = typeof playerOrId === "string" ? playerOrId : playerOrId.id;
  const player = typeof playerOrId === "string" ? findPlayer(id) : playerOrId;
  return TACTICAL_TRAITS[id] || deriveTraits(player);
}

export function createCoachAction(type, payload = {}) {
  const t = ensureTacticalState();
  const action = {
    coachActionId: nextId("coachAction", "ca"),
    type,
    payload: clone(payload),
    tick: S.tickCount,
    quarter: S.quarter,
    clock: S.clock,
    score: { ...S.score },
  };
  t.lastCoachAction = action;
  debugEvent("coach.action", action);
  return action;
}

export function createAdjustmentWindow(action, options = {}) {
  const t = ensureTacticalState();
  const expectedCauseIds = options.expectedCauseIds || expectedCausesForAction(action);
  const win = {
    adjustmentId: nextId("adjustment", "adj"),
    sourceActionId: action ? action.coachActionId : null,
    type: options.type || action?.type || "manual",
    label: options.label || actionLabel(action),
    targetProblem: options.targetProblem || "read_game",
    expectedCauseIds,
    startPossessionId: t.lastContext ? t.lastContext.possessionId : null,
    remainingPossessions: options.remainingPossessions || 5,
    metrics: {
      goodShotCount: 0,
      badShotCount: 0,
      turnoverCount: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      expectedCauseHits: 0,
      negativeCauseHits: 0,
    },
    result: null,
  };
  t.activeAdjustmentWindows.push(win);
  debugEvent("adjustment.window.created", win);
  return win;
}

export function createPossessionContext({ off, def, shooter = null }) {
  const t = ensureTacticalState();
  refreshLineupProfiles("possession");

  const offScheme = S.scheme[off]?.off || "balanced";
  const defScheme = S.scheme[def]?.def || "man";
  const relation = schemeRelation(offScheme, defScheme);
  const offFit = assessSchemeFit(off, "off", offScheme);
  const defFit = assessSchemeFit(def, "def", defScheme);
  const context = {
    possessionId: nextId("possession", "p"),
    contextId: "",
    offenseTeam: off,
    defenseTeam: def,
    offScheme,
    defScheme,
    schemeRelation: relation.kind,
    schemeMatchupValue: relation.value,
    schemeFit: offFit.fit,
    schemeFitScore: offFit.score,
    lineupFit: offFit.fit,
    lineupFitScore: offFit.score,
    defenseFit: defFit.fit,
    shooterId: shooter ? shooter.id : null,
    shooterStamina: shooter ? Math.round(shooter.stamina ?? 100) : null,
    shooterHeat: shooter ? Math.round(shooter.heat || 0) : null,
    causeIds: [],
    fitReasonIds: [...offFit.missing.map((m) => `need.${m}`), ...defFit.missing.map((m) => `def_need.${m}`)],
    outcomeTags: [],
    primaryCause: "",
    secondaryCause: "",
    coachRelevant: false,
    adjustmentIds: t.activeAdjustmentWindows.map((w) => w.adjustmentId),
  };
  context.contextId = `ctx-${context.possessionId}`;

  if (relation.kind === "offense_advantage") addCause(context, "cause.scheme.counter");
  if (relation.kind === "defense_advantage") addCause(context, "cause.scheme.blocked");
  if (offFit.fit === "good") addCause(context, "cause.lineup.fit");
  if (offFit.fit !== "good") addCause(context, "cause.lineup.mismatch");
  if (defFit.fit === "good") addCause(context, "cause.defense.stable");
  if (offScheme === "motion" && offFit.fit === "good") addCause(context, "cause.scheme.ball_movement");
  if (offScheme === "iso" && shooter?.star) addCause(context, "cause.scheme.star_advantage");
  if (shooter && (shooter.stamina ?? 100) < 42) addCause(context, "cause.fatigue");
  if (shooter && Math.abs(shooter.heat || 0) >= 24) addCause(context, "cause.hot_cold");
  if (t.opponentAdaptation?.state === "applied") addCause(context, "cause.opponent.adaptation");
  if (t.activeAdjustmentWindows.length) context.coachRelevant = true;

  t.currentContext = context;
  debugEvent("possession.context.created", compactContext(context));
  return context;
}

export function addCause(context, causeId) {
  if (context && causeId && !context.causeIds.includes(causeId)) {
    context.causeIds.push(causeId);
    if (!context.primaryCause) context.primaryCause = causeId;
    else if (!context.secondaryCause) context.secondaryCause = causeId;
  }
}

export function addOutcomeTag(context, tag) {
  if (context && tag && !context.outcomeTags.includes(tag)) context.outcomeTags.push(tag);
}

export function traceForContext(context, extra = {}) {
  if (!context) return extra;
  return {
    possessionId: context.possessionId,
    contextId: context.contextId,
    causeIds: [...context.causeIds],
    adjustmentId: context.adjustmentIds[0] || "",
    adaptationId: S.tactical?.opponentAdaptation?.adaptationId || "",
    ...extra,
  };
}

export function finalizePossessionContext(context, outcome = {}) {
  if (!context) return [];
  const t = ensureTacticalState();
  Object.assign(context, { outcome: clone(outcome) });
  if (outcome.made) addOutcomeTag(context, "made");
  if (outcome.turnover) addOutcomeTag(context, "turnover");
  if (outcome.block) addOutcomeTag(context, "block");
  if (outcome.foul) addOutcomeTag(context, "foul");
  if (outcome.miss) addOutcomeTag(context, "miss");
  if (outcome.isThree) addOutcomeTag(context, "three");
  if (outcome.isRim) addOutcomeTag(context, "rim");
  const positiveForCoach = S.myTeam && (
    (context.offenseTeam === S.myTeam && (outcome.made || outcome.foul || (outcome.points || 0) > 0)) ||
    (context.defenseTeam === S.myTeam && (outcome.turnover || outcome.block || outcome.miss))
  );
  if (context.coachRelevant && positiveForCoach) addCause(context, "cause.coach.adjustment_success");
  if (!context.causeIds.length) addCause(context, "cause.outcome.generic");

  t.currentContext = null;
  t.lastContext = clone(context);
  pushLimited(t.contextHistory, clone(context), HISTORY_LIMIT);
  updatePlayerPatterns(context);
  const feedback = updateAdjustmentWindows(context, outcome);
  debugEvent("possession.context.resolved", compactContext(context));
  return feedback;
}

export function registerLivecastTrace(team, text, opt = {}) {
  const t = ensureTacticalState();
  const base = opt.trace || traceForContext(t.currentContext || t.lastContext);
  const adjustmentId = base.adjustmentId || "";
  const trace = {
    livecastId: nextId("livecast", "feed"),
    team,
    text: stripTags(text),
    quarter: S.quarter,
    clock: S.clock,
    score: { ...S.score },
    possessionId: base.possessionId || "",
    contextId: base.contextId || "",
    causeIds: base.causeIds || [],
    coachActionId: base.coachActionId || coachActionIdForAdjustment(t, adjustmentId),
    adjustmentId,
    adaptationId: base.adaptationId || "",
    source: opt.source || base.source || "livecast",
  };
  pushLimited(t.livecastTrace, trace, TRACE_LIMIT);
  debugEvent("livecast.trace.created", {
    livecastId: trace.livecastId,
    contextId: trace.contextId,
    causeIds: trace.causeIds,
    source: trace.source,
  });
  return trace;
}

export function renderCauseText(causeId, map = {}) {
  const pool = CAUSE_TEMPLATES[causeId] || [];
  if (!pool.length) return "";
  const text = pool[Math.floor(Math.random() * pool.length)];
  return fillText(text, map);
}

export function renderCoachReadModel(myTeam = S.myTeam) {
  if (!myTeam) return null;
  ensureTacticalState();
  refreshLineupProfiles("coach-read");
  const opp = myTeam === "knicks" ? "spurs" : "knicks";
  const profile = S.tactical.lineupProfiles[myTeam] || buildLineupProfile(myTeam);
  const oppDef = S.scheme[opp]?.def || "man";
  const myOff = S.scheme[myTeam]?.off || "balanced";
  const relation = schemeRelation(myOff, oppDef);
  const fit = assessSchemeFit(myTeam, "off", myOff);
  const risk = readPrimaryRisk(myTeam, profile);
  return {
    situation: situationText(relation, fit, profile),
    scheme: `${schemeName("off", myOff)} vs ${schemeName("def", oppDef)}：${relationText(relation.kind)}`,
    lineup: `阵容：${profile.summary}`,
    risk,
    suggestion: suggestionText(relation, fit, risk),
    schemeFit: fit.fit,
    lineupFit: profile,
  };
}

export function tacticalSubSuggestion(team, recOff) {
  const profile = ensureTacticalState().lineupProfiles[team] || buildLineupProfile(team);
  const bench = playersOnBench(team).filter((p) => (p.stamina ?? 100) > 50);
  const need = mainNeedForScheme("off", recOff, profile);
  const tired = playersOnCourt(team).slice().sort((a, b) => (a.stamina ?? 100) - (b.stamina ?? 100))[0];
  const candidate = bench
    .slice()
    .sort((a, b) => (getPlayerTraits(b)[need] + (b.stamina ?? 100) * 0.2) - (getPlayerTraits(a)[need] + (a.stamina ?? 100) * 0.2))[0];
  if (need && candidate && profile[need] < 68) {
    return `为了执行${schemeName("off", recOff)}，需要补${traitLabel(need)}；${candidate.name}是最直接的候选。`;
  }
  if (tired && tired.stamina < 45 && candidate) {
    return `${tired.name}体力偏低，若继续打${schemeName("off", recOff)}，可以用${candidate.name}补一段${traitLabel(need || "pace")}。`;
  }
  return `当前阵容${profile.summary}，换人重点是服务${schemeName("off", recOff)}，不是只看体力。`;
}

export function updateOpponentAdaptation() {
  const t = ensureTacticalState();
  if (!S.myTeam || !S.oppTeam) return null;
  const active = t.opponentAdaptation;
  if (active?.state === "prewarn" && S.tickCount >= active.applyTick) {
    active.state = "applied";
    pushLimited(t.adaptationHistory, clone(active), ADJUSTMENT_LIMIT);
    debugEvent("opponent.adaptation.applied", active);
    return { type: "apply", ...active };
  }
  if (active && S.tickCount < active.cooldownUntil) return null;

  const rule = detectAdaptationRule();
  if (!rule) return null;
  const adaptation = {
    adaptationId: nextId("adaptation", "opp-adapt"),
    patternId: rule.patternId,
    state: "prewarn",
    targetDef: rule.targetDef || "",
    targetOff: rule.targetOff || "",
    prewarn: fillText(rule.prewarn, teamMap()),
    applyText: fillText(rule.applyText, teamMap()),
    applyTick: S.tickCount + 1,
    cooldownUntil: S.tickCount + rule.cooldown,
    prewarnLivecastId: "",
  };
  t.opponentAdaptation = adaptation;
  debugEvent("opponent.adaptation.prewarn", adaptation);
  return { type: "prewarn", ...adaptation };
}

export function noteOpponentAdaptationLivecast(livecastId) {
  const active = ensureTacticalState().opponentAdaptation;
  if (active && active.state === "prewarn") active.prewarnLivecastId = livecastId || "";
}

export function compactTacticalState() {
  const t = ensureTacticalState();
  return {
    lastPossessionContext: t.lastContext ? compactContext(t.lastContext) : null,
    lineupProfiles: compactLineupProfiles(),
    activeAdjustmentWindows: t.activeAdjustmentWindows.map(compactAdjustment),
    resolvedAdjustmentWindows: t.resolvedAdjustmentWindows.slice(-3).map(compactAdjustment),
    lastCoachAction: t.lastCoachAction,
    opponentAdaptation: t.opponentAdaptation,
    livecastTrace: t.livecastTrace.slice(-8),
    debugEvents: t.debugEvents.slice(-12),
  };
}

function updateAdjustmentWindows(context, outcome) {
  const t = ensureTacticalState();
  const feedback = [];
  t.activeAdjustmentWindows.forEach((win) => {
    const offenseIsMine = context.offenseTeam === S.myTeam;
    if (offenseIsMine) {
      win.metrics.pointsFor += outcome.points || 0;
      win.metrics.pointsAgainst += outcome.pointsAgainst || 0;
      if (outcome.turnover) win.metrics.turnoverCount += 1;
      if (outcome.made) win.metrics.goodShotCount += 1;
      if (outcome.miss && context.schemeFit === "bad") win.metrics.badShotCount += 1;
    } else {
      win.metrics.pointsAgainst += outcome.points || 0;
    }
    if (win.expectedCauseIds.some((id) => causeMatches(context.causeIds, id))) win.metrics.expectedCauseHits += 1;
    if (context.causeIds.some((id) => id.includes("mismatch") || id.includes("blocked") || id.includes("fatigue"))) win.metrics.negativeCauseHits += 1;
    win.remainingPossessions -= 1;
  });

  const stillActive = [];
  t.activeAdjustmentWindows.forEach((win) => {
    if (win.remainingPossessions > 0 && win.metrics.expectedCauseHits < 2) {
      stillActive.push(win);
      return;
    }
    win.result = resolveAdjustmentResult(win);
    const text = adjustmentFeedbackText(win);
    const resolved = clone(win);
    pushLimited(t.resolvedAdjustmentWindows, resolved, ADJUSTMENT_LIMIT);
    feedback.push({
      text,
      trace: {
        adjustmentId: win.adjustmentId,
        coachActionId: win.sourceActionId,
        causeIds: [win.result === "failed" ? "cause.coach.adjustment_failed" : "cause.coach.adjustment_success"],
        source: "adjustment",
      },
    });
    debugEvent("adjustment.window.resolved", resolved);
  });
  t.activeAdjustmentWindows = stillActive;
  return feedback;
}

function expectedCausesForAction(action) {
  if (!action) return ["cause.scheme.counter", "cause.lineup.fit"];
  if (action.type === "scheme_change") return ["cause.scheme.counter", "cause.lineup.fit", "cause.scheme.ball_movement"];
  if (action.type === "substitution") return ["cause.lineup.fit"];
  if (action.type === "timeout") return ["cause.coach.adjustment_success"];
  if (action.type === "decision") return ["cause.coach.adjustment_success", "cause.scheme.counter"];
  if (action.type === "crisis_choice") return ["cause.coach.adjustment_success", "cause.defense.stable"];
  if (action.type === "clutch_choice") return ["cause.scheme.star_advantage"];
  return ["cause.scheme.counter", "cause.lineup.fit"];
}

function resolveAdjustmentResult(win) {
  if (win.metrics.expectedCauseHits >= 2 && win.metrics.negativeCauseHits <= 1) return "success";
  if (win.metrics.expectedCauseHits >= 1) return "partial";
  return "failed";
}

function adjustmentFeedbackText(win) {
  if (win.result === "success") return `${win.label}开始见效，接下来几个回合已经打出了预期的战术原因。`;
  if (win.result === "partial") return `${win.label}有一部分效果，但还被体力、阵容或对手反制抵消。`;
  return `${win.label}还没解决根本问题，场上的主要限制仍然存在。`;
}

function assessSchemeFit(team, kind, key) {
  const profile = ensureTacticalState().lineupProfiles[team] || buildLineupProfile(team);
  const req = SCHEME_REQUIREMENTS[kind]?.[key];
  if (!req) return { fit: "partial", score: 60, missing: [] };
  const scores = Object.entries(req.needs).map(([trait, target]) => ({
    trait,
    target,
    value: profile[trait] || 0,
    ratio: (profile[trait] || 0) / target,
  }));
  const avgRatio = average(scores.map((s) => Math.min(1.25, s.ratio)));
  const score = Math.round(avgRatio * 80);
  const missing = scores.filter((s) => s.ratio < 0.88).map((s) => s.trait);
  const fit = avgRatio >= 1 ? "good" : (avgRatio >= 0.82 ? "partial" : "bad");
  return { fit, score, missing, needs: req.needs };
}

function schemeRelation(offScheme, defScheme) {
  const value = (MATCHUP[offScheme] && MATCHUP[offScheme][defScheme]) || 0;
  const kind = value > 0.04 ? "offense_advantage" : (value < -0.04 ? "defense_advantage" : "neutral");
  return { value, kind };
}

function detectAdaptationRule() {
  const t = ensureTacticalState();
  const recentOff = t.playerPatterns.recentOffSchemes.slice(-5);
  const commonOff = mostCommon(recentOff);
  if (commonOff.key === "perimeter" && commonOff.count >= 3) return ADAPTATION_RULES.repeat_perimeter;
  if (commonOff.key === "iso" && commonOff.count >= 3) return ADAPTATION_RULES.repeat_iso;
  const court = playersOnCourt(S.myTeam);
  if (court.find((p) => p.star && (p.stamina ?? 100) < 38)) return ADAPTATION_RULES.primary_tired;
  if (court.filter((p) => (p.stamina ?? 100) < 40).length >= 2) return ADAPTATION_RULES.no_sub_fatigue;
  return null;
}

function updatePlayerPatterns(context) {
  const t = ensureTacticalState();
  if (context.offenseTeam === S.myTeam) pushLimited(t.playerPatterns.recentOffSchemes, context.offScheme, 8);
  if (context.defenseTeam === S.myTeam) pushLimited(t.playerPatterns.recentDefSchemes, S.scheme[S.myTeam].def, 8);
  if (context.shooterId) {
    t.playerPatterns.starUsage[context.shooterId] = (t.playerPatterns.starUsage[context.shooterId] || 0) + 1;
  }
}

function readPrimaryRisk(team, profile) {
  if (profile.tiredPlayers.length) return `风险：${playerName(profile.tiredPlayers[0])}体力偏低`;
  const adaptation = ensureTacticalState().opponentAdaptation;
  if (adaptation?.state === "prewarn") return "风险：对手准备反制固定套路";
  if (profile.weaknesses.length) return `风险：${traitLabel(profile.weaknesses[0])}偏弱`;
  return "风险：暂无明显红线";
}

function situationText(relation, fit, profile) {
  if (fit.fit === "good" && relation.kind === "offense_advantage") return "局势：战术和阵容都对上了";
  if (fit.fit !== "good" && relation.kind === "offense_advantage") return "局势：思路对，执行条件还差一点";
  if (relation.kind === "defense_advantage") return "局势：当前打法被对手卡住";
  if (profile.tiredPlayers.length) return "局势：体力开始影响执行";
  return "局势：拉锯中，先看下一次调整";
}

function suggestionText(relation, fit, risk) {
  if (fit.fit !== "good") return "建议：补足阵容短板后再坚持这套打法";
  if (relation.kind === "defense_advantage") return "建议：换一个进攻方向或先叫暂停";
  if (risk.includes("体力")) return "建议：下一次窗口优先处理体力红线";
  return "建议：保持当前方向，观察对手是否反制";
}

function mainNeedForScheme(kind, key, profile) {
  const req = SCHEME_REQUIREMENTS[kind]?.[key]?.needs || {};
  return Object.keys(req).sort((a, b) => (profile[a] || 0) - (profile[b] || 0))[0] || "spacing";
}

function summarizeProfile(profile) {
  const strengths = profile.strengths.slice(0, 2).map(traitLabel);
  const weaknesses = profile.weaknesses.slice(0, 1).map(traitLabel);
  const good = strengths.length ? `${strengths.join("、")}强` : "配置均衡";
  const bad = weaknesses.length ? `，${weaknesses.join("、")}偏弱` : "";
  return `${good}${bad}`;
}

function compactLineupProfiles() {
  const t = ensureTacticalState();
  return Object.fromEntries(["knicks", "spurs"].map((team) => {
    const p = t.lineupProfiles[team];
    return [team, p ? {
      playerIds: p.playerIds,
      spacing: p.spacing,
      handler: p.handler,
      rimProtect: p.rimProtect,
      poaDefense: p.poaDefense,
      averageStamina: p.averageStamina,
      summary: p.summary,
    } : null];
  }));
}

function compactContext(context) {
  return {
    possessionId: context.possessionId,
    contextId: context.contextId,
    offenseTeam: context.offenseTeam,
    defenseTeam: context.defenseTeam,
    offScheme: context.offScheme,
    defScheme: context.defScheme,
    schemeRelation: context.schemeRelation,
    schemeFit: context.schemeFit,
    lineupFit: context.lineupFit,
    shooterId: context.shooterId,
    causeIds: context.causeIds,
    outcomeTags: context.outcomeTags,
    primaryCause: context.primaryCause,
    adjustmentIds: context.adjustmentIds,
  };
}

function compactAdjustment(win) {
  return {
    adjustmentId: win.adjustmentId,
    sourceActionId: win.sourceActionId,
    type: win.type,
    label: win.label,
    expectedCauseIds: win.expectedCauseIds,
    remainingPossessions: win.remainingPossessions,
    result: win.result,
    metrics: win.metrics,
  };
}

function debugEvent(eventName, payload) {
  const t = ensureTacticalState();
  pushLimited(t.debugEvents, {
    eventName,
    tick: S.tickCount,
    quarter: S.quarter,
    clock: S.clock,
    payload: clone(payload),
  }, DEBUG_LIMIT);
}

function coachActionIdForAdjustment(t, adjustmentId) {
  if (!adjustmentId) return "";
  const win = [...t.activeAdjustmentWindows, ...t.resolvedAdjustmentWindows].find((item) => item.adjustmentId === adjustmentId);
  return win?.sourceActionId || "";
}

function nextId(kind, prefix) {
  const t = ensureTacticalState();
  const field = `${kind}Seq`;
  t[field] = (t[field] || 0) + 1;
  return `${prefix}-${String(t[field]).padStart(4, "0")}`;
}

function playersOnCourt(team) {
  const ids = Array.isArray(S.onCourt[team]) ? S.onCourt[team] : [];
  return ids.map((id) => findPlayer(id)).filter(Boolean);
}

function playersOnBench(team) {
  const ids = new Set(Array.isArray(S.onCourt[team]) ? S.onCourt[team] : []);
  return ROSTERS[team].players.filter((p) => !ids.has(p.id));
}

function findPlayer(id) {
  for (const team of ["knicks", "spurs"]) {
    const player = ROSTERS[team].players.find((p) => p.id === id);
    if (player) return player;
  }
  return null;
}

function deriveTraits(player) {
  if (!player) return Object.fromEntries(TRAIT_KEYS.map((key) => [key, 50]));
  return {
    spacing: Math.round((player.thr || 0.3) * 100 * 0.8 + player.off * 0.2),
    handler: Math.round(player.pg * 0.75 + player.off * 0.25),
    rimPressure: Math.round(player.off * 0.7 + (player.pos === "C" ? 12 : 0)),
    poaDefense: Math.round(player.def),
    rimProtect: Math.round(player.def * 0.45 + player.reb * 0.45 + (player.pos === "C" ? 15 : 0)),
    rebound: Math.round(player.reb),
    switch: Math.round(player.def * 0.65 + (player.pos === "SF" || player.pos === "PF" ? 18 : 0)),
    pace: Math.round(player.pg * 0.45 + player.def * 0.35 + player.off * 0.2),
    closer: Math.round((player.star ? 18 : 0) + player.off * 0.6 + player.pg * 0.2),
  };
}

function traitLabel(key) {
  return {
    spacing: "空间",
    handler: "持球",
    rimPressure: "冲框",
    poaDefense: "领防",
    rimProtect: "护框",
    rebound: "篮板",
    switch: "换防",
    pace: "速度",
    closer: "关键球",
  }[key] || key;
}

function schemeName(kind, key) {
  return kind === "off" ? (OFF_SCHEMES[key]?.name || key) : (DEF_SCHEMES[key]?.name || key);
}

function relationText(kind) {
  if (kind === "offense_advantage") return "进攻占优";
  if (kind === "defense_advantage") return "被防守卡住";
  return "中性";
}

function playerName(id) {
  return findPlayer(id)?.name || id;
}

function teamMap() {
  return {
    OFF: ROSTERS[S.myTeam]?.name || "我方",
    DEF: ROSTERS[S.oppTeam]?.name || "对手",
  };
}

function actionLabel(action) {
  if (!action) return "这次调整";
  if (action.type === "scheme_change") return "战术调整";
  if (action.type === "substitution") return "换人调整";
  if (action.type === "timeout") return "暂停布置";
  if (action.type === "clutch_choice") return "关键球选择";
  return "这次调整";
}

function causeMatches(causeIds, expected) {
  return causeIds.some((id) => id === expected || id.startsWith(expected));
}

function mostCommon(values) {
  const counts = new Map();
  values.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  let best = { key: "", count: 0 };
  counts.forEach((count, key) => {
    if (count > best.count) best = { key, count };
  });
  return best;
}

function average(values) {
  const nums = values.filter((v) => Number.isFinite(v));
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function pushLimited(arr, value, limit) {
  arr.push(value);
  while (arr.length > limit) arr.shift();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function stripTags(text) {
  return String(text).replace(/<[^>]*>/g, "");
}

function fillText(text, map = {}) {
  return String(text).replace(/\{(\w+)\}/g, (_, key) => map[key] ?? "");
}
