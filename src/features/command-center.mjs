import { ROSTERS, OFF_SCHEMES, DEF_SCHEMES } from "../data/commentary-data.mjs?v=action-motion-33";
import { TACTIC_LESSONS } from "../data/tactical-data.mjs?v=action-motion-33";
import { S } from "../state.mjs?v=action-motion-33";
import { $ } from "../utils.mjs?v=action-motion-33";
import { syncAiVerification } from "../ai-verify.mjs?v=action-motion-33";
import {
  createAdjustmentWindow,
  createCoachAction,
  renderCoachReadModel,
} from "../tactical.mjs?v=action-motion-33";
import { lessonIdForAdvice } from "./tactic-board.mjs?v=action-motion-33";

const defaultHooks = {
  renderCmd: () => {},
  setMyScheme: () => {},
  fmtClock: (sec) => {
    const value = Math.max(0, Math.floor(Number(sec) || 0));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
  },
  lineupChangePairs: () => [],
  pushFeed: () => ({}),
  noteCoachAction: () => {},
  stageCoachEffect: () => {},
};

let hooks = { ...defaultHooks };

export function initCommandCenterFeature(options = {}) {
  hooks = {
    ...hooks,
    ...Object.fromEntries(Object.entries(options).filter(([, value]) => typeof value === "function")),
  };
}

export function resetCommandUi(mode = "tactics") {
  S.commandUi = {
    mode,
    expandedRecent: false,
    expandedOffense: false,
    expandedDefense: false,
    expandedLineup: false,
  };
}

export function commandUi() {
  if (!S.commandUi) resetCommandUi();
  return S.commandUi;
}

export function setCommandMode(mode) {
  if (!S.subWindow) return;
  if (mode !== "tactics" && mode !== "lineup") return;
  commandUi().mode = mode;
  hooks.renderCmd();
  syncAiVerification(`command-mode:${mode}`);
}

export function toggleCommandExpand(section) {
  const ui = commandUi();
  const key = section === "recent" ? "expandedRecent"
    : section === "offense" ? "expandedOffense"
    : section === "defense" ? "expandedDefense"
    : section === "lineup" ? "expandedLineup"
    : "";
  if (!key) return;
  ui[key] = !ui[key];
  hooks.renderCmd();
  syncAiVerification(`command-expand:${section}:${ui[key]}`);
}

export function commandReasonLabel(by) {
  if (!by) return "节间布置：比赛自然停表，可以调整战术和轮换。";
  if (by === S.myTeam) {
    return S.coachPrompt?.text ? `触发信号：${S.coachPrompt.text}` : "你主动叫暂停，把比赛按下来重新布置。";
  }
  return `${ROSTERS[by].name}叫暂停，比赛短暂停表。`;
}

function recentFeedTexts(limit = 4) {
  const rows = [...document.querySelectorAll("#feed .feed-row")];
  return rows.slice(-limit).map((row) => row.innerText.trim()).filter(Boolean);
}

export function createCommandSession(by, msg, opt = {}) {
  const contextIds = (S.tactical?.contextHistory || []).slice(-5).map((ctx) => ctx.contextId || ctx.possessionId).filter(Boolean);
  const livecastIds = (S.tactical?.livecastTrace || []).slice(-5).map((row) => row.livecastId).filter(Boolean);
  return {
    id: `cmd-${S.gameNo}-${S.quarter}-${S.tickCount}-${S.tactical?.adjustmentSeq || 0}`,
    reason: by === S.myTeam ? "player_timeout" : (!by ? "break" : "opponent_timeout"),
    by: by || null,
    openedAt: { quarter: S.quarter, clock: S.clock, tick: S.tickCount },
    reasonText: opt.reasonText || commandReasonLabel(by),
    message: msg || "",
    sourceContextIds: contextIds,
    sourceLivecastIds: livecastIds,
    recentFeed: recentFeedTexts(4),
    staffBriefing: null,
    adoptedAdviceId: "",
    acceptedCost: "",
    watchFor: [],
    drafts: [],
    committedPlan: null,
    commitTrace: null,
    committed: false,
  };
}

