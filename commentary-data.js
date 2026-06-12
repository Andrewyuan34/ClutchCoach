/* =========================================================
   commentary-data.js
   语料库：基于 ESPN G4 真实 play-by-play（498条 / 58种事件类型）提炼
   - 两队真实轮换名单 + 能力值（off 进攻 / thr 三分倾向 / def 防守 / reb 篮板 / pg 组织）
   - 中文解说模板（虎扑风格），按事件类型组织
   ========================================================= */

/* 花名册 = 2026 总决赛 G4 真实上过场球员（按 ESPN box score 出场时间排序，
   前 5 名为真实首发；DNP 球员不收录）。能力值依据各人真实定位与系列赛表现标定。*/
const ROSTERS = {
  knicks: {
    name: "尼克斯", short: "NY", color: "#1d428a", accent: "#f58426",
    players: [
      // —— 首发 5 人（G4 真实先发）——
      { id: "brunson",  name: "布伦森",     pos: "PG", off: 96, thr: 0.37, def: 70, reb: 25, pg: 86, ft: 0.85, star: true },
      { id: "bridges",  name: "布里奇斯",   pos: "SG", off: 80, thr: 0.48, def: 86, reb: 32, pg: 40, ft: 0.84 },
      { id: "anunoby",  name: "阿奴诺比",   pos: "SF", off: 85, thr: 0.46, def: 95, reb: 42, pg: 28, ft: 0.78 },
      { id: "hart",     name: "哈特",       pos: "PF", off: 70, thr: 0.33, def: 80, reb: 74, pg: 50, ft: 0.70 },
      { id: "towns",    name: "唐斯",       pos: "C",  off: 89, thr: 0.40, def: 70, reb: 82, pg: 32, ft: 0.86 },
      // —— 替补轮换（G4 真实登场）——
      { id: "shamet",   name: "沙梅特",     pos: "SG", off: 68, thr: 0.62, def: 58, reb: 18, pg: 28, ft: 0.85 },
      { id: "alvarado", name: "阿尔瓦拉多", pos: "PG", off: 72, thr: 0.46, def: 82, reb: 18, pg: 70, ft: 0.80 },
      { id: "robinson", name: "罗宾逊",     pos: "C",  off: 62, thr: 0.02, def: 92, reb: 90, pg: 10, ft: 0.55 },
      { id: "mcbride",  name: "麦克布莱德", pos: "PG", off: 72, thr: 0.44, def: 80, reb: 22, pg: 60, ft: 0.82 },
      { id: "clarkson", name: "克拉克森",   pos: "SG", off: 78, thr: 0.45, def: 52, reb: 25, pg: 50, ft: 0.80 },
      { id: "sochan",   name: "索汉",       pos: "PF", off: 66, thr: 0.30, def: 82, reb: 55, pg: 35, ft: 0.66 },
      { id: "hukporti", name: "胡克波蒂",   pos: "C",  off: 58, thr: 0.02, def: 80, reb: 78, pg: 12, ft: 0.58 },
    ],
  },
  spurs: {
    name: "马刺", short: "SA", color: "#16181a", accent: "#c4ced4",
    players: [
      // —— 首发 5 人（G4 真实先发）——
      { id: "fox",      name: "福克斯",   pos: "PG", off: 90, thr: 0.34, def: 78, reb: 28, pg: 86, ft: 0.78, star: true },
      { id: "castle",   name: "卡塞尔",   pos: "SG", off: 80, thr: 0.36, def: 80, reb: 40, pg: 72, ft: 0.74 },
      { id: "vassell",  name: "瓦塞尔",   pos: "SG", off: 83, thr: 0.52, def: 72, reb: 30, pg: 38, ft: 0.85 },
      { id: "champ",    name: "香帕尼",   pos: "SF", off: 70, thr: 0.55, def: 84, reb: 45, pg: 22, ft: 0.80 },
      { id: "wemby",    name: "文班亚马", pos: "C",  off: 93, thr: 0.40, def: 99, reb: 90, pg: 45, ft: 0.83, star: true },
      // —— 替补轮换（G4 真实登场）——
      { id: "harper",   name: "哈珀",     pos: "SG", off: 82, thr: 0.36, def: 70, reb: 35, pg: 66, ft: 0.76 },
      { id: "keldon",   name: "K·约翰逊", pos: "SF", off: 76, thr: 0.40, def: 66, reb: 50, pg: 25, ft: 0.74 },
      { id: "bryant",   name: "布莱恩特", pos: "SF", off: 66, thr: 0.42, def: 70, reb: 40, pg: 20, ft: 0.72 },
      { id: "kornet",   name: "科内特",   pos: "C",  off: 62, thr: 0.05, def: 82, reb: 76, pg: 15, ft: 0.62 },
    ],
  },
};

