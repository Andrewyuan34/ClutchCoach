/* =========================================================
   决战麦迪逊 · 2026 NBA总决赛
   背景：尼克斯 3-1 领先马刺，G4完成总决赛史上最大逆转（落后29分翻盘107-106）
   玩法：选队 → 打完 G5~G7 → 先到4胜夺冠，对手先到4胜则淘汰
   ========================================================= */

// ---------- 真实球员数据 ----------
const TEAMS = {
  knicks: {
    name: "尼克斯",
    short: "NY",
    players: [
      { name: "布伦森",   tag: "关键先生", off: 97, type3: false, clutch: 1.15 },
      { name: "阿奴诺比", tag: "攻防一体", off: 88, type3: true,  clutch: 1.05 },
      { name: "唐斯",     tag: "内线核心", off: 90, type3: false, clutch: 1.0  },
      { name: "布里奇斯", tag: "3D射手",  off: 86, type3: true,  clutch: 1.0  },
    ],
    defense: 94, // 阿奴诺比领衔的顶级防守
  },
  spurs: {
    name: "马刺",
    short: "SA",
    players: [
      { name: "文班亚马", tag: "超级新星", off: 95, type3: true,  clutch: 1.1  },
      { name: "福克斯",   tag: "极速后卫", off: 92, type3: false, clutch: 1.05 },
      { name: "瓦塞尔",   tag: "侧翼射手", off: 85, type3: true,  clutch: 1.0  },
      { name: "哈珀",     tag: "潜力新秀", off: 84, type3: false, clutch: 0.95 },
    ],
    defense: 91, // 文班护框
  },
};

// 系列赛赛程（G1-G4已结束，比分3-1）
const SCHEDULE = [
  { g: 5, home: "spurs",  venue: "圣安东尼奥" },
  { g: 6, home: "knicks", venue: "麦迪逊广场花园" },
  { g: 7, home: "knicks", venue: "麦迪逊广场花园" },
];

const POSS_PER_GAME = 8; // 每队8回合，节奏明快

