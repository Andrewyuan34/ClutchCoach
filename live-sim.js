/* =========================================================
   live-sim.js — 文字直播生成引擎 + 教练指挥系统
   核心玩法：你是主教练 ——
     · 实时切换 进攻/防守 战术，与对手「见招拆招」(战术相互克制)
     · 管理体力，主动换人轮换
   模拟以「真实 48 分钟 / 真实回合数」运行，全场数据落入真实区间。
   每条直播事件都会实时累加到对应球员的 box score。
   ========================================================= */

const $ = (id) => document.getElementById(id);
const rand = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fill = (tpl, map) => tpl.replace(/\{(\w)\}/g, (_, k) => map[k] ?? "");

// ----------------- 全局比赛状态 -----------------
const S = {
  myTeam: null, oppTeam: null,
  seriesWins: { knicks: 3, spurs: 1 },
  gameNo: 5,
  score: { knicks: 0, spurs: 0 },
  quarter: 1,
  clock: 720,           // 真实每节 12:00 = 720 秒
  possessionTeam: null,
  running: false,
  speed: 900,           // 每条直播间隔(ms)
  fouls: { knicks: 0, spurs: 0 },
  momentum: { knicks: 0, spurs: 0 },
  timer: null,
  decisionPending: false,
  boost: { knicks: 0, spurs: 0 },
  gameOver: false,
  onCourt: { knicks: [], spurs: [] },
  scheme: {                                  // 两队当前战术
    knicks: { off: "balanced", def: "man" },
    spurs:  { off: "balanced", def: "man" },
  },
  view: "feed",          // feed | box | cmd
  subSel: null,          // 换人选中的场上球员 {team,id}
  tickCount: 0,
  subWindow: false,      // 是否处于换人/调整窗口（节间休息 / 任意一方叫暂停）
  subBy: null,           // 本次暂停由谁叫（"knicks" / "spurs" / null=节间）
  resumeLabel: "▶ 继续比赛",
  subCountdown: 0,       // 布置倒计时（真实秒）
  subTimer: null,        // 倒计时句柄
  timeouts: { knicks: 7, spurs: 7 },  // 暂停次数（节间不消耗，主动叫暂停消耗）
  oppTOQ: 0,             // 对手本节已叫暂停次数（限频）
  run: { team: null, pts: 0 },        // 连续得分流（一波流追踪）
  rotationDone: {},      // 已执行的固定轮换窗口，避免连续死球反复换
  refFrustration: { knicks: 0, spurs: 0 }, // 对吹罚/漏判产生的心理波动
  clutchAftershock: { team: null, val: 0, ticks: 0, kind: "" }, // 关键时刻余震
  coachIdle: 0,          // 玩家连续未进行有效指挥的回合数
  targetLevel: 0,        // 被对手摸透/针对的惩罚层数
};

const QUARTERS = 4;
const QUARTER_SECONDS = 720;   // 真实每节 12 分钟

/* 真实校准基准（每队每场 48 分钟，NBA 联盟平均量级）：
   得分~113 · 投篮41-89 · 三分12-37 · 罚球17-22 · 篮板43 · 助攻26
   失误14 · 抢断8 · 盖帽5 · 回合(pace)~99 · 5人合计出场240分钟
   → 通过「真实回合数 + 每回合用时」自然产生，无需虚拟换算。 */

const STAT_KEYS = ["sec", "pts", "fgm", "fga", "tpm", "tpa", "ftm", "fta", "oreb", "dreb", "ast", "stl", "blk", "tov", "pf"];

// 大心脏系数：关键时刻成功率加成（>1 抗压、<1 易手软）
const CLUTCH_MAP = {
  brunson: 1.15, anunoby: 1.05, clarkson: 1.05, towns: 1.0, bridges: 1.0,
  shamet: 1.0, hart: 1.0, mcbride: 0.95, alvarado: 0.95, sochan: 0.95,
  robinson: 0.9, hukporti: 0.9,
  wemby: 1.1, fox: 1.05, castle: 1.0, vassell: 1.0, champ: 1.0,
  harper: 0.95, keldon: 0.95, bryant: 0.9, kornet: 0.9,
};

// ----------------- 启动流程 -----------------
function setAppHeight() {
  document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
}
function startApp() {
  setAppHeight();
  window.addEventListener("resize", setAppHeight);
  window.addEventListener("orientationchange", setAppHeight);
  document.querySelectorAll(".pick-team").forEach((btn) => {
    btn.onclick = () => {
      S.myTeam = btn.dataset.team;
      S.oppTeam = S.myTeam === "knicks" ? "spurs" : "knicks";
      enterSeries();
    };
  });
  $("btn-tip").onclick = startGame;
  $("btn-next").onclick = afterGameNext;
  $("btn-restart").onclick = () => location.reload();
  $("btn-pause").onclick = togglePause;
  if ($("post-btn-next")) $("post-btn-next").onclick = afterGameNext;
  if ($("post-btn-restart")) $("post-btn-restart").onclick = () => location.reload();
  $("speed-range").oninput = (e) => {
    S.speed = 2800 - Number(e.target.value);
    updateSpeedLabel();
    // 即时生效：正在自动播放时立刻按新速度重排定时器（否则要等当前那条跑完）
    if (S.running && !S.decisionPending && !S.subWindow) scheduleNext(S.speed);
  };
  $("tab-feed").onclick = () => setView("feed");
  $("tab-box").onclick = () => setView("box");
  $("tab-cmd").onclick = () => setView("cmd");
  showScreen("select");
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $("screen-" + name).classList.add("active");
}

// ----------------- 系列赛页 -----------------
function enterSeries() {
  const my = ROSTERS[S.myTeam], opp = ROSTERS[S.oppTeam];
  $("series-line").innerHTML =
    `你执教 <b style="color:${my.accent}">${my.name}</b>，大比分 ` +
    `<b>${S.seriesWins[S.myTeam]} - ${S.seriesWins[S.oppTeam]}</b>` +
    (S.seriesWins[S.myTeam] > S.seriesWins[S.oppTeam]
      ? `，再赢 <b>${4 - S.seriesWins[S.myTeam]}</b> 场夺冠！`
      : `，须连赢 <b>${4 - S.seriesWins[S.myTeam]}</b> 场完成逆转！`);
  $("series-knicks").textContent = S.seriesWins.knicks;
  $("series-spurs").textContent = S.seriesWins.spurs;
  $("series-game").textContent = `即将进行 G${S.gameNo}`;
  showScreen("series");
}

// ----------------- 统计 / 在场阵容 / 体力 -----------------
function initStats() {
  ["knicks", "spurs"].forEach((t) => {
    ROSTERS[t].players.forEach((p, idx) => {
      p.st = {};
      STAT_KEYS.forEach((k) => (p.st[k] = 0));
      p.stamina = 100;
      p.heat = 0;          // 个人气势 -100(冰冷) ~ +100(火热)
      p.clutch = CLUTCH_MAP[p.id] ?? 1.0;   // 大心脏系数
      p.lastOnAt = idx < 5 ? 0 : -99;       // 本次上场时间点（分钟）
      p.lastOffAt = idx < 5 ? -99 : 0;      // 本次下场/休息开始时间点（分钟）
    });
    S.onCourt[t] = ROSTERS[t].players.slice(0, 5).map((p) => p.id);
  });
}
function onCourtArr(team) {
  return S.onCourt[team].map((id) => ROSTERS[team].players.find((p) => p.id === id));
}
function benchArr(team) {
  return ROSTERS[team].players.filter((p) => !S.onCourt[team].includes(p.id));
}
function isOnCourt(team, id) { return S.onCourt[team].includes(id); }

function staminaFactor(p) {
  const s = clamp(p.stamina ?? 100, 0, 100);
  if (s >= 70) return 0.98 + (s - 70) * 0.0007;  // 70~100：基本正常
  if (s >= 40) return 0.90 + (s - 40) * 0.0027;  // 40~70：开始影响攻防
  if (s >= 20) return 0.76 + (s - 20) * 0.007;   // 20~40：明显下滑
  return 0.58 + s * 0.009;                       // 0~20：命中率/防守严重崩盘
}
function gameElapsedMin() {
  const qDone = Math.max(0, Math.min(S.quarter - 1, 4)) * 12;
  const cur = S.quarter <= 4 ? (QUARTER_SECONDS - S.clock) / 60 : 12;
  const ot = S.quarter > 4 ? (S.quarter - 5) * 5 + (300 - S.clock) / 60 : 0;
  return qDone + cur + ot;
}
function targetMin(team, p) {
  return (ROTATION_TARGET_MIN[team] && ROTATION_TARGET_MIN[team][p.id]) ?? (p.star ? 36 : 8);
}
function currentMin(p) { return (p.st && p.st.sec ? p.st.sec : 0) / 60; }

// 体力推进：在场消耗、替补恢复
function tickStamina() {
  ["knicks", "spurs"].forEach((t) => {
    const sc = S.scheme[t];
    onCourtArr(t).forEach((p) => {
      let drain = 0.42 + (p.star ? 0.16 : 0);
      if (sc.def === "press") drain += 0.28;     // 紧逼费体力
      if (sc.off === "pace") drain += 0.22;      // 提速费体力
      if ((p.heat || 0) < -30) drain += 0.08;    // 低迷时更容易疲劳
      p.stamina = clamp(p.stamina - drain, 0, 100);
    });
    benchArr(t).forEach((p) => { p.stamina = clamp(p.stamina + 2.4, 0, 100); });
  });
}

// 换人（通用）：outId 换下，inId 换上
function applySub(team, outId, inId, byCoach, opt = {}) {
  const outP = ROSTERS[team].players.find((p) => p.id === outId);
  const inP = ROSTERS[team].players.find((p) => p.id === inId);
  if (!outP || !inP || isOnCourt(team, inId) || !isOnCourt(team, outId)) return false;
  if (byCoach && team === S.myTeam) noteCoachAction("换人调整");
  const now = gameElapsedMin();
  outP.lastOffAt = now;
  inP.lastOnAt = now;
  S.onCourt[team] = S.onCourt[team].map((id) => (id === outId ? inId : id));
  if (!opt.silent) {
    const tag = byCoach && team === S.myTeam ? "📋 " : "🔄 ";
    pushFeed(team, `${tag}换人：${inP.name} 换下 ${outP.name}（体力 ${Math.round(outP.stamina)}）。`, { team, mini: true });
    maybeRichFeed("substitution", team, { T: ROSTERS[team].name, O: inP.name, P: outP.name }, 0.7);
  }
  return { inP, outP };
}

function canSubOut(p, force) {
  const stint = gameElapsedMin() - (p.lastOnAt ?? 0);
  if (p.stamina < 32) return true;
  return force || stint >= (p.star ? 6.5 : 4.2);
}
function canSubIn(p, force) {
  const rest = gameElapsedMin() - (p.lastOffAt ?? 0);
  if (p.stamina < 42) return false;
  return force || rest >= (p.star ? 3.0 : 2.2);
}