/* 前四场 ESPN boxscore 提取的真实轮换分钟目标（G1-G4 平均）。
   引擎会按这些目标自动换人，避免出现主力 47 分钟、替补 0 分钟的失真局面。 */
const ROTATION_TARGET_MIN = {
  knicks: {
    brunson: 38.5, anunoby: 36.8, towns: 33.0, bridges: 31.5, hart: 28.2,
    shamet: 26.8, mcbride: 13.2, alvarado: 12.2, robinson: 11.8, clarkson: 6.0,
    sochan: 0.8, hukporti: 0.8,
  },
  spurs: {
    wemby: 40.2, vassell: 38.0, fox: 36.5, champ: 31.8, castle: 31.5,
    harper: 31.0, keldon: 14.8, kornet: 7.8, bryant: 8.4,
  },
};

/* =========================================================
   球队战术身份（结合 2026 总决赛真实打法）
   - 尼克斯（主帅 Mike Brown）：突分传导「喷洒」找空位 + 布伦森关键单打；
     防守弹性、引导持球人向边线，必要时换防/包夹。
   - 马刺（主帅 Mitch Johnson）：年轻后卫群提速快攻 + 福克斯/文班挡拆终结；
     防守以文班坐镇禁区收缩护框为核心。
   用于：开局默认战术 + 对手 AI 选择战术时的“球队风格”倾向池。
   ========================================================= */
const TEAM_TACTICS = {
  knicks: {
    tag: "突分传导 + 布伦森单打 · 弹性换防",
    intro: "迈克·布朗体系：球的快速转移与突分喷洒找空位射手，关键球交给布伦森单打；防守端弹性十足，引导持球人向边线、必要时换防或包夹。",
    defaultOff: "motion", defaultDef: "man",
    offPool: ["motion", "iso", "balanced", "perimeter", "motion"],
    defPool: ["man", "switch", "double", "man"],
  },
  spurs: {
    tag: "福克斯快攻 + 文班挡拆 · 收缩护框",
    intro: "米奇·约翰逊体系：年轻后卫群提速快攻、福克斯与文班挡拆终结，进攻效率联盟顶级；防守端以文班坐镇禁区收缩护框为核心。",
    defaultOff: "pace", defaultDef: "paint",
    offPool: ["pace", "inside", "iso", "motion", "balanced", "pace"],
    defPool: ["paint", "man", "zone", "paint"],
  },
};