// ---------- 全局状态 ----------
const G = {
  myTeam: null,    // 'knicks' | 'spurs'
  oppTeam: null,
  wins: { knicks: 3, spurs: 1 },
  scheduleIdx: 0,  // 指向 SCHEDULE
  // 单场状态
  score: { knicks: 0, spurs: 0 },
  poss: 0,         // 已完成回合数（双方合计推进用 turn 控制）
  myPoss: 0,
  oppPoss: 0,
  turn: null,      // 'mine' | 'opp'
  momentum: 0,     // -100(对手势) ~ +100(我方势)
  log: [],
};

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const screens = {
  title:  $("screen-title"),
  select: $("screen-select"),
  series: $("screen-series"),
  game:   $("screen-game"),
  result: $("screen-result"),
  end:    $("screen-end"),
};
function show(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

// ========================================================
// 流程：标题 → 选队 → 系列赛
// ========================================================
$("btn-start").onclick = () => show("select");

document.querySelectorAll(".team-card .btn-pick").forEach((btn) => {
  btn.onclick = () => {
    const team = btn.closest(".team-card").dataset.team;
    G.myTeam = team;
    G.oppTeam = team === "knicks" ? "spurs" : "knicks";
    renderSeries();
    show("series");
  };
});

function renderSeries() {
  $("series-knicks-wins").textContent = G.wins.knicks;
  $("series-spurs-wins").textContent = G.wins.spurs;

  // 赛程条
  const strip = $("games-strip");
  strip.innerHTML = "";
  const past = [
    { g: 1, w: "spurs"  },
    { g: 2, w: "knicks" },
    { g: 3, w: "knicks" },
    { g: 4, w: "knicks" },
  ];
  past.forEach((p) => {
    const el = document.createElement("div");
    el.className = `game-pill win-${p.w}`;
    el.textContent = `G${p.g} ${p.w === "knicks" ? "尼克斯" : "马刺"}胜`;
    strip.appendChild(el);
  });
  // 未来场次
  for (let i = G.scheduleIdx; i < SCHEDULE.length; i++) {
    const s = SCHEDULE[i];
    const el = document.createElement("div");
    el.className = "game-pill" + (i === G.scheduleIdx ? " next" : "");
    el.textContent = `G${s.g} @${s.venue}`;
    strip.appendChild(el);
  }

  const cur = SCHEDULE[G.scheduleIdx];
  const myName = TEAMS[G.myTeam].name;
  const oppName = TEAMS[G.oppTeam].name;
  const myWins = G.wins[G.myTeam];
  const oppWins = G.wins[G.oppTeam];

  let situation;
  if (G.myTeam === "knicks") {
    situation = `你执教 <b>${myName}</b>，大比分 <b>${myWins}-${oppWins}</b> 领先。<br>再赢 <b>${4 - myWins}</b> 场即可终结 53 年总冠军荒！`;
  } else {
    situation = `你执教 <b>${myName}</b>，大比分 <b>${myWins}-${oppWins}</b> 落后。<br>必须从 G${cur.g} 起<b>连赢 ${4 - myWins} 场</b>，完成惊天大逆转！`;
  }
  $("next-game-info").innerHTML =
    `<b>G${cur.g}</b> · ${cur.venue}（${TEAMS[cur.home].name}主场）<br>${situation}`;
  $("series-title").textContent = `系列赛进程 · 即将进行 G${cur.g}`;
}

$("btn-tipoff").onclick = startGame;

// ========================================================
// 单场比赛
// ========================================================
function startGame() {
  G.score = { knicks: 0, spurs: 0 };
  G.myPoss = 0;
  G.oppPoss = 0;
  G.momentum = 0;
  G.log = [];

  const cur = SCHEDULE[G.scheduleIdx];
  $("sb-game-label").textContent = `G${cur.g}`;

  // 左右固定显示：尼克斯在左、马刺在右
  updateScoreUI();
  $("game-log").innerHTML = "";
  $("momentum-fill").style.width = "50%";

  show("game");

  // 先手：主队先开球
  G.turn = cur.home === G.myTeam ? "mine" : "opp";
  pushLog(`<span class="big">G${cur.g} 跳球！</span> ${TEAMS[cur.home].name} 主场拿球先攻。`);
  nextTurn(true);
}

function updateScoreUI() {
  $("score-knicks").textContent = G.score.knicks;
  $("score-spurs").textContent = G.score.spurs;
  const cur = SCHEDULE[G.scheduleIdx];
  const done = G.myPoss + G.oppPoss;
  $("sb-poss").textContent = `回合 ${Math.min(Math.floor(done / 2) + 1, POSS_PER_GAME)} / ${POSS_PER_GAME}`;
  // 高亮持球方
  $("sb-left").classList.toggle("active", currentOffenseTeam() === "knicks");
  $("sb-right").classList.toggle("active", currentOffenseTeam() === "spurs");
}

function currentOffenseTeam() {
  return G.turn === "mine" ? G.myTeam : G.oppTeam;
}

function pushLog(html) {
  G.log.push(html);
  const box = $("game-log");
  box.innerHTML = G.log.slice(-3).map((l) => `<div>${l}</div>`).join("");
  box.scrollTop = box.scrollHeight;
}

function setMomentumUI() {
  // momentum -100..100 → 0..100%
  const pct = (G.momentum + 100) / 2;
  $("momentum-fill").style.width = pct + "%";
}

// 回合调度
function nextTurn(first) {
  // 结束条件：双方都打满
  if (G.myPoss >= POSS_PER_GAME && G.oppPoss >= POSS_PER_GAME) {
    return endGame();
  }
  updateScoreUI();

  // 隐藏所有交互面板
  hideAllPanels();

  if (G.turn === "mine") {
    showOffense();
  } else {
    showDefense();
  }
}

function hideAllPanels() {
  $("offense-panel").classList.add("hidden");
  $("defense-panel").classList.add("hidden");
  $("timing-wrap").classList.add("hidden");
  $("btn-continue").classList.add("hidden");
}

// ---------- 我方进攻：选择球员 ----------
function showOffense() {
  $("action-banner").textContent = "🏀 进攻回合 — 选择出手球员";
  $("action-banner").classList.remove("defense");
  const panel = $("offense-panel");
  panel.classList.remove("hidden");

  const opts = $("player-options");
  opts.innerHTML = "";
  const players = TEAMS[G.myTeam].players;
  players.forEach((p) => {
    const div = document.createElement("div");
    div.className = "player-opt";
    const typeLabel = p.type3
      ? `<span class="three">三分出手 (+3)</span>`
      : `两分出手 (+2)`;
    div.innerHTML =
      `<div><div class="po-name">${p.name}</div><div class="po-type">${p.tag}</div></div>
       <div class="po-type">${typeLabel}</div>`;
    div.onclick = () => beginShot(p);
    opts.appendChild(div);
  });
}

// ---------- 我方进攻：时机条 ----------
let timing = null; // {raf, pos, dir, speed, zoneStart, zoneW, perfStart, perfW, resolved, mode, data}

function beginShot(player) {
  hideAllPanels();
  $("action-banner").textContent = "🏀 进攻回合 — 出手时机";
  $("action-banner").classList.remove("defense");
  $("timing-wrap").classList.remove("hidden");
  $("btn-timing").classList.remove("hidden");
  $("timing-zone").style.background = "rgba(46,194,107,.35)";

  const cur = SCHEDULE[G.scheduleIdx];
  const homeBonus = cur.home === G.myTeam ? 4 : 0;
  // 气势加成（我方）：momentum>0 时扩大命中窗口
  const momBonus = Math.max(0, G.momentum) * 0.12;

  const pts = player.type3 ? 3 : 2;
  // 评级越高、三分越难。绿区宽度 8%~34%
  let base = (player.off - 60) * 0.45 + homeBonus + momBonus; // 大致 12~32
  if (player.type3) base -= 6;
  let zoneW = clamp(base, 9, 36);
  const speed = 0.9 + (player.type3 ? 0.35 : 0) + Math.random() * 0.3; // 移动速度
  const zoneStart = 12 + Math.random() * (88 - 12 - zoneW);
  const perfW = zoneW * 0.34;
  const perfStart = zoneStart + (zoneW - perfW) / 2;

  $("timing-info").innerHTML =
    `<b>${player.name}</b> 准备${player.type3 ? "三分" : "中距离"}出手 · 命中得 ${pts} 分<br>点击让光标停在<span style="color:var(--green)">绿区</span>，命中亮绿“完美点”可造杀伤！`;

  setupTimingBar(zoneStart, zoneW, perfStart, perfW);

  timing = {
    pos: 0, dir: 1, speed, resolved: false,
    zoneStart, zoneW, perfStart, perfW,
    mode: "shoot", player, pts,
  };
  $("btn-timing").textContent = "出手！";
  $("btn-timing").onclick = resolveShot;
  runMarker();
}

function setupTimingBar(zStart, zW, pStart, pW) {
  const zone = $("timing-zone");
  zone.style.left = zStart + "%";
  zone.style.width = zW + "%";
  const perf = $("timing-perfect");
  perf.style.left = pStart + "%";
  perf.style.width = pW + "%";
  // 防守模式下隐藏完美点（封盖只看封盖区）
}

function runMarker() {
  const marker = $("timing-marker");
  function step() {
    if (!timing || timing.resolved) return;
    timing.pos += timing.dir * timing.speed;
    if (timing.pos >= 100) { timing.pos = 100; timing.dir = -1; }
    if (timing.pos <= 0)   { timing.pos = 0;   timing.dir = 1; }
    marker.style.left = timing.pos + "%";
    timing.raf = requestAnimationFrame(step);
  }
  timing.raf = requestAnimationFrame(step);
}

function resolveShot() {
  if (!timing || timing.resolved) return;
  timing.resolved = true;
  cancelAnimationFrame(timing.raf);

  const { pos, zoneStart, zoneW, perfStart, perfW, player, pts } = timing;
  const inZone = pos >= zoneStart && pos <= zoneStart + zoneW;
  const inPerf = pos >= perfStart && pos <= perfStart + perfW;

  $("btn-timing").classList.add("hidden");

  if (inPerf) {
    // 完美：得分，且+1造犯规罚球的小概率（这里直接+1分体现And-1）
    addScore(G.myTeam, pts);
    const and1 = Math.random() < 0.35;
    if (and1) addScore(G.myTeam, 1);
    bumpMomentum(+18);
    pushLog(`<span class="big">${player.name} ${pts}分${pts === 3 ? "三分" : ""}打成${and1 ? " + 罚球 And-1！" : "，完美出手！"}</span>`);
  } else if (inZone) {
    addScore(G.myTeam, pts);
    bumpMomentum(+10);
    pushLog(`<span class="made">${player.name} 命中 ${pts} 分！</span>`);
  } else {
    bumpMomentum(-8);
    pushLog(`<span class="miss">${player.name} 出手不中…</span>`);
  }

  afterPossession("mine");
}

// ---------- 对手进攻：我方防守封盖 ----------
function showDefense() {
  $("action-banner").textContent = "🛡️ 防守回合 — 抓准时机封盖";
  $("action-banner").classList.add("defense");

  // 对手选一名球员出手
  const players = TEAMS[G.oppTeam].players;
  const shooter = weightedPick(players);
  const pts = shooter.type3 ? 3 : 2;

  $("defense-panel").classList.remove("hidden");
  $("defense-hint").innerHTML =
    `对手 <b>${shooter.name}</b> 正在${shooter.type3 ? "三分" : "突破"}出手（${pts}分）——点击让光标停进<span style="color:#ff7b72">红色封盖区</span>即可送他打铁！`;

  setTimeout(() => beginBlock(shooter, pts), 700);
}

function beginBlock(shooter, pts) {
  hideAllPanels();
  $("defense-panel").classList.remove("hidden");
  $("timing-wrap").classList.remove("hidden");

  const cur = SCHEDULE[G.scheduleIdx];
  const myDef = TEAMS[G.myTeam].defense;
  const homeBonus = cur.home === G.myTeam ? 3 : 0;
  // 防守气势：我方momentum>0 → 封盖区更大
  const momBonus = Math.max(0, G.momentum) * 0.1;
  // 封盖窗口：防守值越高越大；对手越强越难
  let blockW = clamp((myDef - 60) * 0.4 + homeBonus + momBonus - (shooter.off - 84) * 0.6, 8, 30);
  const speed = 1.1 + Math.random() * 0.5; // 防守更快更难
  const zoneStart = 12 + Math.random() * (88 - 12 - blockW);

  // 复用时机条：红色封盖区
  const zone = $("timing-zone");
  zone.style.left = zoneStart + "%";
  zone.style.width = blockW + "%";
  zone.style.background = "rgba(232,68,58,.4)";
  $("timing-perfect").style.width = "0%";

  $("timing-info").innerHTML = `对手出手中…… 抓住封盖机会！`;
  $("btn-timing").classList.remove("hidden");
  $("btn-timing").textContent = "封盖！";
  $("btn-timing").onclick = () => resolveBlock(shooter, pts, zoneStart, blockW);

  timing = { pos: 0, dir: 1, speed, resolved: false, raf: null };
  runMarker();
}

function resolveBlock(shooter, pts, zoneStart, blockW) {
  if (!timing || timing.resolved) return;
  timing.resolved = true;
  cancelAnimationFrame(timing.raf);
  $("btn-timing").classList.add("hidden");

  const inBlock = timing.pos >= zoneStart && timing.pos <= zoneStart + blockW;

  // 还原绿色样式给下一次进攻
  $("timing-zone").style.background = "rgba(46,194,107,.35)";

  if (inBlock) {
    bumpMomentum(+14);
    pushLog(`<span class="big">封盖！${shooter.name} 被你的防守拍下，进攻失败！</span>`);
  } else {
    // 没封到：按对手能力决定是否命中
    const cur = SCHEDULE[G.scheduleIdx];
    const oppMom = Math.max(0, -G.momentum) * 0.003;
    const homeBonus = cur.home === G.oppTeam ? 0.06 : 0;
    const makeP = clamp(0.4 + (shooter.off - 84) * 0.03 + oppMom + homeBonus, 0.32, 0.82);
    if (Math.random() < makeP) {
      addScore(G.oppTeam, pts);
      bumpMomentum(-12);
      pushLog(`<span class="miss">没封到——${shooter.name} 命中 ${pts} 分。</span>`);
    } else {
      bumpMomentum(+4);
      pushLog(`<span class="made">${shooter.name} 自己打铁，有惊无险。</span>`);
    }
  }

  afterPossession("opp");
}

// ---------- 回合收尾 ----------
function addScore(team, pts) {
  G.score[team] += pts;
  updateScoreUI();
}

function bumpMomentum(delta) {
  G.momentum = clamp(G.momentum + delta, -100, 100);
  setMomentumUI();
}

function afterPossession(who) {
  if (who === "mine") G.myPoss++;
  else G.oppPoss++;

  hideAllPanels();
  updateScoreUI();

  // 切换球权
  G.turn = G.turn === "mine" ? "opp" : "mine";

  $("btn-continue").classList.remove("hidden");
  $("btn-continue").textContent =
    (G.myPoss >= POSS_PER_GAME && G.oppPoss >= POSS_PER_GAME) ? "查看本场结果" : "下一回合";
  $("btn-continue").onclick = () => nextTurn(false);
}

// ========================================================
// 单场结束 → 系列赛结算
// ========================================================
function endGame() {
  hideAllPanels();
  const my = G.score[G.myTeam];
  const opp = G.score[G.oppTeam];
  let myFinal = my, oppFinal = opp;

  // 平局加罚：极小概率，简单处理为各加一次随机
  if (myFinal === oppFinal) {
    if (Math.random() < 0.5) myFinal += 1; else oppFinal += 1;
    G.score[G.myTeam] = myFinal;
    G.score[G.oppTeam] = oppFinal;
  }

  const iWon = myFinal > oppFinal;
  if (iWon) G.wins[G.myTeam]++;
  else G.wins[G.oppTeam]++;

  // 结果页
  const cur = SCHEDULE[G.scheduleIdx];
  $("result-title").textContent = `G${cur.g} 终场`;
  // 比分按尼克斯-马刺顺序显示
  $("result-score").textContent = `尼克斯 ${G.score.knicks} - ${G.score.spurs} 马刺`;

  const myName = TEAMS[G.myTeam].name;
  const oppName = TEAMS[G.oppTeam].name;
  let txt;
  if (iWon) {
    txt = `${myName} 拿下 G${cur.g}！大比分 ${G.wins[G.myTeam]}-${G.wins[G.oppTeam]}。`;
  } else {
    txt = `${myName} 惜败 G${cur.g}。大比分 ${G.wins[G.myTeam]}-${G.wins[G.oppTeam]}。`;
  }
  $("result-text").textContent = txt;

  G.scheduleIdx++;
  show("result");

  $("btn-next-game").onclick = () => {
    // 判断系列赛是否结束
    if (G.wins.knicks === 4 || G.wins.spurs === 4) {
      showEnd();
    } else {
      renderSeries();
      show("series");
    }
  };
}

// ========================================================
// 系列赛结局
// ========================================================
function showEnd() {
  const champion = G.wins.knicks === 4 ? "knicks" : "spurs";
  const iWon = champion === G.myTeam;
  const myName = TEAMS[G.myTeam].name;

  if (iWon) {
    if (G.myTeam === "knicks") {
      $("end-emoji").textContent = "🏆";
      $("end-title").textContent = "尼克斯总冠军！";
      $("end-text").innerHTML =
        `麦迪逊广场花园沸腾了！你率领尼克斯顶住了马刺的反扑，<b>终结了长达 53 年的总冠军荒</b>。<br>布伦森的关键球、阿奴诺比的铁血防守——这座金杯，纽约等了太久。`;
    } else {
      $("end-emoji").textContent = "🏆";
      $("end-title").textContent = "马刺惊天逆转夺冠！";
      $("end-text").innerHTML =
        `从 1-3 落后到连赢三场——你完成了几乎不可能的<b>“黑八式”大逆转</b>！<br>文班亚马用一座总冠军，回敬了 G4 的崩盘。这将是被铭记的传奇剧本。`;
    }
  } else {
    $("end-emoji").textContent = "💔";
    $("end-title").textContent = "系列赛结束";
    $("end-title").style.webkitTextFillColor = "#8b97a4";
    if (G.myTeam === "spurs") {
      $("end-text").innerHTML =
        `逆转之路戛然而止。${myName} 倒在了通往奇迹的途中，尼克斯笑到了最后。<br>但 1-3 落后还能拼到这一步，已经虽败犹荣。再来一次，改写结局！`;
    } else {
      $("end-text").innerHTML =
        `领先 3-1 却被对手翻盘——这将成为永恒的痛。马刺完成了不可思议的大逆转。<br>53 年的等待还要继续……再来一次，别让奇迹发生在对手身上！`;
    }
  }
  show("end");
}

$("btn-restart").onclick = () => {
  G.myTeam = null; G.oppTeam = null;
  G.wins = { knicks: 3, spurs: 1 };
  G.scheduleIdx = 0;
  $("end-title").style.webkitTextFillColor = "";
  show("select");
};

// ========================================================
// 工具函数
// ========================================================
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function weightedPick(players) {
  // 进攻能力越高越可能出手
  const weights = players.map((p) => Math.pow(p.off, 2));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < players.length; i++) {
    r -= weights[i];
    if (r <= 0) return players[i];
  }
  return players[0];
}