// 自动轮换：只在固定死球窗口/暂停/节间批量换 1~3 人，避免每回合碎片化乱换
function autoRotate(team, force = false, reason = "轮换调整") {
  if (S.subWindow || S.decisionPending || S.gameOver) return false;
  const elapsed = clamp(gameElapsedMin(), 0, 53);
  const progress = clamp(elapsed / 48, 0.05, 1.08);
  const maxChanges = force ? 3 : 2;
  const pairs = [];
  const usedOut = new Set(), usedIn = new Set();

  for (let i = 0; i < maxChanges; i++) {
    const outCand = onCourtArr(team).filter((p) => !usedOut.has(p.id) && canSubOut(p, force)).map((p) => {
      const tgt = targetMin(team, p), cur = currentMin(p), expected = tgt * progress;
      const over = cur - expected;
      const fatigue = Math.max(0, 58 - p.stamina) / 7;
      const starKeep = p.star && p.stamina > 38 && cur < tgt - 2 ? 3.5 : 0;
      return { p, score: over + fatigue + (p.stamina < 38 ? 3.2 : 0) - starKeep, over, cur, tgt };
    }).filter((x) => force || x.p.stamina < 40 || x.over > (x.p.star ? 2.7 : 1.2) || x.cur > x.tgt + 0.8)
      .sort((a, b) => b.score - a.score);

    const inCand = benchArr(team).filter((p) => !usedIn.has(p.id) && canSubIn(p, force)).map((p) => {
      const tgt = targetMin(team, p), cur = currentMin(p), expected = tgt * progress;
      const under = expected - cur;
      return { p, score: under * 1.35 + (tgt - cur) * 0.12 + p.stamina * 0.02, cur, tgt };
    }).filter((x) => force || x.cur < x.tgt - 0.8 || x.score > 1.4)
      .sort((a, b) => b.score - a.score);

    if (!outCand.length || !inCand.length || outCand[0].score < (force ? 0.2 : 1.0)) break;
    const outP = outCand[0].p, inP = inCand[0].p;
    usedOut.add(outP.id); usedIn.add(inP.id);
    pairs.push([outP, inP]);
  }

  if (!pairs.length) return false;
  const ins = [], outs = [];
  pairs.forEach(([outP, inP]) => {
    const r = applySub(team, outP.id, inP.id, false, { silent: true });
    if (r) { ins.push(r.inP.name); outs.push(r.outP.name); }
  });
  if (!ins.length) return false;
  pushFeed(team, `🔄 ${reason}：${ins.join("、")} 上，${outs.join("、")} 下。`, { team, mini: true });
  maybeRichFeed("substitution", team, { T: ROSTERS[team].name }, 0.9);
  return true;
}

function maybeAutoRotationWindow() {
  if (S.subWindow || S.decisionPending || S.gameOver || S.quarter > 4) return;
  const qElapsed = (QUARTER_SECONDS - S.clock) / 60;
  const marks = S.quarter === 1 ? [5.8, 8.9] : [3.2, 6.4, 9.2];
  const mark = marks.find((m) => qElapsed >= m);
  if (mark) {
    const key = `q${S.quarter}:${mark}`;
    if (!S.rotationDone[key]) {
      S.rotationDone[key] = true;
      autoRotate("knicks", false, "死球窗口批量轮换");
      autoRotate("spurs", false, "死球窗口批量轮换");
      return;
    }
  }
  // 只有极端疲劳才打破窗口，仍然批量处理，避免每回合都换
  if (S.tickCount % 5 === 0) {
    ["knicks", "spurs"].forEach((t) => {
      if (onCourtArr(t).some((p) => p.stamina < 30)) autoRotate(t, true, "体力保护轮换");
    });
  }
}

// ----------------- 单场开始 -----------------
function startGame() {
  S.score = { knicks: 0, spurs: 0 };
  S.quarter = 1;
  S.clock = QUARTER_SECONDS;
  S.fouls = { knicks: 0, spurs: 0 };
  S.momentum = { knicks: 0, spurs: 0 };
  S.boost = { knicks: 0, spurs: 0 };
  S.gameOver = false;
  S.tickCount = 0;
  S.subSel = null;
  S.subWindow = false;
  S.subBy = null;
  clearInterval(S.subTimer);
  S.subCountdown = 0;
  S.timeouts = { knicks: 7, spurs: 7 };
  S.oppTOQ = 0;
  S.run = { team: null, pts: 0 };
  S.rotationDone = {};
  S.refFrustration = { knicks: 0, spurs: 0 };
  S.clutchAftershock = { team: null, val: 0, ticks: 0, kind: "" };
  S.coachIdle = 0;
  S.targetLevel = 0;
  // 两队开局战术 = 各自真实战术身份（尼克斯传导/弹性，马刺快攻/护框）
  S.scheme = {
    knicks: { off: TEAM_TACTICS.knicks.defaultOff, def: TEAM_TACTICS.knicks.defaultDef },
    spurs:  { off: TEAM_TACTICS.spurs.defaultOff,  def: TEAM_TACTICS.spurs.defaultDef },
  };
  initStats();
  S.possessionTeam = (S.gameNo % 2 === 1) ? "spurs" : "knicks";   // 奇数场圣安东尼奥主场先球
  $("feed").innerHTML = "";
  $("decision-bar").classList.add("hidden");
  hidePostGamePanel();
  setView("feed");
  updateScoreboard();
  showScreen("game");
  pushFeed("system", `🏆 2026 NBA总决赛 G${S.gameNo}｜大比分 ${ROSTERS.knicks.name} ${S.seriesWins.knicks} - ${S.seriesWins.spurs} ${ROSTERS.spurs.name}。${S.seriesWins.knicks === 3 ? "尼克斯再赢1场即夺53年来首冠，马刺背水一战！" : ""}`);
  if (typeof SERIES_PBP_LIBRARY !== "undefined") {
    pushFeed("system", `📼 已读取前四场全部逐回合文字记录：${SERIES_PBP_LIBRARY.totalRecords} 条、${SERIES_PBP_LIBRARY.eventTypeCount} 类事件，将混合进本场直播语境。`);
    richFeed("broadcast", "system", {}, 1);
  }
  pushFeed("system", `📋 ${ROSTERS.knicks.name} 战术基调：${TEAM_TACTICS.knicks.tag}。`);
  pushFeed("system", `📋 ${ROSTERS.spurs.name} 战术基调：${TEAM_TACTICS.spurs.tag}。`);
  pushFeed("system", `🏀 G${S.gameNo} 跳球！${ROSTERS[S.possessionTeam].name}率先拿到球权。比赛开始！`);
  S.running = true;
  $("btn-pause").textContent = "⏸ 叫暂停";
  updateTimeoutInfo();
  updateSpeedLabel();
  scheduleNext(1200);
}

function scheduleNext(ms) {
  clearTimeout(S.timer);
  S.timer = setTimeout(tick, ms ?? S.speed);
}

/* 开启「换人/调整」窗口：暂停模拟、解锁换人、切到指挥台
   seconds = 布置倒计时（真实秒）；by = 谁叫的暂停（null=节间休息） */
function openSubWindow(msg, btnText, seconds, by) {
  S.running = false;
  S.subWindow = true;
  S.subBy = by || null;
  S.resumeLabel = btnText || "▶ 继续比赛";
  clearTimeout(S.timer);
  if (msg) pushFeed("system", msg);
  richFeed(by ? "timeout" : "quarterBreak", "system", {}, 1);
  setView("cmd");          // 自动切到指挥台，方便立刻调整
  startSubCountdown(seconds || 20);
  updateScoreboard();
}

/* 关闭窗口：锁定换人、恢复模拟 */
function closeSubWindow() {
  clearInterval(S.subTimer);
  S.subCountdown = 0;
  S.subWindow = false;
  S.subBy = null;
  S.subSel = null;
  S.running = true;
  $("btn-pause").textContent = "⏸ 叫暂停";
  updatePauseCountdown();
  setView("feed");          // 暂停/节间结束后主动回到文字直播
  updateScoreboard();
  scheduleNext(300);
}

/* 布置倒计时：每秒递减，归零自动恢复比赛；玩家也可提前点「继续」 */
function startSubCountdown(sec) {
  clearInterval(S.subTimer);
  S.subCountdown = sec;
  updatePauseBtn();
  S.subTimer = setInterval(() => {
    S.subCountdown--;
    updatePauseBtn();
    if (S.subCountdown <= 0) {
      clearInterval(S.subTimer);
      pushFeed("system", "⏱ 暂停结束，比赛继续！");
      closeSubWindow();
    }
  }, 1000);
}

// 暂停期间按钮显示「继续 + 倒计时」
function updatePauseBtn() {
  const b = $("btn-pause");
  if (!b) return;
  b.textContent = S.subWindow ? `${S.resumeLabel} (${Math.max(0, S.subCountdown)}s)` : "⏸ 叫暂停";
  updatePauseCountdown();
}
function updatePauseCountdown() {
  const box = $("pause-countdown"), time = $("pause-countdown-time"), label = $("pause-countdown-label");
  if (!box || !time) return;
  if (!S.subWindow) { box.classList.add("hidden"); return; }
  const left = Math.max(0, S.subCountdown);
  box.classList.remove("hidden");
  time.textContent = left;
  time.classList.toggle("danger", left <= 5);
  if (label) label.textContent = S.subBy ? "暂停布置倒计时" : "节间/加时布置倒计时";
}

// 「叫暂停 / 继续」按钮
function togglePause() {
  if (S.gameOver) return;
  if (S.subWindow || !S.running) {
    // 当前在调整窗口（或已暂停）→ 继续比赛
    closeSubWindow();
  } else {
    // 比赛进行中 → 主动叫暂停（消耗 1 次）
    if (S.timeouts[S.myTeam] <= 0) {
      pushFeed("system", "⚠ 暂停次数已用完，只能等节间休息再调整阵容。");
      return;
    }
    S.timeouts[S.myTeam]--;
    updateTimeoutInfo();
    addMomentum(S.myTeam, 7);          // 叫暂停稳住军心，回一点士气
    S.refFrustration[S.myTeam] = Math.max(0, (S.refFrustration[S.myTeam] || 0) - 8);
    liftHeat(S.myTeam, 8);             // 在场球员士气小幅回暖
    S.run = { team: null, pts: 0 };
    autoRotate(S.oppTeam, true, "暂停批量轮换");   // 对手也趁暂停批量轮换疲劳球员
    openSubWindow(`📣 ${ROSTERS[S.myTeam].name} 请求暂停！士气回稳，可调整战术与阵容（${20}秒布置时间）。`, "▶ 继续比赛", 20, S.myTeam);
  }
}

/* 对手 AI 是否主动叫暂停：被打一波 or 落后较多，每节最多 2 次、概率触发 */
function maybeOppTimeout() {
  const opp = S.oppTeam;
  if (S.timeouts[opp] <= 0 || S.oppTOQ >= 2) return false;
  const diff = S.score[opp] - S.score[S.myTeam];          // 对手视角分差
  const onRun = S.run.team === S.myTeam && S.run.pts >= 8; // 被我方打出一波流
  const behind = diff <= -12;
  if (!(onRun || behind)) return false;
  if (Math.random() >= (onRun ? 0.55 : 0.14)) return false;
  S.timeouts[opp]--; S.oppTOQ++;
  updateTimeoutInfo();
  addMomentum(opp, 7);     // 对手叫暂停稳住军心
  S.refFrustration[opp] = Math.max(0, (S.refFrustration[opp] || 0) - 8);
  liftHeat(opp, 8);
  aiThink(true);           // 借暂停变阵
  autoRotate(opp, true, "暂停批量轮换");
  S.run = { team: null, pts: 0 };
  openSubWindow(`📣 ${ROSTERS[opp].name} 请求暂停！${onRun ? "想掐断你的得分高潮——" : ""}趁这空档调整你的战术与阵容。`, "▶ 继续比赛", 20, opp);
  return true;
}