// 投篮风格描述（命中时套用），按【动作形态】细分，虎扑解说腔
// 选用哪一类由球员画像 PLAYER_STYLE 决定，而非随机套模板
const SHOT_FLAVOR = {
  // —— 三分：前四场真实高频包括 Jump Shot / Step Back Jump Shot / Pullup Jump Shot ——
  catch3: [
    "{P}底角接球，三分稳稳命中！",
    "{P}弧顶空位站定，唰——空心入网！",
    "{P}45度接球三分，干净利落！",
    "{P}弱侧埋伏太久了，接球直接三分惩罚！",
    "{P}绕掩护兜到外线，脚步调整后三分命中！",
  ],
  catch3_assist: [
    "{A}分球，{P}空位三分命中！",
    "{A}一条不看人的妙传，{P}底角三分稳稳命中！",
    "{A}突分外弹，{P}接球三分打进！",
    "{A}吸引协防后回传，{P}弧顶三分手起刀落！",
    "{A}把球甩到弱侧，{P}没有犹豫，三分穿针！",
  ],
  pull3: [
    "{P}一个后撤步拉开空间，三分远投打进！",
    "{P}迎着防守干拔三分，球应声入网！",
    "{P}运球到位直接发炮，超远三分命中！",
    "{P}连续胯下后突然后撤，三分线外冷箭命中！",
    "{P}借掩护只露出一丝缝隙，拔起就是三分！",
    "{P}压着节奏到最后几秒，外线强投打进！",
  ],
  // —— 中距离：Pullup / Fade Away / Turnaround / Bank 都来自前四场事件类型 ——
  pullup_mid: [
    "{P}急停跳投，稳稳命中两分。",
    "{P}中距离面框单打，手起刀落！",
    "{P}一个漂亮的后仰跳投，球进！",
    "{P}快攻中急停拔起，追防完全刹不住！",
    "{P}罚球线附近小撤步，中投稳稳打进。",
    "{P}运一步找节奏，打板跳投也有！",
  ],
  post_mid: [
    "{P}背身要位，转身跳投命中！",
    "{P}低位单打，一个柔和的转身后仰，进了！",
    "{P}高位面框背身结合，翻身跳投得手！",
    "{P}低位连续试探步，转身后仰越过防守！",
    "{P}背身顶到甜点位，翻身打板命中。",
    "{P}转身再后撤，防守人只能目送皮球入网。",
  ],
  floater: [
    "{P}杀入禁区一记抛投，越过封盖打进！",
    "{P}挑篮打板，柔和入筐！",
    "{P}行进间小抛投，球高高越过长臂防守落袋！",
    "{P}突破到油漆区，一个小骑马射箭命中。",
    "{P}指尖轻轻一挑，皮球擦板钻进篮筐！",
  ],
  // —— 内线终结：Driving/Running/Cutting/Alley Oop/Putback 均来自前四场 ——
  drive_layup: [
    "{P}一个变向晃开防守，上篮打进！",
    "{P}快速突破直杀篮下，上篮得手！",
    "{P}加速过人，欧洲步躲开封盖打进！",
    "{P}反击中一路推进，指尖挑篮完成终结！",
    "{P}底线反切后反手上篮，角度非常刁钻！",
    "{P}顶着身体接触把球放进，强硬！",
  ],
  cut_layup: [
    "{A}送出助攻，{P}篮下轻松上篮！",
    "{A}一记妙传……{P}空切接球上篮命中！",
    "{A}挡拆后塞球，{P}顺下放篮得分！",
    "{A}击地传到篮下，{P}切入接球直接吃饼！",
    "{A}吸引两人夹击，{P}从底线溜进来完成终结！",
  ],
  drive_dunk: [
    "{P}底线杀入，双手暴扣！全场沸腾！",
    "{P}快攻战斧劈扣，太暴力了！",
    "{P}面框一步起飞，单手隔扣！",
    "{P}抢到身位后直接起飞，单臂砸扣！",
    "{P}反击无人能挡，腾空暴扣点燃替补席！",
  ],
  lob_dunk: [
    "{A}高高抛起，{P}空中接力暴扣！",
    "{A}吊传篮下，{P}双手灌篮，地动山摇！",
    "{A}挡拆后吊传，{P}顺下空接暴扣！",
    "{A}把球扔向篮筐上沿，{P}从天而降完成空接！",
    "{A}读到协防慢半拍，{P}空切起飞把球摁进！",
  ],
  hook: [
    "{P}内线小勾手，稳稳命中。",
    "{P}转身勾手，老练的终结！",
    "{P}半截篮天勾，越过防守打进！",
    "{P}背身虚晃后小勾手，擦板命中。",
    "{P}禁区里一个转身勾手，手感太柔和。",
  ],
};

/* =========================================================
   球员打法画像（决定该球员出手时的【动作倾向权重】）
   字段为相对权重，引擎内部归一化：
     pull3  自主后撤/干拔三分     catch3 接球定点三分
     mid    急停/面框中投         post   背身/转身/勾手
     floater抛投                  layup  突破上篮
     dunk   扣篮倾向(0=从不扣篮)  blk    盖帽天赋   stl 抢断天赋
   ——刻意贴近 2026 这套阵容的真实风格——
   ========================================================= */
