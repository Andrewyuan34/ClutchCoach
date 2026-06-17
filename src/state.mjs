// ----------------- 全局比赛状态 -----------------
export const S = {
  myTeam: null, oppTeam: null,
  seriesWins: { knicks: 3, spurs: 1 },
  gameNo: 5,
  score: { knicks: 0, spurs: 0 },
  quarter: 1,
  clock: 720,           // 真实每节 12:00 = 720 秒
  possessionTeam: null,
  running: false,
  speed: 2600,          // 每条直播间隔(ms)，默认最慢，方便新手读懂局势
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
  timeouts: { knicks: 7, spurs: 7 },  // NBA规则：常规时间7次；第四节最多保留4次；最后3分钟最多2次；加时每队2次
  timeoutRuleFlags: {},  // 记录第四节/加时暂停规则是否已触发，避免重复提示
  oppTOQ: 0,             // 对手本节已叫暂停次数（限频）
  run: { team: null, pts: 0 },        // 连续得分流（一波流追踪）
  rotationDone: {},      // 已执行的固定轮换窗口，避免连续死球反复换
  refFrustration: { knicks: 0, spurs: 0 }, // 对吹罚/漏判产生的心理波动
  clutchAftershock: { team: null, val: 0, ticks: 0, kind: "" }, // 关键时刻余震
  homeTeam: null, awayTeam: null, arena: "", crowdHeat: 0, // 主场与声浪
  coachIdle: 0,          // 玩家连续未进行有效指挥的回合数
  targetLevel: 0,        // 被对手摸透/针对的惩罚层数
  coachPrompt: null,     // 当前「该你出手了」提示
  lastPromptType: "",
  lastPromptTick: -99,
  pendingCoachEffect: null, // 操作后 1~2 回合的因果反馈
  coachIntroOpen: false,
  tutorialOpen: false,
  tutorialIndex: 0,
  coachTask: null,
  coachTaskResult: null,
  coachStats: null,
  openingStarted: false,
  assistantMode: false,    // 助教模式：首局手把手强引导
  assistantStep: "",
  assistantTarget: null,
  assistantSubPlan: null,
  crisisPending: false,    // 正式比赛的「场边决断」
  crisisLastTick: -99,
  crisisGamble: null,
  rookieArc: null,         // 第一局教学剧情：操作有明显反馈，最后收到关键球
};

export const QUARTERS = 4;
export const QUARTER_SECONDS = 720;   // 真实每节 12 分钟
export const HOME_BY_GAME = { 1: "spurs", 2: "spurs", 3: "knicks", 4: "knicks", 5: "spurs", 6: "knicks", 7: "spurs" };

/* 真实校准基准（每队每场 48 分钟，NBA 联盟平均量级）：
   得分~113 · 投篮41-89 · 三分12-37 · 罚球17-22 · 篮板43 · 助攻26
   失误14 · 抢断8 · 盖帽5 · 回合(pace)~99 · 5人合计出场240分钟
   → 通过「真实回合数 + 每回合用时」自然产生，无需虚拟换算。 */

export const STAT_KEYS = ["sec", "pts", "fgm", "fga", "tpm", "tpa", "ftm", "fta", "oreb", "dreb", "ast", "stl", "blk", "tov", "pf"];

// 大心脏系数：关键时刻成功率加成（>1 抗压、<1 易手软）
export const CLUTCH_MAP = {
  brunson: 1.15, anunoby: 1.05, clarkson: 1.05, towns: 1.0, bridges: 1.0,
  shamet: 1.0, hart: 1.0, mcbride: 0.95, alvarado: 0.95, sochan: 0.95,
  robinson: 0.9, hukporti: 0.9,
  wemby: 1.1, fox: 1.05, castle: 1.0, vassell: 1.0, champ: 1.0,
  harper: 0.95, keldon: 0.95, bryant: 0.9, kornet: 0.9,
};

// ----------------- 启动流程 -----------------