// ----------------- 主循环：生成一个回合 -----------------
function tick() {
  if (!S.running || S.decisionPending || S.gameOver) return;
  S.tickCount++;

  if (shouldAskClutch()) { askClutchPlay(); return; }
  if (shouldAskDecision()) { askDecision(); return; }

  // 对手 AI 周期性思考变阵
  if (S.tickCount % 16 === 0) aiThink(false);

  runPossession();
  decayHeat();
  advanceAfterPossession(false);
}

// 回合收尾：推进时钟、累计出场时间、判定节末/终场，并排程下一回合
// clutch=true 时为关键球结算后调用（耗时偏长、跳过对手随机暂停）
function advanceAfterPossession(clutch) {
  let dt = 9 + Math.floor(Math.random() * 12);            // 9~20 秒
  if (clutch) dt = 8 + Math.floor(Math.random() * 14);    // 关键球：8~21 秒，倾向耗光时间
  else if (S.scheme[S.possessionTeam] && S.scheme[S.possessionTeam].off === "pace") dt = Math.max(6, dt - 4);
  dt = Math.min(dt, S.clock > 0 ? S.clock : dt);
  ["knicks", "spurs"].forEach((t) => onCourtArr(t).forEach((p) => (p.st.sec += dt)));
  S.clock -= dt;

  tickStamina();
  maybeAutoRotationWindow();
  updateScoreboard();

  if (S.clock <= 0) return handleClockExpired();
  if (!clutch && maybeOppTimeout()) return;   // 比赛中段：对手 AI 可能叫暂停
  scheduleNext();
}

// 时钟归零：进入下一节 / 加时 / 终场
function handleClockExpired() {
  if (S.quarter >= QUARTERS) {
    if (S.score.knicks === S.score.spurs) {
      S.quarter++; S.clock = 300; // 加时 5:00
      S.oppTOQ = 0;
      aiThink(true);
      autoRotate("knicks", true, "加时前批量轮换"); autoRotate("spurs", true, "加时前批量轮换");
      openSubWindow(`⏱ 战平！进入加时赛！可调整阵容与战术（30秒布置时间），点「开始加时」开打。`, "▶ 开始加时", 30, null);
      return;
    } else { return endGame(); }
  } else {
    S.quarter++; S.clock = QUARTER_SECONDS;
    S.oppTOQ = 0;
    aiThink(true);
    autoRotate("knicks", true, "节间批量轮换"); autoRotate("spurs", true, "节间批量轮换");
    openSubWindow(`—— 节间休息 —— 第 ${S.quarter} 节即将开始，可调整阵容与战术（30秒布置时间），点「开始第${S.quarter}节」开打。`, `▶ 开始第${S.quarter}节`, 30, null);
    return;
  }
}

// 一次完整进攻回合
function runPossession() {
  const off = S.possessionTeam;
  const def = off === "knicks" ? "spurs" : "knicks";
  const offP = onCourtArr(off), defP = onCourtArr(def);
  const oSch = S.scheme[off].off, dSch = S.scheme[def].def;

  // 战术综合命中修正（见招拆招的核心）
  const matchup = (MATCHUP[oSch] && MATCHUP[oSch][dSch]) || 0;
  const dbase = DEF_BASE[dSch] || DEF_BASE.man;

  // 选进攻球员（iso 偏向核心）
  const shooter = pickShooter(offP, oSch);
  const isStar = !!shooter.star;

  // 失误率：组织力↑↓、对手防守压力(中心化)、紧逼、提速、传导
  let toRate = 0.12 - (shooter.pg - 50) * 0.001 + (defPressure(def) - 72) * 0.0015;
  toRate += dbase.to;
  if (oSch === "pace") toRate += 0.02;
  if (oSch === "motion") toRate -= 0.03;
  if (dSch === "press" && oSch === "pace") toRate += 0.03;   // 紧逼克快攻
  toRate += (S.refFrustration[off] || 0) * 0.0012;           // 被争议哨/漏判影响后更容易急躁失误
  toRate -= clutchAftershockMod(off) * 0.012;                // 关键球余震：自信方更稳，受挫方更慌
  toRate += (1 - staminaFactor(shooter)) * 0.32;             // 体力差会明显增加失误
  if (shooter.stamina < 30) toRate += 0.025;
  if (off === S.myTeam) toRate += coachTargetPenalty("tov"); // 长时间不指挥：对手预判传球路线
  toRate = clamp(toRate, 0.04, 0.28);

  if (Math.random() < toRate) {
    shooter.st.tov++;
    bumpHeat(shooter, -10);
    if (Math.random() < (0.55 + (dSch === "press" ? 0.15 : 0))) {
      // 抢断人按【抢断天赋 stl】加权：阿奴诺比/阿尔瓦拉多/福克斯等抢断手更可能完成断球
      const stealer = pickByWeight(defP, (p) => (styleOf(p).stl || 1) * (p.def + 20) * staminaFactor(p));
      stealer.st.stl++;
      bumpHeat(stealer, 12);
      pushFeed(off, fill(rand(TEMPLATES.steal), { S: stealer.name, P: shooter.name }), { team: off });
      maybeRichFeed("deadball", def, scoreContext(def), 0.18);
      addMomentum(def, 6);
    } else {
      pushFeed(off, fill(rand(TEMPLATES.turnover), { P: shooter.name }), { team: off });
    }
    switchPossession();
    return;
  }

  // 出手类型（受进攻战术影响）
  let threeRate = shooter.thr;
  let rimBias = 0.42;
  if (oSch === "perimeter") { threeRate += 0.18; }
  if (oSch === "inside") { threeRate -= 0.15; rimBias += 0.18; }
  if (oSch === "pace") { rimBias += 0.10; }
  threeRate = clamp(threeRate, 0.05, 0.85);
  const isThree = Math.random() < threeRate;
  const isRim = !isThree && Math.random() < rimBias;

  // 盖帽（内线出手时）
  if (isRim && Math.random() < blockChance(def, dbase)) {
    // 盖帽人按【护框天赋 blk】强加权：文班/罗宾逊/科内特等天生封盖怪显著更可能送帽
    const blocker = pickByWeight(defP, (p) => (styleOf(p).blk || 1) * (p.def * 0.5 + p.reb * 0.25 + 20) * staminaFactor(p));
    blocker.st.blk++;
    shooter.st.fga++;
    bumpHeat(blocker, 13); bumpHeat(shooter, -11);
    pushFeed(off, fill(rand(TEMPLATES.block), { D: blocker.name, P: shooter.name }), { team: off });
    addMomentum(def, 7);
    rebound(def, off);
    return;
  }

  // 命中率
  let make = baseMake(shooter, isThree, isRim);
  make += S.momentum[off] * 0.0025;
  make += (shooter.heat || 0) * 0.0013;              // 个人手感（火热↑ / 低迷↓）
  make += S.boost[off] * 0.0015;
  make -= (defPressure(def) - 72) * 0.0035;          // 防守压力(中心化)
  make += matchup;                                   // 战术克制
  make += isThree ? dbase.make3 : (isRim ? dbase.makeRim : dbase.makeMid);
  make += isStar ? dbase.star : dbase.other;         // 包夹影响
  make -= (S.refFrustration[off] || 0) * 0.0009;     // 心态波动会让终结质量略降
  make += clutchAftershockMod(off) * 0.025;          // 关键球余震影响后续执行质量
  make += (staminaFactor(shooter) - 1) * 0.58;       // 体力影响：疲劳会直接拉低命中率
  if (shooter.stamina < 35) make -= (35 - shooter.stamina) * 0.0025;
  if (off === S.myTeam) make -= coachTargetPenalty("make"); // 长时间不变招：对手更容易提前站位
  make = clamp(make, 0.12, 0.93);
  const made = Math.random() < make;

  // 造犯规（内线高、三分低；护框/联防内线造犯规略增；下半场大分差时尺度会自然变紧）
  const wEdge = whistleEdge(off, isRim);
  let foulP = isRim ? 0.30 : (isThree ? 0.05 : 0.11);
  if (oSch === "inside") foulP += 0.04;
  if (isRim && (dSch === "paint" || dSch === "zone")) foulP += 0.03;
  foulP = clamp(foulP + wEdge, 0.025, 0.42);
  if (wEdge > 0.022) refPressureText("scaleShift", off, { T: ROSTERS[off].name, D: ROSTERS[def].name, P: shooter.name }, 0.10);
  const drawFoul = Math.random() < foulP;

  if (drawFoul && !made) {
    const fouler = pickByWeight(defP, (p) => p.def * 0.5 + 50);
    fouler.st.pf++; S.fouls[def]++;
    pushFeed(off, `${shooter.name} 出手时被 ${fouler.name} 犯规，获得罚球！`, { team: off });
    handleQuestionableCall(off, def, shooter, fouler, wEdge);
    shootFTs(off, shooter, isThree ? 3 : 2);
    switchPossession();
    return;
  }

  shooter.st.fga++;
  if (isThree) shooter.st.tpa++;

  let assistP = assistChance(shooter);
  if (oSch === "motion") assistP += 0.15;
  if (oSch === "iso") assistP -= 0.18;
  const assister = (made && Math.random() < assistP) ? pickAssister(offP, shooter) : null;

  if (made) {
    shooter.st.fgm++;
    const pts = isThree ? 3 : 2;
    if (isThree) shooter.st.tpm++;
    shooter.st.pts += pts;
    if (assister) assister.st.ast++;
    addScore(off, pts);
    addMomentum(off, isThree ? 7 : 5);
    bumpHeat(shooter, isThree ? 22 : (isRim ? 16 : 14));   // 进球点燃个人手感
    if (assister) bumpHeat(assister, 9);
    pushFeed(off, scoringText(shooter, isThree, isRim, assister), { team: off, score: true, big: isThree || isRim, pts });
    maybeRichFeed("afterScore", off, scoreContext(off), 0.38, { mini: !isThree && !isRim });
    if (S.run.team === off && S.run.pts >= 8) maybeRichFeed("run", off, scoreContext(off), 0.55, { big: true });

    if (drawFoul) {
      const fouler = pickByWeight(defP, (p) => p.def * 0.5 + 50);
      fouler.st.pf++; S.fouls[def]++;
      pushFeed(off, `打成 2+1！${shooter.name} 走上罚球线。`, { team: off });
      richFeed("whistle", off, scoreContext(off), 1);
      handleQuestionableCall(off, def, shooter, fouler, wEdge);
      maybeRichFeed("review", "system", scoreContext(off), 0.08);
      shootFTs(off, shooter, 1);
    }
    switchPossession();
  } else {
    const tplKey = isThree ? "miss_three" : (isRim ? "miss_layup" : "miss_mid");
    bumpHeat(shooter, isThree ? -11 : -9);             // 打铁影响手感
    pushFeed(off, fill(rand(TEMPLATES[tplKey]), { P: shooter.name }), { team: off });
    maybeNoCall(off, def, shooter, isRim, isThree);
    maybeRichFeed("afterMiss", off, scoreContext(off), 0.34);
    rebound(def, off);
  }
}