const PLAYER_STYLE = {
  // 尼克斯
  brunson:  { pull3:3,  catch3:1, mid:5,   post:2,   floater:4, layup:5, dunk:0,   blk:0.3, stl:1.2 }, // 关键先生：后撤步+中投+抛投，从不扣篮
  bridges:  { pull3:1.5,catch3:5, mid:2,   post:0.3, floater:1, layup:3, dunk:2,   blk:0.9, stl:1.6 }, // 3D：定点三分为主，偶尔空切扣
  anunoby:  { pull3:0.8,catch3:5, mid:1,   post:0.3, floater:0.5,layup:2.5,dunk:3, blk:1.7, stl:2.3 }, // 防守锁+三分，不持球花式，空切暴扣
  hart:     { pull3:0.5,catch3:2, mid:1,   post:1,   floater:1, layup:4, dunk:1.5, blk:0.9, stl:1.7 }, // 蓝领：冲抢补篮上篮
  towns:    { pull3:1.5,catch3:3, mid:3,   post:3.5, floater:1, layup:2, dunk:2.5, blk:1,   stl:0.8 }, // 空间型内线核心：能投+背身
  shamet:   { pull3:1,  catch3:6, mid:1,   post:0,   floater:0.5,layup:1, dunk:0.3, blk:0.3,stl:0.8 }, // 纯射手
  alvarado: { pull3:1,  catch3:3, mid:1.5, post:0.2, floater:3, layup:4, dunk:0.2, blk:0.3, stl:2.8 }, // 抢断手+抛投上篮
  robinson: { pull3:0,  catch3:0, mid:0,   post:0.5, floater:0, layup:2, dunk:6,   blk:2.2, stl:0.6 }, // 吃饼暴扣+护框，不投篮
  mcbride:  { pull3:1,  catch3:3.5,mid:1.5,post:0.2, floater:2, layup:3, dunk:0.3, blk:0.5, stl:2.2 }, // 防守后卫
  clarkson: { pull3:3,  catch3:2.5,mid:3,  post:0.5, floater:2, layup:3, dunk:0.5, blk:0.3, stl:1   }, // 微波炉：自主单打
  sochan:   { pull3:0.3,catch3:1, mid:2,   post:1.5, floater:1, layup:3.5,dunk:2,  blk:1,   stl:1.6 }, // 蓝领锋线，不投三分
  hukporti: { pull3:0,  catch3:0, mid:0.3, post:0.5, floater:0, layup:2, dunk:4,   blk:1.8, stl:0.6 }, // 替补吃饼
  // 马刺
  fox:      { pull3:2,  catch3:1.5,mid:3,  post:0.3, floater:3, layup:5, dunk:1.5, blk:0.6, stl:2.4 }, // 极速：突破上篮/欧洲步/抛投
  castle:   { pull3:1,  catch3:2, mid:2,   post:0.5, floater:1.5,layup:4, dunk:2.5, blk:0.8,stl:2   }, // 全能新秀：突破扣篮
  vassell:  { pull3:2.5,catch3:5, mid:2.5, post:0.3, floater:1, layup:2, dunk:1,   blk:0.6, stl:1   }, // 侧翼射手
  champ:    { pull3:1,  catch3:5, mid:1,   post:0.3, floater:0.5,layup:2, dunk:2,  blk:1.3, stl:1.7 }, // 3D锋线
  wemby:    { pull3:2,  catch3:3, mid:3,   post:4,   floater:1.5,layup:2, dunk:2.5, blk:3.4, stl:1.2 }, // 超级新星：转身/高位三分/勾手/护框天花板
  harper:   { pull3:1.2,catch3:2.5,mid:2,  post:0.3, floater:2, layup:4, dunk:1,   blk:0.6, stl:1.5 }, // 突破型新秀
  keldon:   { pull3:0.5,catch3:2, mid:1.5, post:1,   floater:1, layup:3.5,dunk:2.5, blk:0.7,stl:1.2 }, // 强壮锋线突破扣
  bryant:   { pull3:1,  catch3:4, mid:1.5, post:0.3, floater:1, layup:2, dunk:1,   blk:0.6, stl:1   }, // 射手
  kornet:   { pull3:0,  catch3:0.2,mid:0.3,post:0.5, floater:0, layup:2.5,dunk:3.5, blk:1.8, stl:0.6 }, // 吃饼护框
};

/* 球员招牌动作：选定某类出手后有概率改用专属解说，强化辨识度
   结构 id → { 出手类型key: [文案...] }                          */
const SIGNATURE = {
  brunson: {
    pull3:    ["{P}招牌的后撤步三分！这就是关键先生的答案！"],
    pullup_mid:["{P}低重心连续胯下后，急停中投命中——布伦森的吃饭家伙！"],
    floater:  ["{P}钻进内线一记招牌抛投，小个子的智慧！"],
  },
  wemby: {
    post_mid: ["{P}高位翻身后仰，2米24的出手点根本无解！"],
    pull3:    ["{P}外星人三分！中锋拉到三分线干拔命中，篮球的未来！"],
    hook:     ["{P}长臂天勾，封盖？不存在的！"],
  },
  fox:   { drive_layup:["{P}一道闪电杀穿全场，快攻上篮，没人追得上！"] },
  anunoby:{ drive_dunk:["{P}抢断快下，势大力沉的暴扣！攻防一体！"] },
  robinson:{ lob_dunk: ["{P}吃饼大师空接电梯门暴扣，能量爆炸！"] },
  towns:  { catch3:    ["{P}空间型内线拉开就投，三分入网！"] },
  vassell:{ pull3:     ["{P}丝滑干拔三分，侧翼杀器！"] },
};