export function clonePlain(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function rememberCommandSession(session) {
  if (!session?.committed || !session.committedPlan) return;
  if (!Array.isArray(S.commandHistory)) S.commandHistory = [];
  const entry = clonePlain(session);
  const existingIndex = S.commandHistory.findIndex((item) => item.id === entry.id);
  if (existingIndex >= 0) {
    entry.feedbackRows = S.commandHistory[existingIndex].feedbackRows || entry.feedbackRows || [];
    S.commandHistory[existingIndex] = entry;
  } else {
    entry.feedbackRows = entry.feedbackRows || [];
    S.commandHistory.push(entry);
  }
  S.commandHistory = S.commandHistory.slice(-8);
}

export function commandSessionMatchesTrace(session, trace) {
  const plan = session?.committedPlan || null;
  if (!plan || !trace) return false;
  return (trace.coachActionId && trace.coachActionId === plan.coachActionId) ||
    (trace.adjustmentId && trace.adjustmentId === plan.adjustmentId) ||
    (trace.commandSessionId && trace.commandSessionId === session.id);
}

export function recordCommandFeedbackTrace(trace, text) {
  if (!trace?.coachActionId && !trace?.adjustmentId && !trace?.commandSessionId) return;
  const feedback = {
    livecastId: trace.livecastId || "",
    coachActionId: trace.coachActionId || "",
    adjustmentId: trace.adjustmentId || "",
    acceptedCost: trace.acceptedCost || "",
    adoptedAdviceId: trace.adoptedAdviceId || "",
    lessonId: trace.lessonId || "",
    feedbackKind: trace.feedbackKind || trace.source || "",
    text: String(text || "").replace(/<[^>]+>/g, ""),
    quarter: S.quarter,
    clock: S.clock,
    tick: S.tickCount,
  };
  const append = (session) => {
    if (!commandSessionMatchesTrace(session, trace)) return false;
    if (!Array.isArray(session.feedbackRows)) session.feedbackRows = [];
    if (!session.feedbackRows.some((row) => row.livecastId && row.livecastId === feedback.livecastId)) {
      session.feedbackRows.push(feedback);
    }
    return true;
  };
  append(S.lastCommandSession);
  if (Array.isArray(S.commandHistory)) {
    S.commandHistory.forEach((session) => append(session));
  }
}

export function recordCommandDraft(type, payload = {}) {
  if (!S.commandSession) return;
  if (!Array.isArray(S.commandSession.drafts)) S.commandSession.drafts = [];
  S.commandSession.drafts.push({
    type,
    payload,
    quarter: S.quarter,
    clock: S.clock,
    tick: S.tickCount,
  });
}

export const COMMAND_COSTS = {
  corner_three: { label: "弱侧底角", short: "底角三分", feedback: "弱侧底角被放出来，对手已经开始找那一侧" },
  fatigue: { label: "主力体力", short: "体力消耗", feedback: "主力体力继续被消耗，下一段轮换会更难" },
  turnover: { label: "传导失误", short: "失误风险", feedback: "多传一次带来出球压力，失误风险开始抬头" },
  rebound: { label: "篮板保护", short: "篮板风险", feedback: "空间变好以后，篮板保护少了一只手" },
  star_fatigue: { label: "核心体力", short: "核心消耗", feedback: "核心继续硬解，体力账会往后拖" },
  pace_control: { label: "追分速度", short: "节奏偏慢", feedback: "稳住失误的同时，追分速度也被压下来" },
  role_offense: { label: "进攻火力", short: "火力下降", feedback: "防守站稳了，但进攻端少了一个处理点" },
};

export const WATCH_FOR_LABELS = {
  paint_touch_denied: "禁区触球是否被压住",
  corner_three_allowed: "底角是否被放空",
  transition_chance: "转换机会是否变多",
  starter_fatigue: "主力体力是否继续下滑",
  early_release: "弱侧是否出现出球口",
  turnover_risk: "多传一次是否带来失误",
  star_touch: "核心是否能稳定接管",
  star_fatigue: "核心体力账是否变重",
  open_three: "外线空位是否出来",
  rebound_risk: "篮板保护是否变薄",
  free_throw_pressure: "罚球压力是否形成",
  paint_crowded: "禁区是否继续拥堵",
  turnover_down: "失误是否减少",
  pace_slow: "追分速度是否变慢",
  stable_matchup: "对位是否站稳",
  star_touch_allowed: "对手核心是否仍能单打",
  star_cooled: "对手核心是否降温",
  trap_pressure: "包夹压力是否回来",
  scheme_execution: "战术是否跑出第一波效果",
  defense_execution: "防守第一落点是否到位",
  cost_watch: "代价是否开始出现",
};

export function costLabel(costId) {
  return COMMAND_COSTS[costId]?.short || COMMAND_COSTS[costId]?.label || "执行代价";
}

export function watchForLabel(tag) {
  return WATCH_FOR_LABELS[tag] || tag;
}

export function detectCommandProblem(recOff, recDef) {
  const my = S.myTeam, opp = S.oppTeam;
  const model = my ? renderCoachReadModel(my) : null;
  const profile = S.tactical?.lineupProfiles?.[my] || null;
  const recent = S.tactical?.contextHistory?.slice(-4) || [];
  const recentAgainstMe = recent.filter((ctx) => ctx.defenseTeam === my);
  const opponentHadAdvantage = recentAgainstMe.some((ctx) => (ctx.causeIds || []).includes("cause.scheme.counter"));
  if (S.run.team === opp && S.run.pts >= 6) {
    return { id: "run_pressure", title: `${ROSTERS[opp].short}打出 ${S.run.pts}-0，先决定怎么止血`, source: "run" };
  }
  if (profile?.tiredPlayers?.length || (profile?.averageStamina ?? 100) < 58) {
    return { id: "fatigue", title: "场上体力开始影响执行，继续硬撑会付账", source: "lineup" };
  }
  if (opponentHadAdvantage || ["inside", "pace"].includes(S.scheme[opp]?.off)) {
    return { id: "paint_pressure", title: "对手正在冲击禁区，护框压力上升", source: "context" };
  }
  if (["press", "double"].includes(S.scheme[opp]?.def) || model?.schemeFit === "bad") {
    return { id: "ball_pressure", title: "推进和第一传被压住，需要给持球点出口", source: "scheme" };
  }
  if (S.scheme[opp]?.def === "paint" || S.scheme[opp]?.def === "zone") {
    return { id: "spacing", title: "对手收缩站位，外线和弱侧机会会更关键", source: "scheme" };
  }
  return { id: "read_game", title: "比赛进入拉锯，先选择这次暂停的优先级", source: "neutral" };
}

function staffRead(id, role, claim, recommendation, costId, watchFor, opt = {}) {
  return {
    adviceId: id,
    role,
    claim,
    recommendation,
    costId,
    costText: costLabel(costId),
    watchFor,
    confidence: opt.confidence || "medium",
    evidence: opt.evidence || [],
  };
}

export function buildCoachStaffBriefing(recOff, recDef) {
  const problem = detectCommandProblem(recOff, recDef);
  const readsByProblem = {
    paint_pressure: [
      staffRead("advice-defense-paint", "defense", "收缩护框能先止住篮下，但底角会被放出来。", { kind: "def", key: "paint" }, "corner_three", ["paint_touch_denied", "corner_three_allowed"]),
      staffRead("advice-offense-pace", "offense", "保持提速能打乱他们落位，但主力体力会继续掉。", { kind: "off", key: "pace" }, "fatigue", ["transition_chance", "starter_fatigue"]),
    ],
    ball_pressure: [
      staffRead("advice-offense-motion", "offense", "团队传导能给持球点出口，但多传一次也会带来失误风险。", { kind: "off", key: "motion" }, "turnover", ["early_release", "turnover_risk"]),
      staffRead("advice-offense-iso", "offense", "让核心单打能减少传球压力，但会继续消耗核心体力。", { kind: "off", key: "iso" }, "star_fatigue", ["star_touch", "star_fatigue"]),
    ],
    spacing: [
      staffRead("advice-offense-perimeter", "offense", "外线火力能惩罚收缩，但篮板保护会变薄。", { kind: "off", key: "perimeter" }, "rebound", ["open_three", "rebound_risk"]),
      staffRead("advice-offense-inside", "offense", "继续冲篮下能造杀伤，但会撞进他们的护框。", { kind: "off", key: "inside" }, "turnover", ["free_throw_pressure", "paint_crowded"]),
    ],
    fatigue: [
      staffRead("advice-offense-balanced", "offense", "先打均衡能降低失误和消耗，但追分速度会慢。", { kind: "off", key: "balanced" }, "pace_control", ["turnover_down", "pace_slow"]),
      staffRead("advice-defense-man", "defense", "回到人盯人能少跑轮转，但对手核心会得到单点处理。", { kind: "def", key: "man" }, "role_offense", ["stable_matchup", "star_touch_allowed"]),
    ],
    run_pressure: [
      staffRead("advice-defense-double", "defense", "包夹核心能先打断对手气势，但角色球员会获得空位。", { kind: "def", key: "double" }, "corner_three", ["star_cooled", "corner_three_allowed"]),
      staffRead("advice-offense-iso", "offense", "交给核心硬解能稳住情绪，但体力和包夹压力都会上来。", { kind: "off", key: "iso" }, "star_fatigue", ["star_touch", "trap_pressure"]),
    ],
    read_game: [
      staffRead("advice-offense-rec", "offense", `${OFF_SCHEMES[recOff].name}能针对对手站位，但要接受${costLabel(recOff === "perimeter" ? "rebound" : "turnover")}。`, { kind: "off", key: recOff }, recOff === "perimeter" ? "rebound" : "turnover", ["scheme_execution", "cost_watch"]),
      staffRead("advice-defense-rec", "defense", `${DEF_SCHEMES[recDef].name}能先处理对手强点，但会放大另一侧风险。`, { kind: "def", key: recDef }, recDef === "paint" || recDef === "double" ? "corner_three" : "role_offense", ["defense_execution", "cost_watch"]),
    ],
  };
  const reads = readsByProblem[problem.id] || readsByProblem.read_game;
  return {
    briefingId: `staff-${S.gameNo}-${S.quarter}-${S.tickCount}`,
    commandSessionId: S.commandSession?.id || "",
    primaryProblem: problem.id,
    primaryProblemText: problem.title,
    source: problem.source,
    sourceLivecastIds: S.commandSession?.sourceLivecastIds || [],
    sourceContextIds: S.commandSession?.sourceContextIds || [],
    reads: reads.slice(0, 2),
  };
}

export function ensureCommandStaffBriefing(recOff, recDef) {
  if (!S.commandSession) return null;
  if (!S.commandSession.staffBriefing) S.commandSession.staffBriefing = buildCoachStaffBriefing(recOff, recDef);
  return S.commandSession.staffBriefing;
}

export function roleLabel(role) {
  return role === "offense" ? "进攻助教"
    : role === "defense" ? "防守助教"
    : role === "lineup" ? "轮换助教"
    : "首席助教";
}

export function adviceMatchesCurrent(advice) {
  if (!advice || !S.myTeam) return false;
  const rec = advice.recommendation || {};
  if (rec.kind === "off" || rec.kind === "def") return S.scheme[S.myTeam]?.[rec.kind] === rec.key;
  return false;
}

export function selectedStaffAdvice() {
  const reads = S.commandSession?.staffBriefing?.reads || [];
  const adopted = reads.find((read) => read.adviceId === S.commandSession?.adoptedAdviceId);
  return adopted && adviceMatchesCurrent(adopted) ? adopted : null;
}

export function staffAdviceSummary(advice) {
  if (!advice) return "";
  const rec = advice.recommendation || {};
  if (rec.kind === "off") return `${roleLabel(advice.role)}建议进攻打【${OFF_SCHEMES[rec.key]?.name || rec.key}】`;
  if (rec.kind === "def") return `${roleLabel(advice.role)}建议防守切【${DEF_SCHEMES[rec.key]?.name || rec.key}】`;
  return `${roleLabel(advice.role)}建议处理本次主要问题`;
}

export function applyStaffAdvice(adviceId) {
  if (!S.commandSession) return;
  const advice = (S.commandSession.staffBriefing?.reads || []).find((item) => item.adviceId === adviceId);
  if (!advice) return;
  S.commandSession.adoptedAdviceId = advice.adviceId;
  S.commandSession.acceptedCost = advice.costId;
  S.commandSession.watchFor = advice.watchFor || [];
  const rec = advice.recommendation || {};
  if ((rec.kind === "off" || rec.kind === "def") && rec.key && S.scheme[S.myTeam]?.[rec.kind] !== rec.key) {
    hooks.setMyScheme(rec.kind, rec.key);
  } else {
    hooks.renderCmd();
  }
  syncAiVerification(`staff-advice:${adviceId}`);
}

export function renderCommandStage() {
  renderCommandTopbar();
  const title = $("command-title");
  const reason = $("command-reason");
  const risk = $("command-risk");
  const recent = $("command-recent");
  if (!title || !reason || !recent) return;
  const session = S.commandSession;
  title.textContent = session?.by === S.myTeam
    ? "为什么叫停"
    : "节间要点";
  reason.textContent = session?.reasonText || "读懂刚才的问题，再决定怎么调整。";
  const model = S.myTeam ? renderCoachReadModel(S.myTeam) : null;
  const riskText = model?.risk ? String(model.risk).replace(/^风险[:：]\s*/, "") : "";
  if (risk) risk.textContent = riskText ? `最大风险：${riskText}` : "最大风险：观察对手下一波反制。";
  recent.innerHTML = "";
  recent.classList.toggle("expanded", !!S.commandUi?.expandedRecent);
  const allRecent = session?.recentFeed || [];
  const visibleCount = S.commandUi?.expandedRecent ? 4 : 1;
  allRecent.slice(-visibleCount).forEach((text) => {
    const row = document.createElement("div");
    row.className = "command-recent-row";
    row.textContent = text;
    recent.appendChild(row);
  });
  const toggle = $("command-recent-toggle");
  if (toggle) {
    const canExpand = allRecent.length > 2;
    toggle.classList.toggle("hidden", !canExpand);
    toggle.textContent = S.commandUi?.expandedRecent ? "收起复盘" : `展开复盘（${Math.min(4, allRecent.length)}条）`;
  }
}

export function renderCommandTopbar() {
  const title = $("command-topbar-title");
  const meta = $("command-topbar-meta");
  if (title) title.textContent = S.subBy ? "暂停布置" : "节间布置";
  if (meta) {
    const my = S.myTeam ? ROSTERS[S.myTeam].short : "我方";
    const opp = S.oppTeam ? ROSTERS[S.oppTeam].short : "对手";
    meta.textContent = `${my} ${S.score[S.myTeam] ?? 0} - ${S.score[S.oppTeam] ?? 0} ${opp} · Q${S.quarter} ${hooks.fmtClock(S.clock)}`;
  }
}

export function renderCommandStaff(showHints, recOff, recDef) {
  const wrap = $("command-staff");
  const problem = $("command-staff-problem");
  const readsBox = $("command-staff-reads");
  if (!wrap || !problem || !readsBox) return;
  const briefing = ensureCommandStaffBriefing(recOff, recDef);
  if (!briefing) return;
  wrap.dataset.aiPrimaryProblem = briefing.primaryProblem || "";
  wrap.dataset.aiVisibleReads = showHints ? String(Math.min(2, briefing.reads.length)) : "0";
  problem.textContent = briefing.primaryProblemText || "先决定这次暂停要解决什么。";
  readsBox.innerHTML = "";
  if (!showHints) {
    const muted = document.createElement("div");
    muted.className = "staff-read muted";
    muted.innerHTML =
      `<div class="staff-read-head"><span class="staff-read-role">首席助教</span><span class="staff-read-cost">待拍板</span></div>` +
      `<div class="staff-read-claim">打开助教提示后，会给出两种有代价的处理方向。</div>`;
    readsBox.appendChild(muted);
    return;
  }
  briefing.reads.slice(0, 2).forEach((advice) => {
    const row = document.createElement("div");
    const adopted = advice.adviceId === S.commandSession?.adoptedAdviceId;
    const aligned = adviceMatchesCurrent(advice);
    const active = (adopted && aligned) || aligned;
    row.className = "staff-read" + (active ? " active" : "");
    row.dataset.aiAdviceId = advice.adviceId;
    row.dataset.aiRole = advice.role;
    row.dataset.aiCost = advice.costId;
    row.dataset.aiAdopted = String(adopted && aligned);
    row.dataset.aiAligned = String(aligned);
    row.innerHTML =
      `<div class="staff-read-head"><span class="staff-read-role">${roleLabel(advice.role)}</span>` +
      `<span class="staff-read-cost">代价：${advice.costText}</span></div>` +
      `<div class="staff-read-claim">${advice.claim}</div>` +
      `<button class="staff-read-action" type="button" data-advice-id="${advice.adviceId}">${adopted && aligned ? "已纳入方案" : (aligned ? "确认接受代价" : "采纳这个方向")}</button>`;
    const btn = row.querySelector("button");
    if (btn) {
      btn.disabled = adopted && aligned;
      btn.onclick = () => applyStaffAdvice(advice.adviceId);
    }
    readsBox.appendChild(row);
  });
}

export function renderCommandModeState() {
  const ui = commandUi();
  const tactics = $("command-tactics-body");
  const lineup = $("command-lineup-body");
  const tacticsBtn = $("command-mode-tactics");
  const lineupBtn = $("command-mode-lineup");
  if (tactics) tactics.classList.toggle("hidden", ui.mode !== "tactics");
  if (lineup) lineup.classList.toggle("hidden", ui.mode !== "lineup");
  if (tacticsBtn) {
    tacticsBtn.classList.toggle("active", ui.mode === "tactics");
    tacticsBtn.setAttribute("aria-pressed", String(ui.mode === "tactics"));
  }
  if (lineupBtn) {
    lineupBtn.classList.toggle("active", ui.mode === "lineup");
    lineupBtn.setAttribute("aria-pressed", String(ui.mode === "lineup"));
  }
}

function schemeLabel(kind, key) {
  const info = kind === "off" ? OFF_SCHEMES[key] : DEF_SCHEMES[key];
  return info ? `${info.icon}${info.name}` : "-";
}

function lineupChangesText() {
  const changes = hooks.lineupChangePairs().map(({ inP, outP }) => `${inP.name}上，${outP.name}下`);
  return changes.length ? `换人：${changes.join("；")}` : "换人：暂时不动";
}

export function renderCommandFinalPlan() {
  if (!S.myTeam || !S.scheme[S.myTeam]) return;
  const off = $("command-final-offense");
  const def = $("command-final-defense");
  const subs = $("command-final-subs");
  const cost = $("command-final-cost");
  const advice = selectedStaffAdvice();
  if (off) off.textContent = `进攻：${schemeLabel("off", S.scheme[S.myTeam].off)}`;
  if (def) def.textContent = `防守：${schemeLabel("def", S.scheme[S.myTeam].def)}`;
  if (subs) subs.textContent = lineupChangesText();
  if (cost) {
    const costText = advice ? costLabel(advice.costId) : "待拍板";
    cost.textContent = `代价：${costText}`;
  }
}

export function commitSubWindowSchemePlan() {
  if (!S.myTeam || !S.subWindowSchemeBase || !S.scheme[S.myTeam]) return null;
  const base = S.subWindowSchemeBase;
  const current = S.scheme[S.myTeam];
  const schemeChanges = ["off", "def"].filter((kind) => base[kind] && current[kind] && base[kind] !== current[kind]).map((kind) => {
    const pool = kind === "off" ? OFF_SCHEMES : DEF_SCHEMES;
    return {
      kind,
      from: base[kind],
      to: current[kind],
      fromName: pool[base[kind]]?.name || base[kind],
      toName: pool[current[kind]]?.name || current[kind],
    };
  });
  const lineupChanges = hooks.lineupChangePairs().map(({ inP, outP }) => ({
    inId: inP.id,
    outId: outP.id,
    inName: inP.name,
    outName: outP.name,
  }));
  const selectedAdvice = selectedStaffAdvice();
  const adoptedAdviceId = selectedAdvice?.adviceId || "";
  const acceptedCost = selectedAdvice?.costId || "";
  const lessonId = lessonIdForAdvice(selectedAdvice);
  const lessonWatchFor = lessonId ? (TACTIC_LESSONS[lessonId]?.watchFor || []) : [];
  let watchFor = selectedAdvice?.watchFor || [];
  if (lessonWatchFor.length && !watchFor.some((tag) => lessonWatchFor.includes(tag))) {
    watchFor = [...new Set([...watchFor, ...lessonWatchFor.slice(0, 2)])];
  }
  if (!schemeChanges.length && !lineupChanges.length && !adoptedAdviceId) return null;

  const expectedCauseIds = new Set(["cause.coach.adjustment_success"]);
  schemeChanges.forEach((change) => {
    if (change.kind === "off") expectedCauseIds.add("cause.scheme.counter");
    if (change.kind === "def") expectedCauseIds.add("cause.defense.stable");
  });
  if (lineupChanges.length) expectedCauseIds.add("cause.lineup.fit");
  if (selectedAdvice?.recommendation?.kind === "off") expectedCauseIds.add("cause.scheme.counter");
  if (selectedAdvice?.recommendation?.kind === "def") expectedCauseIds.add("cause.defense.stable");

  const tacticalAction = createCoachAction("command_commit", {
    team: S.myTeam,
    sessionId: S.commandSession?.id || "",
    schemeChanges,
    lineupChanges,
    drafts: S.commandSession?.drafts || [],
    adoptedAdviceId,
    acceptedCost,
    watchFor,
    lessonId,
  });
  const adjustment = createAdjustmentWindow(tacticalAction, {
    type: "command_commit",
    label: "最终布置",
    targetProblem: "integrated_command",
    expectedCauseIds: [...expectedCauseIds],
    adoptedAdviceId,
    acceptedCost,
    watchFor,
    lessonId,
  });
  const trace = {
    coachActionId: tacticalAction.coachActionId,
    adjustmentId: adjustment.adjustmentId,
    causeIds: [...expectedCauseIds],
    source: "command-commit",
    commandSessionId: S.commandSession?.id || "",
    adoptedAdviceId,
    acceptedCost,
    watchFor,
    lessonId,
    feedbackKind: "command_summary",
  };

  const parts = [];
  schemeChanges.forEach((change) => {
    parts.push(`${change.kind === "off" ? "进攻" : "防守"}【${change.toName}】`);
  });
  if (lineupChanges.length) {
    parts.push(`换人 ${lineupChanges.map((change) => `${change.inName}上、${change.outName}下`).join("；")}`);
  }
  if (!schemeChanges.length && !lineupChanges.length && selectedAdvice) parts.push(staffAdviceSummary(selectedAdvice));
  if (acceptedCost) parts.push(`接受代价：${costLabel(acceptedCost)}`);
  const summaryText = `📋 最终布置：${parts.join("；")}。`;
  const liveTrace = hooks.pushFeed(S.myTeam, summaryText, { team: S.myTeam, coach: true, trace }) || {};
  const coachLabel = `${schemeChanges.length ? "战术" : ""}${lineupChanges.length ? "换人" : ""}${selectedAdvice ? "取舍" : ""}最终布置`;
  hooks.noteCoachAction(coachLabel, liveTrace);
  hooks.stageCoachEffect("command", "最终布置", commandCommitImpact(schemeChanges, lineupChanges, selectedAdvice), liveTrace);

  const committedPlan = {
    summaryText,
    schemeChanges,
    lineupChanges,
    adoptedAdviceId,
    acceptedCost,
    acceptedCostText: acceptedCost ? costLabel(acceptedCost) : "",
    watchFor,
    lessonId,
    staffAdviceSummary: staffAdviceSummary(selectedAdvice),
    coachActionId: liveTrace.coachActionId || tacticalAction.coachActionId,
    adjustmentId: liveTrace.adjustmentId || adjustment.adjustmentId,
    livecastId: liveTrace.livecastId || "",
    expectedCauseIds: [...expectedCauseIds],
  };
  if (S.commandSession) {
    S.commandSession.committedPlan = committedPlan;
    S.commandSession.commitTrace = liveTrace;
  }
  syncAiVerification("command-commit");
  return committedPlan;
}

export function commandCommitImpact(schemeChanges, lineupChanges, selectedAdvice = null) {
  const hasOff = schemeChanges.some((change) => change.kind === "off");
  const hasDef = schemeChanges.some((change) => change.kind === "def");
  const hasLineup = lineupChanges.length > 0;
  if (hasOff && hasDef && hasLineup) return "攻防和体力一起落位，接下来几个回合会集中验证这套方案";
  if ((hasOff || hasDef) && hasLineup) return "战术方向和轮换同时明确，先看出手质量和体力风险是否回稳";
  if (hasOff && hasDef) return "攻防方向同时切换，接下来会看对手是否还按原方式惩罚你";
  if (hasOff) return "进攻触发点已经重排，下一波重点看机会质量";
  if (hasDef) return "防守落点已经重排，下一波重点看对手核心是否降温";
  if (selectedAdvice) return `你接受了${costLabel(selectedAdvice.costId)}这个取舍，下一波重点验证助教判断是否成立`;
  return "体力风险被提前拆掉，轮换效果会在后续回合兑现";
}

export function commandEffectFeedbackText(effect, positive) {
  if (!effect?.acceptedCost) return "";
  const cost = COMMAND_COSTS[effect.acceptedCost];
  const costText = cost?.short || effect.acceptedCostText || "这次代价";
  if (positive) {
    return `这次布置先兑现了目标，但要继续盯住【${costText}】：${cost?.feedback || "代价仍可能在后续回合出现"}。`;
  }
  return `这次选择的代价开始露头：【${costText}】正在影响场面，${cost?.feedback || "需要下一次暂停或轮换继续处理"}。`;
}

export function commandAdviceForSession(session) {
  const plan = session?.committedPlan || null;
  const reads = session?.staffBriefing?.reads || [];
  return reads.find((read) => read.adviceId === plan?.adoptedAdviceId) || null;
}

export function commandDecisionText(session, advice) {
  const plan = session?.committedPlan || null;
  if (advice) return staffAdviceSummary(advice);
  const parts = [];
  (plan?.schemeChanges || []).forEach((change) => {
    parts.push(`${change.kind === "off" ? "进攻" : "防守"}改为【${change.toName}】`);
  });
  if (plan?.lineupChanges?.length) {
    parts.push(`换人：${plan.lineupChanges.map((change) => `${change.inName}上、${change.outName}下`).join("；")}`);
  }
  return parts.join("；") || "保留现有方案";
}

export function commandResolvedWindow(plan) {
  return (S.tactical?.resolvedAdjustmentWindows || []).find((win) => win.adjustmentId === plan?.adjustmentId) || null;
}

export function commandResultText(result) {
  if (result === "success") return "这次取舍被直播验证，方案打出了预期收益。";
  if (result === "partial") return "这次取舍有一部分兑现，但代价也开始影响场面。";
  if (result === "failed") return "这次取舍没有解决根本问题，后续需要再调整。";
  return "后续反馈还不完整，先保留为下场观察点。";
}