function shootFTs(team, shooter, n) {
  let made = 0;
  for (let i = 0; i < n; i++) {
    shooter.st.fta++;
    const ftRate = clamp((shooter.ft ?? 0.75) - (1 - staminaFactor(shooter)) * 0.10, 0.45, 0.95);
    if (Math.random() < ftRate) {
      shooter.st.ftm++; shooter.st.pts++; addScore(team, 1); made++;
    }
  }
  pushFeed(team, `${shooter.name} 站上罚球线，${n} 罚 ${made} 中。`, { team, score: made > 0 });
  if (made > 0) bumpHeat(shooter, made * 2);
  // 罚球本身不额外抬团队士气；真正影响士气的是争议哨/漏哨导致的情绪波动
  return made;
}

function rebound(defTeam, offTeam) {
  if (Math.random() < 0.76) {
    const r = pickByWeight(onCourtArr(defTeam), (p) => p.reb * staminaFactor(p));
    r.st.dreb++;
    pushFeed(defTeam, fill(rand(TEMPLATES.dreb), { P: r.name }), { team: defTeam, mini: true });
    S.possessionTeam = defTeam;
  } else {
    const r = pickByWeight(onCourtArr(offTeam), (p) => p.reb * staminaFactor(p));
    r.st.oreb++;
    pushFeed(offTeam, fill(rand(TEMPLATES.oreb), { P: r.name }), { team: offTeam, mini: true });
    addMomentum(offTeam, 3);
    S.possessionTeam = offTeam;
  }
}

function switchPossession() {
  S.possessionTeam = S.possessionTeam === "knicks" ? "spurs" : "knicks";
}