// 各类事件中文模板
const TEMPLATES = {
  miss_three: [
    "{P}三分出手——不中，篮筐弹出。",
    "{P}三分远投偏出，没进。",
    "{P}勉强出手三分，打铁。",
  ],
  miss_mid: [
    "{P}跳投未果，皮球弹框而出。",
    "{P}中距离出手偏出。",
  ],
  miss_layup: [
    "{P}上篮放篮，球在筐上转了一圈滑出！",
    "{P}突破上篮被干扰，没进。",
  ],
  block: [
    "{D}起跳——把{P}的投篮死死钉在篮板上！盖帽！",
    "{D}如约而至的大帽！{P}的上篮被扇飞！",
    "{D}护框到位，封盖{P}！",
  ],
  steal: [
    "{S}抢断！{P}的传球被预判，断下快攻机会！",
    "{S}手疾眼快完成抢断，{P}失误！",
  ],
  turnover: [
    "{P}传球失误，球权易主。",
    "{P}带球走步，进攻无效。",
    "{P}进攻24秒违例，可惜了一次进攻。",
    "{P}传球出界，交出球权。",
  ],
  oreb: [
    "{P}冲抢到关键的前场篮板！二次进攻机会！",
    "{P}拼下进攻篮板，回合延续！",
  ],
  dreb: [
    "{P}稳稳保护下防守篮板。",
    "{P}高高跃起摘下后场篮板。",
  ],
  ft_make: [
    "{P}站上罚球线，罚球命中。",
    "{P}罚球出手——空心入网。",
  ],
  ft_miss: [
    "{P}罚球不中！罚丢了这一分。",
    "{P}罚球打铁，可惜。",
  ],
  foul: [
    "{P}吃到一次个人犯规。",
    "{P}防守犯规，送给对手罚球机会。",
    "{P}投篮犯规！对方将获得罚球。",
  ],
  ofoul: [
    "{P}进攻犯规，吃到一次进攻犯规失误！",
    "{P}冲撞犯规，被吹进攻犯规。",
  ],
  timeout: [
    "{T}请求暂停，重新布置战术。",
    "{T}叫了暂停，主教练在场边激烈布置。",
  ],
};

// 关键时刻（末节决战）专属高燃文案
const OFFICIATING_FLAVOR = {
  scaleShift: [
    "裁判这段时间尺度明显变紧，{T}连续冲击篮下开始得到哨声。",
    "下半场身体接触越来越多，裁判开始强调手部动作和圆柱体。",
    "{T}没有再飘在外线，连续往禁区压，逼着裁判必须做判断。",
  ],
  questionableFoul: [
    "这个哨子让{D}很不满意，几名球员围着裁判解释刚才的接触。",
    "现场对这次吹罚反应很大，{D}替补席都站起来摊手。",
    "慢镜头看这球接触不算特别明显，{D}这边情绪有点被带起来了。",
    "{F}被吹犯规后一直摇头，教练在场边提醒他别把情绪带到下回合。",
  ],
  noCall: [
    "{P}这次冲框倒地没有哨，{T}这边非常不满，回防都有点慢。",
    "这一球现场很多人觉得有犯规，但裁判示意比赛继续。",
    "{P}摊手向裁判抱怨，刚才那下身体接触没有得到哨声。",
    "替补席在喊犯规没响，{T}这回合的情绪明显受了影响。",
  ],
  crowdPressure: [
    "球迷开始集体高喊裁判，现场情绪正在影响比赛气氛。",
    "看台嘘声越来越大，裁判组也在努力控制场面。",
    "这几个回合哨声成为焦点，双方都在试探今晚的吹罚尺度。",
  ],
};

const CLUTCH_FLAVOR = [
  "全场屏住呼吸！",
  "麦迪逊广场花园彻底炸了！",
  "决定胜负的时刻！",
  "这一球太关键了！",
];

/* =========================================================
   教练战术体系（核心玩法：见招拆招）
   进攻 6 套 / 防守 6 套，彼此存在克制关系。
   ========================================================= */
const OFF_SCHEMES = {
  balanced:  { name: "均衡进攻", icon: "⚖️", desc: "内外均衡，按机会出手，无明显短板" },
  inside:    { name: "强打内线", icon: "🏋️", desc: "主攻禁区、多造杀伤；怕联防与护框" },
  perimeter: { name: "外线火力", icon: "🎯", desc: "拉开空间三分发炮；专破联防/收缩" },
  pace:      { name: "提速快攻", icon: "⚡", desc: "加快节奏打反击；怕被紧逼断球" },
  iso:       { name: "巨星单打", icon: "👑", desc: "核心持球强攻；怕包夹与联防" },
  motion:    { name: "团队传导", icon: "🕸️", desc: "多传导找空位、助攻多；专破紧逼/包夹" },
};
const DEF_SCHEMES = {
  man:    { name: "人盯人",   icon: "🧍", desc: "均衡盯防，无强项也无明显漏洞" },
  zone:   { name: "联防",     icon: "🛡️", desc: "收缩禁区限制突破/单打；怕外线投射" },
  press:  { name: "全场紧逼", icon: "🔥", desc: "逼抢制造失误；费体力，怕传导/快攻" },
  paint:  { name: "收缩护框", icon: "🧱", desc: "守内线多盖帽；放空三分线" },
  double: { name: "包夹核心", icon: "👥", desc: "夹击对方球星；放空其他人" },
  switch: { name: "换防一切", icon: "🔁", desc: "无限换防，均衡稳健" },
};

// 防守战术对“进攻方”的基础影响（命中/失误/盖帽/造犯规等）
// makeRim/make3/makeMid: 命中率加成(小数)；to:失误率加成；blk:被盖加成；star:对核心命中加成；other:对非核心加成
const DEF_BASE = {
  man:    { makeRim: 0,     make3: 0,     makeMid: 0,    to: 0,    blk: 0,    star: 0,     other: 0 },
  zone:   { makeRim:-0.06,  make3:+0.045, makeMid:-0.02, to:+0.01, blk:+0.02, star: 0,     other: 0 },
  press:  { makeRim:+0.02,  make3:+0.03,  makeMid:+0.01, to:+0.055,blk: 0,    star: 0,     other: 0 },
  paint:  { makeRim:-0.10,  make3:+0.05,  makeMid:-0.01, to: 0,    blk:+0.045,star: 0,     other: 0 },
  double: { makeRim:-0.02,  make3:-0.01,  makeMid:-0.02, to:+0.02, blk: 0,    star:-0.11,  other:+0.06 },
  switch: { makeRim:-0.025, make3:-0.02,  makeMid:-0.02, to: 0,    blk:+0.01, star: 0,     other: 0 },
};

// 进攻战术 × 防守战术 的“克制修正”（加到进攻方综合命中上，正=进攻方占优）
// 见招拆招的核心：选对克制战术能显著加成，被克制则吃亏。
const MATCHUP = {
  inside:    { zone:-0.06, paint:-0.07, press:+0.05, double:+0.02, man: 0,    switch:-0.01 },
  perimeter: { zone:+0.08, paint:+0.07, press:+0.04, double:+0.01, man: 0,    switch:-0.02 },
  iso:       { zone:-0.06, paint:-0.01, press:+0.03, double:-0.10, man:+0.03, switch:-0.02 },
  pace:      { zone:+0.02, paint:-0.05, press:-0.07, double:+0.02, man: 0,    switch:-0.01 },
  motion:    { zone:+0.03, paint: 0,    press:+0.07, double:+0.07, man:+0.01, switch:+0.01 },
  balanced:  { zone: 0,    paint: 0,    press: 0,    double: 0,    man: 0,    switch: 0 },
};

// 变阵 / 战术播报文案
const SCHEME_FLAVOR = {
  myOff:  "📋 我方改打【{N}】：{D}",
  myDef:  "🛡️ 我方防守切换【{N}】：{D}",
  oppOff: "⚔️ {T}祭出【{N}】进攻！",
  oppDef: "⚔️ {T}变阵【{N}】防守！",
  counterGood: "👍 克制到位！这套战术正打在对手软肋上。",
  counterBad:  "⚠️ 被对手战术克制，效果打折，考虑变招。",
};