// ----------------- 概率/选人辅助 -----------------
function baseMake(p, isThree, isRim) {
  if (isThree) return 0.30 + (p.off - 60) * 0.004 + (p.thr - 0.4) * 0.2;
  if (isRim)   return 0.58 + (p.off - 60) * 0.005;
  return 0.37 + (p.off - 60) * 0.004;
}
function defPressure(team) {
  const ps = onCourtArr(team);
  return ps.reduce((a, p) => a + p.def * staminaFactor(p), 0) / ps.length;
}
function blockChance(def, dbase) { return clamp(0.135 + (defPressure(def) - 72) * 0.004 + (dbase ? dbase.blk : 0), 0.02, 0.28); }
function assistChance(p) { return 0.62 - (p.pg - 50) * 0.002; }
function pickShooter(players, oSch) {
  const isoMul = (p) => (oSch === "iso" && p.star ? 2.6 : 1);
  return pickByWeight(players, (p) => Math.pow(p.off * staminaFactor(p), 2) * (p.star ? 1.4 : 1) * isoMul(p) * (1 + p.pg * 0.004));
}
function pickAssister(players, shooter) {
  const cand = players.filter((p) => p.id !== shooter.id);
  return pickByWeight(cand, (p) => p.pg + p.off * 0.3);
}
function pickByWeight(arr, fn) {
  const w = arr.map(fn);
  const tot = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * tot;
  for (let i = 0; i < arr.length; i++) { r -= w[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
}

// 取球员打法画像（无画像时给一份保守默认值）
function styleOf(p) {
  return PLAYER_STYLE[p.id] || { pull3: 1, catch3: 2, mid: 2, post: 0.5, floater: 1, layup: 3, dunk: 0.8, blk: 1, stl: 1 };
}
// 按 {key:权重} 归一化加权抽取一个 key
function pickKeyByWeight(obj) {
  const keys = Object.keys(obj);
  const tot = keys.reduce((a, k) => a + Math.max(0, obj[k] || 0), 0);
  if (tot <= 0) return keys[0];
  let r = Math.random() * tot;
  for (const k of keys) { r -= Math.max(0, obj[k] || 0); if (r <= 0) return k; }
  return keys[keys.length - 1];
}
// 依据球员画像 + 是否有助攻，决定本次出手的【动作形态】→ SHOT_FLAVOR 的 key
function pickShotAction(p, isThree, isRim, assister) {
  const s = styleOf(p);
  if (isThree) {
    // 有助攻多为接球定点；无助攻则在自主干拔/流动中接球之间按画像取舍
    if (assister) return Math.random() < 0.85 ? "catch3_assist" : "pull3";
    return pickKeyByWeight({ pull3: s.pull3, catch3: s.catch3 });
  }
  if (isRim) {
    // 是否扣篮由球员扣篮倾向决定（dunk=0 的球员永不暴扣）
    const dunk = s.dunk > 0 && Math.random() < s.dunk / (s.dunk + s.layup + 0.0001);
    if (assister) return dunk ? "lob_dunk" : "cut_layup";   // 接队友传球终结
    return dunk ? "drive_dunk" : "drive_layup";             // 自主突破终结
  }
  // 中距离区间：急停面框 / 背身转身 / 勾手 / 抛投
  return pickKeyByWeight({ pullup_mid: s.mid, post_mid: s.post * 0.6, hook: s.post * 0.4, floater: s.floater });
}

function scoringText(p, isThree, isRim, assister) {
  const key = pickShotAction(p, isThree, isRim, assister);
  const sigKey = key === "catch3_assist" ? "catch3" : key;   // 招牌动作按基础形态查
  const sig = SIGNATURE[p.id] && SIGNATURE[p.id][sigKey];
  const pool = (sig && Math.random() < 0.4) ? sig : (SHOT_FLAVOR[key] || SHOT_FLAVOR.pullup_mid);
  let txt = fill(rand(pool), { P: p.name, A: assister ? assister.name : "" });
  if (S.quarter >= 4 && Math.abs(S.score.knicks - S.score.spurs) <= 6) {
    if (Math.random() < 0.5) txt += " " + rand(CLUTCH_FLAVOR);
  }
  return txt;
}

// ----------------- 得分/气势 -----------------
function addScore(team, pts) {
  S.score[team] += pts;
  // 一波流追踪：同队连续得分累加，对方一得分即切换归零
  if (S.run.team === team) S.run.pts += pts;
  else S.run = { team, pts };
}
function addMomentum(team, v) {
  const other = team === "knicks" ? "spurs" : "knicks";
  S.momentum[team] = clamp(S.momentum[team] + v, 0, 40);
  S.momentum[other] = clamp(S.momentum[other] - v * 0.6, 0, 40);
  S.boost.knicks *= 0.9; S.boost.spurs *= 0.9;
}

// 吹罚尺度/争议哨：不硬保送，只让尺度、漏判和心态波动自然影响比赛
function whistleEdge(team, isRim) {
  if (S.quarter < 3) return 0;
  const other = team === "knicks" ? "spurs" : "knicks";
  const diff = S.score[team] - S.score[other];
  if (diff <= -10) return clamp((-diff - 10) * (isRim ? 0.0022 : 0.001), 0, isRim ? 0.035 : 0.014);
  if (diff >= 14) return isRim ? -0.010 : -0.004;
  return 0;
}
function frustrateTeam(team, v) {
  S.refFrustration[team] = clamp((S.refFrustration[team] || 0) + v, 0, 24);
  S.momentum[team] = clamp(S.momentum[team] - v * 0.55, 0, 40);
  onCourtArr(team).forEach((p) => bumpHeat(p, -v * 0.65));
}
function refPressureText(kind, team, map = {}, chance = 1) {
  if (typeof OFFICIATING_FLAVOR === "undefined" || Math.random() > chance) return false;
  const pool = OFFICIATING_FLAVOR[kind];
  if (!pool || !pool.length) return false;
  pushFeed(team || "system", fill(rand(pool), map), { team, mini: true });
  return true;
}
function handleQuestionableCall(off, def, shooter, fouler, edge) {
  const chance = clamp(0.08 + Math.max(0, edge) * 2.2 + (S.refFrustration[def] || 0) * 0.004, 0.06, 0.22);
  if (Math.random() > chance) return;
  refPressureText("questionableFoul", def, { T: ROSTERS[off].name, D: ROSTERS[def].name, P: shooter.name, F: fouler.name }, 1);
  refPressureText("crowdPressure", "system", {}, 0.45);
  frustrateTeam(def, 4 + Math.max(0, edge) * 40);
}
function maybeNoCall(off, def, shooter, isRim, isThree) {
  if (isThree) return false;
  const edge = whistleEdge(off, isRim);
  let chance = isRim ? 0.10 : 0.045;
  if (edge < 0) chance += 0.035;      // 领先方冲击时，哨子不一定继续给
  if (edge > 0) chance -= 0.025;      // 落后方持续冲击时，漏哨概率略低
  if (Math.random() > clamp(chance, 0.02, 0.14)) return false;
  refPressureText("noCall", off, { T: ROSTERS[off].name, D: ROSTERS[def].name, P: shooter.name }, 1);
  refPressureText("crowdPressure", "system", {}, 0.35);
  frustrateTeam(off, isRim ? 4.5 : 3);
  return true;
}
function decayRefFrustration() {
  S.refFrustration.knicks *= 0.94;
  S.refFrustration.spurs *= 0.94;
}
function setClutchAftershock(team, val, ticks, kind) {
  S.clutchAftershock = { team, val, ticks, kind };
}
function clutchAftershockMod(team) {
  const a = S.clutchAftershock;
  if (!a || !a.team || a.ticks <= 0) return 0;
  return a.team === team ? a.val : -a.val * 0.6;
}
function decayClutchAftershock() {
  const a = S.clutchAftershock;
  if (!a || a.ticks <= 0) return;
  a.ticks--;
  a.val *= 0.82;
  if (a.ticks <= 0 || Math.abs(a.val) < 0.01) S.clutchAftershock = { team: null, val: 0, ticks: 0, kind: "" };
}

// 指挥台长期不操作：对手逐步摸透套路，形成命中/失误惩罚；有效指挥可清除
function updateCoachTargeting() {
  if (!S.myTeam || S.subWindow || S.decisionPending || S.gameOver) return;
  S.coachIdle++;
  const nextLevel = clamp(Math.floor((S.coachIdle - 14) / 6), 0, 8);
  if (nextLevel <= S.targetLevel) return;
  S.targetLevel = nextLevel;
  addMomentum(S.oppTeam, 2);
  const severe = S.targetLevel >= 4;
  pushFeed("system", severe
    ? `⚠️ 对手已经连续读到你的布置！${ROSTERS[S.oppTeam].name}开始提前站位，再不变招会持续吃亏。`
    : `📡 ${ROSTERS[S.oppTeam].name}教练组正在针对你的固定套路，建议调整战术、叫暂停或换人打乱节奏。`);
  maybeRichFeed("broadcast", "system", {}, 0.55);
}
function coachTargetPenalty(kind) {
  if (!S.targetLevel) return 0;
  return kind === "tov" ? S.targetLevel * 0.005 : S.targetLevel * 0.007;
}
function noteCoachAction(label) {
  if (!S.myTeam) return;
  const wasTargeted = S.targetLevel > 0;
  S.coachIdle = 0;
  S.targetLevel = 0;
  S.boost[S.myTeam] += wasTargeted ? 10 : 5;
  addMomentum(S.myTeam, wasTargeted ? 5 : 2);
  if (wasTargeted) {
    pushFeed(S.myTeam, `📋 ${label}奏效：及时变招打乱了对手预判，被针对状态解除。`, { team: S.myTeam, mini: true });
  }
}

// 个人气势：±调整、每回合衰减、暂停回暖
function bumpHeat(p, v) { if (p) p.heat = clamp((p.heat || 0) + v, -100, 100); }
function decayHeat() {            // 每回合向 0 缓慢回归，避免手感长期锁死
  ["knicks", "spurs"].forEach((t) =>
    ROSTERS[t].players.forEach((p) => { p.heat = (p.heat || 0) * 0.95; }));
  decayRefFrustration();
  decayClutchAftershock();
}
function liftHeat(team, v) {      // 叫暂停：在场球员士气回稳，低迷者拉回更多
  onCourtArr(team).forEach((p) => {
    p.heat = clamp((p.heat || 0) + ((p.heat || 0) < 0 ? v * 1.6 : v * 0.4), -100, 100);
  });
}
// 个人气势 → 显示标签
function heatTag(p) {
  const h = p.heat || 0;
  if (h >= 40) return { t: "🔥 火热", c: "hot" };
  if (h >= 18) return { t: "↗ 回暖", c: "warm" };
  if (h <= -40) return { t: "🧊 低迷", c: "cold" };
  if (h <= -18) return { t: "↘ 下滑", c: "cool" };
  return { t: "普通", c: "flat" };
}

// ----------------- 直播流渲染 -----------------
function pushFeed(team, text, opt = {}) {
  const feed = $("feed");
  const row = document.createElement("div");
  row.className = "feed-row";
  if (opt.score) row.classList.add(team === S.myTeam ? "score-mine" : "score-opp");
  if (opt.big) row.classList.add("big-play");
  if (opt.mini) row.classList.add("mini");
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
}

function fmtClock(sec) {
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ----------------- 前四场真实素材：场内外氛围混播 -----------------
function richPool(stage) {
  if (typeof SERIES_ATMOSPHERE === "undefined") return null;
  return SERIES_ATMOSPHERE[stage] || null;
}
function richFeed(stage, team, map = {}, chance = 1, opt = {}) {
  const pool = richPool(stage);
  if (!pool || !pool.length || Math.random() > chance) return false;
  const text = fill(rand(pool), map);
  pushFeed(team || "system", text, { team, mini: opt.mini !== false, big: !!opt.big });
  return true;
}
function maybeRichFeed(stage, team, map = {}, chance = 0.18, opt = {}) {
  return richFeed(stage, team, map, chance, opt);
}
function maybeGameTexture(off, def, handler) {
  const m = { T: ROSTERS[off].name, D: ROSTERS[def].name, O: handler.name, P: handler.name };
  maybeRichFeed("bringUp", off, m, 0.24);
  maybeRichFeed("offBall", off, m, 0.12);
  maybeRichFeed("crowd", "system", m, 0.08);
  maybeRichFeed("broadcast", "system", m, 0.025);
  if (S.quarter >= 4 && S.clock <= 120) maybeRichFeed("late", "system", m, 0.28, { big: true });
}
function scoreContext(team) {
  const other = team === "knicks" ? "spurs" : "knicks";
  return { T: ROSTERS[team].name, D: ROSTERS[other].name };
}

// ----------------- 视图切换 -----------------
function setView(v) {
  S.view = v;
  $("feed").classList.toggle("hidden", v !== "feed");
  $("box-wrap").classList.toggle("hidden", v !== "box");
  $("cmd-wrap").classList.toggle("hidden", v !== "cmd");
  $("tab-feed").classList.toggle("active", v === "feed");
  $("tab-box").classList.toggle("active", v === "box");
  $("tab-cmd").classList.toggle("active", v === "cmd");
  if (v === "box") renderBox();
  if (v === "cmd") renderCmd();
}

// ----------------- box score -----------------
function teamTotals(team) {
  const tot = { pts: 0, reb: 0, ast: 0, blk: 0, stl: 0, tov: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 };
  ROSTERS[team].players.forEach((p) => {
    const s = p.st;
    tot.pts += s.pts; tot.reb += s.oreb + s.dreb; tot.ast += s.ast;
    tot.blk += s.blk; tot.stl += s.stl; tot.tov += s.tov;
    tot.fgm += s.fgm; tot.fga += s.fga; tot.tpm += s.tpm; tot.tpa += s.tpa;
    tot.ftm += s.ftm; tot.fta += s.fta;
  });
  return tot;
}

function renderBox() {
  ["knicks", "spurs"].forEach((t) => {
    const tbody = $("box-" + t);
    if (!ROSTERS[t].players[0].st) return;
    const players = [...ROSTERS[t].players].sort((a, b) => b.st.sec - a.st.sec);
    const rows = players.map((p) => {
      const s = p.st;
      const min = Math.round(s.sec / 60);    // 真实分钟（已是真实秒）
      const reb = s.oreb + s.dreb;
      const on = isOnCourt(t, p.id);
      return `<tr class="${on ? "on" : ""}">
        <td class="bx-name">${p.name}${on ? '<i class="onx">●</i>' : ""}</td>
        <td>${min}</td>
        <td class="bx-pts">${s.pts}</td>
        <td>${reb}</td>
        <td>${s.ast}</td>
        <td>${s.blk}</td>
        <td>${s.stl}</td>
        <td>${s.ftm}-${s.fta}</td>
        <td>${s.tov}</td>
        <td>${s.tpm}-${s.tpa}</td>
        <td>${s.fgm}-${s.fga}</td>
      </tr>`;
    }).join("");
    const tt = teamTotals(t);
    const totRow = `<tr class="bx-total">
      <td class="bx-name">合计</td><td>—</td>
      <td class="bx-pts">${tt.pts}</td><td>${tt.reb}</td><td>${tt.ast}</td>
      <td>${tt.blk}</td><td>${tt.stl}</td><td>${tt.ftm}-${tt.fta}</td>
      <td>${tt.tov}</td><td>${tt.tpm}-${tt.tpa}</td><td>${tt.fgm}-${tt.fga}</td></tr>`;
    tbody.innerHTML = rows + totRow;
    $("box-name-" + t).textContent = ROSTERS[t].name + "  " + tt.pts;
  });
}

function updateScoreboard() {
  $("sb-knicks").textContent = S.score.knicks;
  $("sb-spurs").textContent = S.score.spurs;
  $("sb-q").textContent = S.quarter <= 4 ? `第${S.quarter}节` : `加时${S.quarter - 4}`;
  $("sb-clock").textContent = fmtClock(S.clock);
  $("sb-knicks").parentElement.classList.toggle("has-ball", S.possessionTeam === "knicks");
  $("sb-spurs").parentElement.classList.toggle("has-ball", S.possessionTeam === "spurs");
  const mk = S.momentum.knicks, ms = S.momentum.spurs;
  const tot = mk + ms || 1;
  $("mom-knicks").style.width = (mk / tot * 100) + "%";
  $("mom-spurs").style.width = (ms / tot * 100) + "%";
  const dot = $("sb-dot");
  if (dot) {
    if (S.gameOver) dot.textContent = "比赛结束";
    else if (S.subWindow) dot.textContent = S.subBy ? `⏸ ${ROSTERS[S.subBy].short} 暂停·布置中` : "⏸ 节间·布置中";
    else if (!S.running) dot.textContent = "⏸ 已暂停";
    else dot.textContent = "● 直播中";
  }
  if (S.view === "box") renderBox();
  if (S.view === "cmd") updateStaminaBars();
}

// 暂停次数显示（我方 / 对方）
function updateTimeoutInfo() {
  const el = $("timeout-info");
  if (!el || !S.myTeam) return;
  const n = S.timeouts[S.myTeam];
  el.textContent = `暂停 我${n}·对${S.timeouts[S.oppTeam]}`;
  el.classList.toggle("none", n <= 0);
}

// 直播速度档位文字反馈
function updateSpeedLabel() {
  const el = $("speed-label");
  if (!el) return;
  const s = S.speed;
  el.textContent = s >= 2200 ? "极慢" : s >= 1600 ? "很慢" : s >= 1100 ? "较慢" : s >= 700 ? "正常" : s >= 450 ? "较快" : "极快";
}

/* ====================================================================
   指挥台：战术（见招拆招）+ 换人
   ==================================================================== */

// 找克制对手「进攻」的最佳防守
function bestCounterDef(oppOff) {
  let best = "man", bestScore = -99;
  Object.keys(DEF_SCHEMES).forEach((d) => {
    const b = DEF_BASE[d];
    const m = (MATCHUP[oppOff] && MATCHUP[oppOff][d]) || 0;   // 进攻方占优=正，对我不利
    const score = -(m) - (b.makeRim + b.make3 + b.makeMid) / 3 + b.to + b.blk * 0.5;
    if (score > bestScore) { bestScore = score; best = d; }
  });
  return best;
}
// 找破解对手「防守」的最佳进攻
function bestCounterOff(oppDef) {
  let best = "balanced", bestScore = -99;
  Object.keys(OFF_SCHEMES).forEach((o) => {
    const m = (MATCHUP[o] && MATCHUP[o][oppDef]) || 0;
    if (m > bestScore) { bestScore = m; best = o; }
  });
  return best;
}

function renderCmd() {
  if (!S.myTeam) return;
  const opp = S.oppTeam, my = S.myTeam;
  const oOff = S.scheme[opp].off, oDef = S.scheme[opp].def;

  renderMorale();   // 双方球队气势 + 个人手感速览

  // 情报区
  const recDef = bestCounterDef(oOff), recOff = bestCounterOff(oDef);
  $("intel-box").innerHTML =
    `<div class="intel-row"><span class="il-lbl">对手进攻</span>` +
      `<b>${OFF_SCHEMES[oOff].icon} ${OFF_SCHEMES[oOff].name}</b>` +
      `<span class="il-tip">→ 建议防守 <b>${DEF_SCHEMES[recDef].icon}${DEF_SCHEMES[recDef].name}</b></span></div>` +
    `<div class="intel-row"><span class="il-lbl">对手防守</span>` +
      `<b>${DEF_SCHEMES[oDef].icon} ${DEF_SCHEMES[oDef].name}</b>` +
      `<span class="il-tip">→ 建议进攻 <b>${OFF_SCHEMES[recOff].icon}${OFF_SCHEMES[recOff].name}</b></span></div>`;

  // 我方进攻战术按钮
  const offBox = $("my-off");
  offBox.innerHTML = "";
  Object.keys(OFF_SCHEMES).forEach((k) => offBox.appendChild(schemeBtn(k, OFF_SCHEMES[k], "off", recOff)));
  // 我方防守战术按钮
  const defBox = $("my-def");
  defBox.innerHTML = "";
  Object.keys(DEF_SCHEMES).forEach((k) => defBox.appendChild(schemeBtn(k, DEF_SCHEMES[k], "def", recDef)));

  renderSubs();
}

function schemeBtn(key, info, kind, recKey) {
  const b = document.createElement("button");
  const active = S.scheme[S.myTeam][kind] === key;
  b.className = "sch-btn" + (active ? " active" : "") + (key === recKey ? " rec" : "");
  b.innerHTML = `<span class="sch-name">${info.icon} ${info.name}${key === recKey ? ' <i class="rec-dot">克制</i>' : ""}</span>` +
                `<span class="sch-desc">${info.desc}</span>`;
  b.onclick = () => setMyScheme(kind, key);
  return b;
}

function setMyScheme(kind, key) {
  if (S.scheme[S.myTeam][kind] === key) return;
  S.scheme[S.myTeam][kind] = key;
  const info = kind === "off" ? OFF_SCHEMES[key] : DEF_SCHEMES[key];
  const tpl = kind === "off" ? SCHEME_FLAVOR.myOff : SCHEME_FLAVOR.myDef;
  pushFeed(S.myTeam, fill(tpl, { N: info.name, D: info.desc }), { team: S.myTeam });
  // 即时提示是否克制对手
  if (kind === "def") {
    const m = (MATCHUP[S.scheme[S.oppTeam].off] && MATCHUP[S.scheme[S.oppTeam].off][key]) || 0;
    if (m < -0.03) pushFeed(S.myTeam, SCHEME_FLAVOR.counterGood, { team: S.myTeam, mini: true });
  } else {
    const m = (MATCHUP[key] && MATCHUP[key][S.scheme[S.oppTeam].def]) || 0;
    if (m > 0.04) pushFeed(S.myTeam, SCHEME_FLAVOR.counterGood, { team: S.myTeam, mini: true });
    else if (m < -0.04) pushFeed(S.myTeam, SCHEME_FLAVOR.counterBad, { team: S.myTeam, mini: true });
  }
  renderCmd();
}

// 球队气势对比 + 个人手感速览（布置战术时参考）
function renderMorale() {
  const box = $("morale-box");
  if (!box || !S.myTeam) return;
  const mk = S.momentum.knicks, ms = S.momentum.spurs;
  const tot = mk + ms || 1;
  const my = S.myTeam, opp = S.oppTeam;
  const lead = mk === ms ? "两队气势相当，比拼临场调度"
    : (S.momentum[my] > S.momentum[opp]
        ? `<b>${ROSTERS[my].name}</b> 气势占优，趁势加压`
        : `<b>${ROSTERS[opp].name}</b> 气头正盛，先稳住别乱`);
  // 我方场上最热 / 最冷
  const onc = onCourtArr(my);
  const hot = onc.reduce((a, b) => ((b.heat || 0) > (a.heat || 0) ? b : a));
  const cold = onc.reduce((a, b) => ((b.heat || 0) < (a.heat || 0) ? b : a));
  let hint = "";
  if ((hot.heat || 0) >= 18) hint += `🔥 ${hot.name} 手感火热，多给他球。`;
  if ((cold.heat || 0) <= -18) hint += `🧊 ${cold.name} 状态低迷，可考虑换下或叫暂停回暖。`;
  if ((S.refFrustration[my] || 0) >= 8) hint += ` 🧯 我方被吹罚情绪影响，叫暂停或打简单球能稳住。`;
  if (S.targetLevel > 0) hint += ` ⚠️ 对手针对层数 ${S.targetLevel}：建议马上变阵/暂停/换人。`;
  if (!hint) hint = "场上手感平稳。";
  box.innerHTML =
    `<div class="morale-head"><span class="mh-k">尼克斯 ${Math.round(mk)}</span>` +
    `<span>⚡ 球队气势</span><span class="mh-s">${Math.round(ms)} 马刺</span></div>` +
    `<div class="morale-bar"><div class="mb-k" style="width:${mk / tot * 100}%"></div>` +
    `<div class="mb-s" style="width:${ms / tot * 100}%"></div></div>` +
    `<div class="morale-tip">${lead} · ${hint}</div>`;
}

// 换人区渲染
function renderSubs() {
  const my = S.myTeam;
  const court = $("sub-court"), bench = $("sub-bench");
  court.innerHTML = ""; bench.innerHTML = "";
  onCourtArr(my).forEach((p) => court.appendChild(playerChip(p, true)));
  benchArr(my).forEach((p) => bench.appendChild(playerChip(p, false)));
  const hintEl = $("sub-hint");
  if (!S.subWindow) {
    hintEl.textContent = "🔒 比赛进行中不能换人 —— 叫暂停或等节间休息";
    hintEl.classList.add("lock");
  } else {
    hintEl.classList.remove("lock");
    hintEl.textContent = S.subSel
      ? `已选中 ${ROSTERS[my].players.find((x) => x.id === S.subSel.id).name}，点击替补完成换人`
      : "点击场上球员→再点替补，即可换人";
  }
}

function playerChip(p, onCourt) {
  const d = document.createElement("button");
  const sel = S.subSel && S.subSel.id === p.id;
  const locked = !S.subWindow;
  const ht = heatTag(p);
  const glow = ht.c === "hot" ? " hot-glow" : (ht.c === "cold" ? " cold-glow" : "");
  d.className = "pl-chip" + (onCourt ? " on" : " bench") + (sel ? " sel" : "") + (locked ? " locked" : "") + glow;
  const col = p.stamina > 60 ? "var(--green)" : (p.stamina > 32 ? "#e8b53a" : "var(--red)");
  d.innerHTML =
    `<div class="pl-top"><span class="pl-pos">${p.pos}</span><span class="pl-nm">${p.name}${p.star ? " ★" : ""}</span>` +
    `<span class="heat-tag ${ht.c}" id="heat-${p.id}">${ht.t}</span></div>` +
    `<div class="pl-stat">${p.st ? p.st.pts : 0}分 ${p.st ? p.st.oreb + p.st.dreb : 0}板 ${p.st ? p.st.ast : 0}助</div>` +
    `<div class="stam-bar"><i id="stam-${p.id}" style="width:${p.stamina}%;background:${col}"></i></div>` +
    `<div class="stam-num">体力 ${Math.round(p.stamina)}</div>`;
  d.onclick = () => onChipClick(p, onCourt);
  return d;
}

function onChipClick(p, onCourt) {
  if (!S.subWindow) return;   // 非窗口期锁定换人
  const my = S.myTeam;
  if (onCourt) {
    S.subSel = S.subSel && S.subSel.id === p.id ? null : { team: my, id: p.id };
  } else {
    if (S.subSel) {
      applySub(my, S.subSel.id, p.id, true);
      S.subSel = null;
    } else {
      // 没选场上：默认换下体力最低的首发
      const tired = onCourtArr(my).sort((a, b) => a.stamina - b.stamina)[0];
      applySub(my, tired.id, p.id, true);
    }
  }
  renderSubs();
}

function updateStaminaBars() {
  [...onCourtArr(S.myTeam), ...benchArr(S.myTeam)].forEach((p) => {
    const el = $("stam-" + p.id);
    if (!el) return;
    const col = p.stamina > 60 ? "var(--green)" : (p.stamina > 32 ? "#e8b53a" : "var(--red)");
    el.style.width = p.stamina + "%";
    el.style.background = col;
    const ht = $("heat-" + p.id);
    if (ht) { const tg = heatTag(p); ht.textContent = tg.t; ht.className = "heat-tag " + tg.c; }
  });
  renderMorale();
}

/* ====================================================================
   对手 AI：见招拆招地变阵（针对玩家战术 + 看局势）
   ==================================================================== */
function aiThink(forceQuarter) {
  if (!S.oppTeam) return;
  const opp = S.oppTeam;
  const idty = TEAM_TACTICS[opp];                  // 对手球队战术身份
  const diff = S.score[opp] - S.score[S.myTeam];   // 对手视角分差
  const prevOff = S.scheme[opp].off, prevDef = S.scheme[opp].def;

  // ---- 对手进攻：以球队风格为主，局势为辅 ----
  let newOff = prevOff;
  if (Math.random() < (forceQuarter ? 0.9 : 0.5)) {
    if (diff <= -8)      newOff = rand(["pace", "perimeter", "iso"]);   // 落后搏命：提速+外线+核心强攻
    else if (diff >= 10) newOff = rand(["motion", "balanced"]);         // 领先稳住
    else                 newOff = rand(idty.offPool);                   // 常态：打自己的招牌
  }

  // ---- 对手防守：针对玩家进攻战术 + 保留球队防守底色 ----
  let newDef = prevDef;
  if (Math.random() < (forceQuarter ? 0.9 : 0.55)) {
    const myOff = S.scheme[S.myTeam].off;
    const counterMap = {
      inside: ["zone", "paint"], perimeter: ["man", "switch"], iso: ["double", "zone"],
      pace: ["press", "paint"], motion: ["switch", "man"], balanced: ["man", "switch", "zone"],
    };
    // 60% 针对玩家克制，40% 回到球队招牌防守
    newDef = (Math.random() < 0.6)
      ? rand(counterMap[myOff] || ["man"])
      : rand(idty.defPool);
  }

  if (newOff !== prevOff) {
    S.scheme[opp].off = newOff;
    pushFeed(opp, fill(SCHEME_FLAVOR.oppOff, { T: ROSTERS[opp].name, N: OFF_SCHEMES[newOff].name }), { team: opp, mini: true });
  }
  if (newDef !== prevDef) {
    S.scheme[opp].def = newDef;
    pushFeed(opp, fill(SCHEME_FLAVOR.oppDef, { T: ROSTERS[opp].name, N: DEF_SCHEMES[newDef].name }), { team: opp, mini: true });
  }
  if (S.view === "cmd") renderCmd();
}

// ----------------- 教练决策（关键时刻临时士气） -----------------
function shouldAskDecision() {
  if (S.decisionPending) return false;
  const diff = Math.abs(S.score.knicks - S.score.spurs);
  const lateGame = S.quarter >= 4 && S.clock <= 120;
  if (lateGame && diff <= 6 && Math.random() < 0.12) return true;
  return false;
}

const DECISIONS = [
  { key: "iso", label: "🎯 单打核心", desc: "把球交给当家球星强攻，搏一记关键得分",
    apply: () => { S.boost[S.myTeam] += 18; return `主教练叫停，布置由${starName(S.myTeam)}持球单打！`; } },
  { key: "press", label: "🛡️ 全场紧逼", desc: "提升防守强度，逼迫对手失误",
    apply: () => { S.boost[S.myTeam] += 10; addMomentum(S.myTeam, 8); return `${ROSTERS[S.myTeam].name}祭出全场紧逼，防守强度拉满！`; } },
  { key: "three", label: "🔥 死亡三分", desc: "拉开空间外线强投，要么封神要么打铁",
    apply: () => { S.boost[S.myTeam] += 14; return `${ROSTERS[S.myTeam].name}摆出全外线阵容，准备外线发炮！`; } },
  { key: "calm", label: "🧊 稳住节奏", desc: "耗时间打阵地，减少失误稳住分差",
    apply: () => { S.boost[S.myTeam] += 6; S.clock = Math.max(8, S.clock - 14); return `${ROSTERS[S.myTeam].name}选择稳住节奏，耗时间打阵地。`; } },
];

function starName(team) {
  const s = ROSTERS[team].players.find((p) => p.star);
  return s ? s.name : ROSTERS[team].players[0].name;
}

function askDecision() {
  S.decisionPending = true;
  clearTimeout(S.timer);
  const bar = $("decision-bar");
  bar.classList.remove("hidden");
  const diff = S.score[S.myTeam] - S.score[S.oppTeam];
  $("decision-title").textContent =
    `⏱ 关键时刻！第${S.quarter}节 ${fmtClock(S.clock)} · ` +
    (diff >= 0 ? `你领先 ${diff} 分` : `你落后 ${-diff} 分`) + ` — 怎么打？`;
  const opts = $("decision-opts");
  opts.innerHTML = "";
  const picks = [...DECISIONS].sort(() => Math.random() - 0.5).slice(0, 3);
  picks.forEach((d) => {
    const b = document.createElement("button");
    b.className = "decision-opt";
    b.innerHTML = `<span class="do-label">${d.label}</span><span class="do-desc">${d.desc}</span>`;
    b.onclick = () => {
      const msg = d.apply();
      pushFeed(S.myTeam, "📋 " + msg, { team: S.myTeam });
      bar.classList.add("hidden");
      S.decisionPending = false;
      if (S.running) scheduleNext(500);
    };
    opts.appendChild(b);
  });
}

/* =========================================================
   关键球系统：「最后一攻交给你」
   末节/加时关键时刻，把球交给谁由你决定——养热的手感、
   大心脏球星、搏命三分，成功率明牌，决策直接左右胜负。
   ========================================================= */

// 三层触发：3=终极一攻 2=决胜回合 0=不触发（仅我方进攻回合）
function getClutchTier() {
  if (S.possessionTeam !== S.myTeam) return 0;
  if (S.quarter < QUARTERS) return 0;            // 仅第4节及加时
  const ad = Math.abs(S.score[S.myTeam] - S.score[S.oppTeam]);
  if (S.clock <= 24 && ad <= 3) return 3;        // 终极一攻：≤24秒 且 分差≤3
  if (S.clock <= 120 && ad <= 5) return 2;       // 决胜回合：≤2:00 且 分差≤5
  return 0;
}

function shouldAskClutch() {
  if (S.decisionPending) return false;
  const tier = getClutchTier();
  if (tier === 0) return false;
  if (tier === 3) return true;                   // 终极一攻：必弹
  // 决胜回合：高频但留出间隔，避免同一波连弹
  if (S.tickCount - (S.lastClutch ?? -99) < 2) return false;
  return Math.random() < 0.7;
}

const CLUTCH_PACKS = {
  star: {
    label: "👑 巨星接管", short: "巨星接管", risk: "抗压/包夹/争议哨",
    note: "让核心读秒处理，但结果可能是神仙球、分球、造犯规或灾难失误。",
  },
  team: {
    label: "🕸️ 团队执行", short: "完整战术", risk: "空切/底角/发球/24秒",
    note: "跑完整战术找最合理机会，可能成就奇兵，也可能被对手读穿。",
  },
  gamble: {
    label: "🔥 赌博变化", short: "赌一把", risk: "三分/紧逼/长篮板/混乱",
    note: "制造高波动回合，可能瞬间改命，也可能直接崩盘。",
  },
};
function packLabel(k) { return (CLUTCH_PACKS[k] || CLUTCH_PACKS.star).short; }
function clutchScore(p, pack) {
  let c = 0.44;
  if (pack === "star") c += 0.04;
  if (pack === "team") c += 0.02;
  if (pack === "gamble") c -= 0.04;
  c += (p.off - 80) * 0.005;
  c += (p.heat || 0) * 0.0015;
  c += ((p.clutch || 1) - 1) * 0.45;
  c += S.momentum[S.myTeam] * 0.0026;
  c += clutchAftershockMod(S.myTeam) * 0.02;
  c -= (S.refFrustration[S.myTeam] || 0) * 0.0012;
  c -= (defPressure(S.oppTeam) - 72) * 0.0032;
  c += (staminaFactor(p) - 1) * 0.34;
  if (pack === "gamble") c += (p.thr - 0.4) * 0.18;
  if (S.scheme[S.oppTeam].def === "double" && pack === "star") c -= 0.08;
  return clamp(c, 0.16, 0.78);
}
function chanceTier(c) {
  if (c >= 0.60) return { t: "情绪倾向：稳",   cls: "ct-hi" };
  if (c >= 0.48) return { t: "情绪倾向：可控", cls: "ct-mid" };
  if (c >= 0.38) return { t: "情绪倾向：高波动", cls: "ct-low" };
  return { t: "情绪倾向：搏命", cls: "ct-risk" };
}
function bestClutchPlayer(sortFn) {
  return onCourtArr(S.myTeam).slice().sort(sortFn)[0];
}
function pickClutchOptions() {
  const diff = S.score[S.myTeam] - S.score[S.oppTeam];
  const star = bestClutchPlayer((a, b) => (b.star ? 100 : 0) + b.off + (b.heat || 0) * 0.15 - ((a.star ? 100 : 0) + a.off + (a.heat || 0) * 0.15));
  const hub = bestClutchPlayer((a, b) => (b.pg + b.off * 0.35 + (b.heat || 0) * 0.1) - (a.pg + a.off * 0.35 + (a.heat || 0) * 0.1));
  const gambler = diff < 0
    ? bestClutchPlayer((a, b) => (b.thr * 100 + b.off * 0.35 + (b.heat || 0) * 0.12) - (a.thr * 100 + a.off * 0.35 + (a.heat || 0) * 0.12))
    : bestClutchPlayer((a, b) => (b.def + b.pg * 0.4 + (b.heat || 0) * 0.08) - (a.def + a.pg * 0.4 + (a.heat || 0) * 0.08));
  const raw = [
    { pack: "star", p: star, title: CLUTCH_PACKS.star.label, note: CLUTCH_PACKS.star.note, risk: CLUTCH_PACKS.star.risk },
    { pack: "team", p: hub, title: CLUTCH_PACKS.team.label, note: CLUTCH_PACKS.team.note, risk: CLUTCH_PACKS.team.risk },
    { pack: "gamble", p: gambler, title: CLUTCH_PACKS.gamble.label, note: CLUTCH_PACKS.gamble.note, risk: CLUTCH_PACKS.gamble.risk },
  ].filter((o) => o.p);
  raw.forEach((o) => (o.chance = clutchScore(o.p, o.pack)));
  return raw;
}
function clutchPick(rows) {
  const total = rows.reduce((a, r) => a + Math.max(0, r.w), 0);
  let r = Math.random() * total;
  for (const row of rows) { r -= Math.max(0, row.w); if (r <= 0) return row.k; }
  return rows[rows.length - 1].k;
}
function clutchTeammate(primary, preferThree) {
  const cand = onCourtArr(S.myTeam).filter((p) => p.id !== primary.id);
  return pickByWeight(cand, (p) => preferThree ? (p.thr * 100 + p.off * 0.3) : (p.off + p.reb * 0.3 + p.pg * 0.2));
}
function recordClutchShot(team, p, isThree, made) {
  const pts = isThree ? 3 : 2;
  p.st.fga++; if (isThree) p.st.tpa++;
  if (made) { p.st.fgm++; if (isThree) p.st.tpm++; p.st.pts += pts; addScore(team, pts); }
  return pts;
}
function askClutchPlay() {
  const tier = getClutchTier();
  S.clutchTier = tier;
  S.lastClutch = S.tickCount;
  S.decisionPending = true;
  clearTimeout(S.timer);
  $("decision-bar").classList.add("hidden");
  const opts = pickClutchOptions();
  const diff = S.score[S.myTeam] - S.score[S.oppTeam];
  const stand = diff > 0 ? `你领先 ${diff} 分` : diff < 0 ? `你落后 ${-diff} 分` : "战成平手";
  const mo = S.momentum[S.myTeam], moOpp = S.momentum[S.oppTeam];
  const moTxt = mo > moOpp + 4 ? "气势在我" : moOpp > mo + 4 ? "对手气势更盛" : "气势胶着";
  $("clutch-title").textContent = tier === 3
    ? `🔥 终极一攻！第${S.quarter}节 ${fmtClock(S.clock)} · ${stand}`
    : `⏱ 决胜回合 第${S.quarter}节 ${fmtClock(S.clock)} · ${stand}`;
  $("clutch-meta").textContent = `${moTxt} · 选择战术意图，不是选择固定结果`;
  const wrap = $("clutch-opts");
  wrap.innerHTML = "";
  opts.forEach((o) => {
    const tier2 = chanceTier(o.chance);
    const ht = heatTag(o.p);
    const b = document.createElement("button");
    b.className = "clutch-opt";
    b.innerHTML =
      `<div class="co-top"><span class="co-name">${o.title}</span><span class="heat-tag ${ht.c}">${ht.t}</span></div>` +
      `<div class="co-play">核心触发点：${o.p.name}</div>` +
      `<div class="co-note">${o.note}</div>` +
      `<div class="co-note">可能剧情：${o.risk}</div>` +
      `<div class="co-chance ${tier2.cls}">${tier2.t}</div>`;
    b.onclick = () => resolveClutch(o);
    wrap.appendChild(b);
  });
  $("clutch-bar").classList.remove("hidden");
}
function resolveClutch(opt) {
  $("clutch-bar").classList.add("hidden");
  noteCoachAction("关键战术选择");
  const p = opt.p, pack = opt.pack, def = S.oppTeam;
  const tier = S.clutchTier || 2;
  const preDiff = S.score[S.myTeam] - S.score[def];
  const defender = pickByWeight(onCourtArr(def), (d) => d.def + (styleOf(d).blk || 1) * 12 + (styleOf(d).stl || 1) * 10);
  pushFeed(S.myTeam, `📋 关键回合选择【${packLabel(pack)}】，${p.name}是第一触发点。`, { team: S.myTeam, big: true });

  let outcome;
  if (pack === "star") {
    outcome = clutchPick([
      { k: "heroMake", w: 34 * opt.chance }, { k: "kickout", w: 12 }, { k: "foul", w: 12 },
      { k: "blocked", w: 7 }, { k: "turnover", w: 8 + (S.refFrustration[S.myTeam] || 0) * 0.4 },
      { k: "noCall", w: 7 }, { k: "miss", w: 20 * (1 - opt.chance) },
    ]);
  } else if (pack === "team") {
    outcome = clutchPick([
      { k: "teamMake", w: 30 * opt.chance }, { k: "cut", w: 14 }, { k: "roleMiss", w: 16 * (1 - opt.chance) },
      { k: "lateClock", w: 9 }, { k: "turnover", w: 8 }, { k: "oreb", w: 8 },
    ]);
  } else {
    outcome = clutchPick([
      { k: "gambleThree", w: 24 * opt.chance }, { k: "stealRunout", w: 12 }, { k: "foulGame", w: 11 },
      { k: "longRebound", w: 9 }, { k: "blownCoverage", w: 10 }, { k: "wildMiss", w: 22 * (1 - opt.chance) },
      { k: "review", w: 6 },
    ]);
  }

  let overlayKind = "fail", overlayBig = "没 成！", overlaySub = "关键回合没有兑现", delay = 1200;
  const teammate = clutchTeammate(p, outcome === "kickout" || outcome === "teamMake" || outcome === "gambleThree");
  const isThree = outcome === "kickout" || outcome === "teamMake" || outcome === "gambleThree" || outcome === "review";

  if (["heroMake", "kickout", "teamMake", "cut", "gambleThree", "review"].includes(outcome)) {
    const scorer = outcome === "heroMake" ? p : teammate;
    const pts = recordClutchShot(S.myTeam, scorer, isThree, true);
    if (scorer.id !== p.id) p.st.ast++;
    addMomentum(S.myTeam, outcome === "gambleThree" ? 14 : 11);
    bumpHeat(scorer, 28); bumpHeat(p, scorer.id === p.id ? 18 : 10);
    const leadTxt = preDiff < 0 && preDiff + pts >= 0 ? (preDiff + pts === 0 ? "绝平" : "反超") : "命中";
    if (outcome === "heroMake") pushFeed(S.myTeam, `🎯 ${p.name}顶着${defender.name}完成关键单打，${leadTxt}！`, { team: S.myTeam, score: true, big: true, pts });
    else if (outcome === "cut") pushFeed(S.myTeam, `🕸️ ${p.name}吸引防守，${teammate.name}空切接球上篮打进！`, { team: S.myTeam, score: true, big: true, pts });
    else if (outcome === "review") pushFeed(S.myTeam, `📺 ${teammate.name}底角三分命中！裁判回看是否踩线，全场屏住呼吸……`, { team: S.myTeam, score: true, big: true, pts });
    else pushFeed(S.myTeam, `🎯 ${p.name}把球送到空位，${teammate.name}${isThree ? "三分" : "中投"}命中！`, { team: S.myTeam, score: true, big: true, pts });
    setClutchAftershock(S.myTeam, 1.1, 4, "关键命中");
    overlayKind = "win"; overlayBig = leadTxt === "反超" ? "反 超！" : leadTxt === "绝平" ? "绝 平！" : "进 了！";
    overlaySub = `${scorer.name}关键${pts}分 · ${rand(CLUTCH_FLAVOR)}`;
  } else if (outcome === "foul" || outcome === "foulGame") {
    pushFeed(S.myTeam, `🧨 ${p.name}强突制造身体接触，裁判响哨！${defender.name}犯规。`, { team: S.myTeam, big: true });
    defender.st.pf++; S.fouls[def]++;
    handleQuestionableCall(S.myTeam, def, p, defender, whistleEdge(S.myTeam, true));
    shootFTs(S.myTeam, p, outcome === "foulGame" ? 2 : (Math.random() < 0.25 ? 3 : 2));
    setClutchAftershock(S.myTeam, 0.55, 3, "关键罚球");
    overlayKind = "win"; overlayBig = "上 线！"; overlaySub = `${p.name}用罚球决定命运`;
  } else if (outcome === "oreb" || outcome === "longRebound") {
    recordClutchShot(S.myTeam, p, pack === "gamble", false);
    const board = pickByWeight(onCourtArr(S.myTeam), (x) => x.reb + (x.id === p.id ? 8 : 0));
    board.st.oreb++;
    pushFeed(S.myTeam, `🧱 ${p.name}关键出手不中！但${board.name}在人群里点到前场篮板！`, { team: S.myTeam, big: true });
    const pts = recordClutchShot(S.myTeam, board, false, true);
    pushFeed(S.myTeam, `💥 ${board.name}二次进攻补进！替补席全冲起来了！`, { team: S.myTeam, score: true, big: true, pts });
    addMomentum(S.myTeam, 13); bumpHeat(board, 30);
    setClutchAftershock(S.myTeam, 1.0, 4, "二次进攻改命");
    overlayKind = "win"; overlayBig = "补 进！"; overlaySub = `${board.name}抢回命运`;
  } else if (outcome === "noCall") {
    recordClutchShot(S.myTeam, p, false, false);
    pushFeed(S.myTeam, `😤 ${p.name}杀到篮下倒地，没有哨！全场瞬间炸锅。`, { team: S.myTeam, big: true });
    maybeNoCall(S.myTeam, def, p, true, false);
    setClutchAftershock(def, 0.65, 3, "漏哨情绪");
    overlaySub = `${p.name}倒地没哨，情绪开始影响比赛`;
  } else if (outcome === "blocked") {
    recordClutchShot(S.myTeam, p, false, false);
    defender.st.blk++;
    pushFeed(S.myTeam, `🧱 ${defender.name}读到了路线，关键时刻封盖${p.name}！`, { team: S.myTeam, big: true });
    addMomentum(def, 12); bumpHeat(defender, 26); bumpHeat(p, -20);
    setClutchAftershock(def, 1.0, 4, "关键封盖");
    overlayBig = "大 帽！"; overlaySub = `${defender.name}把这一球摁了下来`;
  } else if (outcome === "blownCoverage") {
    const runout = pickByWeight(onCourtArr(def), (x) => x.off + x.pg * 0.4);
    runout.st.fga++; runout.st.fgm++; runout.st.pts += 2; addScore(def, 2);
    pushFeed(S.myTeam, `⚠️ 赌博变化被识破，${defender.name}断球，${runout.name}反击直接打成！`, { team: S.myTeam, big: true });
    addMomentum(def, 12); setClutchAftershock(def, 0.9, 4, "赌博失败");
    overlayBig = "被 破！"; overlaySub = "高风险选择付出代价";
  } else {
    const isTO = outcome === "turnover" || outcome === "lateClock" || outcome === "stealRunout";
    if (isTO) { p.st.tov++; pushFeed(S.myTeam, `💥 ${packLabel(pack)}执行崩了，${p.name}${outcome === "lateClock" ? "压到最后仓促处理，24秒违例" : "被夹击逼出失误"}！`, { team: S.myTeam, big: true }); }
    else { recordClutchShot(S.myTeam, p, pack === "gamble", false); pushFeed(S.myTeam, `🧱 ${p.name}关键出手不中，球馆里一片倒吸凉气。`, { team: S.myTeam, big: true }); }
    addMomentum(def, 9); bumpHeat(p, -18); frustrateTeam(S.myTeam, 5);
    setClutchAftershock(def, 0.75, 3, isTO ? "关键失误" : "关键打铁");
    overlaySub = isTO ? `${p.name}关键失误，压力来到下一回合` : `${p.name}没能把故事写完`;
  }

  updateScoreboard();
  showClutchOverlay(overlayKind, overlayBig, overlaySub);
  S.decisionPending = false;
  switchPossession();
  setTimeout(() => {
    if (S.gameOver) return;
    if (S.running) advanceAfterPossession(true);
  }, delay);
}

// 全屏关键球演出：win=闪白+金字，fail=红震
function showClutchOverlay(kind, big, sub) {
  const ov = $("clutch-overlay");
  if (!ov) return;
  ov.className = "clutch-overlay " + kind;     // 触发对应动画
  $("clutch-big").textContent = big;
  $("clutch-sub").textContent = sub;
  void ov.offsetWidth;                         // 重排以重启动画
  clearTimeout(S.clutchOvTimer);
  S.clutchOvTimer = setTimeout(() => ov.classList.add("hidden"), kind === "win" ? 1800 : 1300);
}

// ----------------- 单场结束 → 系列赛结算 -----------------
function endGame() {
  S.gameOver = true;
  S.running = false;
  clearTimeout(S.timer);

  const my = S.score[S.myTeam], opp = S.score[S.oppTeam];
  const iWon = my > opp;
  if (iWon) S.seriesWins[S.myTeam]++; else S.seriesWins[S.oppTeam]++;

  pushFeed("system", `🏁 G${S.gameNo} 终场：尼克斯 ${S.score.knicks} - ${S.score.spurs} 马刺`);

  setTimeout(() => {
    const seriesEnd = S.seriesWins.knicks === 4 || S.seriesWins.spurs === 4;
    $("result-score").textContent = `尼克斯 ${S.score.knicks} - ${S.score.spurs} 马刺`;
    $("result-title").textContent = iWon ? `G${S.gameNo} 拿下！` : `G${S.gameNo} 惜败`;
    $("result-series").textContent =
      `系列赛大比分 ${ROSTERS[S.myTeam].name} ${S.seriesWins[S.myTeam]} - ${S.seriesWins[S.oppTeam]} ${ROSTERS[S.oppTeam].name}`;
    renderResultBox();
    if (seriesEnd) showEnd(false);
    showPostGamePanel(seriesEnd, iWon);
  }, 1200);
}

function renderResultBox() {
  const all = [...ROSTERS.knicks.players, ...ROSTERS.spurs.players];
  const mvp = all.reduce((a, b) => (b.st.pts > a.st.pts ? b : a));
  const reb = mvp.st.oreb + mvp.st.dreb;
  const min = Math.round(mvp.st.sec / 60);
  const text = `本场之星 <b>${mvp.name}</b>：${min}分钟 ${mvp.st.pts}分 ${reb}板 ${mvp.st.ast}助 ` +
    `${mvp.st.blk}帽 ${mvp.st.stl}断（投篮${mvp.st.fgm}-${mvp.st.fga}）`;
  $("result-mvp").innerHTML = text;
  if ($("post-result-mvp")) $("post-result-mvp").innerHTML = text;
}

function hidePostGamePanel() {
  const p = $("postgame-panel");
  if (p) p.classList.add("hidden");
}

function showPostGamePanel(seriesEnd, iWon) {
  const panel = $("postgame-panel");
  if (!panel) return;
  panel.classList.toggle("champ", !!seriesEnd);
  panel.classList.remove("hidden");
  $("postgame-kicker").textContent = seriesEnd ? "系列赛结束" : "终场结算";
  $("post-result-score").textContent = `尼克斯 ${S.score.knicks} - ${S.score.spurs} 马刺`;
  if (seriesEnd) {
    $("post-result-title").textContent = $("end-title").textContent;
    $("post-result-series").innerHTML = $("end-text").innerHTML;
    $("post-btn-next").classList.add("hidden");
    $("post-btn-restart").classList.remove("hidden");
  } else {
    $("post-result-title").textContent = iWon ? `G${S.gameNo} 拿下！` : `G${S.gameNo} 惜败`;
    $("post-result-series").textContent =
      `系列赛大比分 ${ROSTERS[S.myTeam].name} ${S.seriesWins[S.myTeam]} - ${S.seriesWins[S.oppTeam]} ${ROSTERS[S.oppTeam].name}`;
    $("post-btn-next").classList.remove("hidden");
    $("post-btn-restart").classList.add("hidden");
  }
  showScreen("game");
  updateScoreboard();
}

function afterGameNext() { hidePostGamePanel(); S.gameNo++; enterSeries(); }

function showEnd(switchScreen = true) {
  const champ = S.seriesWins.knicks === 4 ? "knicks" : "spurs";
  const iWon = champ === S.myTeam;
  if (switchScreen) showScreen("end");
  if (iWon && S.myTeam === "knicks") {
    $("end-emoji").textContent = "🏆";
    $("end-title").textContent = "尼克斯总冠军！";
    $("end-text").innerHTML = "麦迪逊广场花园沸腾！你率队顶住马刺反扑，<b>终结53年总冠军荒</b>！";
  } else if (iWon && S.myTeam === "spurs") {
    $("end-emoji").textContent = "🏆";
    $("end-title").textContent = "马刺惊天大逆转夺冠！";
    $("end-text").innerHTML = "1-3落后连赢三场——你完成了载入史册的<b>惊天翻盘</b>，文班用冠军回敬了G4的崩盘！";
  } else {
    $("end-emoji").textContent = "💔";
    $("end-title").textContent = "系列赛结束";
    $("end-text").innerHTML = S.myTeam === "spurs"
      ? "逆转之路终止，但虽败犹荣。再来一次，改写结局！"
      : "领先3-1却被翻盘，痛彻心扉。再来一次，别让奇迹发生在对手身上！";
  }
}

window.addEventListener("DOMContentLoaded", startApp);
