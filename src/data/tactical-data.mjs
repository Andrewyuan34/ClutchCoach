export const TRAIT_KEYS = Object.freeze([
  "spacing",
  "handler",
  "rimPressure",
  "poaDefense",
  "rimProtect",
  "rebound",
  "switch",
  "pace",
  "closer",
]);

export const TACTICAL_TRAITS = Object.freeze({
  brunson:  { spacing: 72, handler: 92, rimPressure: 82, poaDefense: 62, rimProtect: 12, rebound: 28, switch: 48, pace: 72, closer: 92 },
  bridges:  { spacing: 86, handler: 48, rimPressure: 58, poaDefense: 86, rimProtect: 34, rebound: 42, switch: 82, pace: 74, closer: 70 },
  anunoby:  { spacing: 84, handler: 36, rimPressure: 62, poaDefense: 94, rimProtect: 54, rebound: 52, switch: 90, pace: 72, closer: 72 },
  hart:     { spacing: 58, handler: 56, rimPressure: 68, poaDefense: 78, rimProtect: 45, rebound: 86, switch: 76, pace: 80, closer: 62 },
  towns:    { spacing: 80, handler: 44, rimPressure: 74, poaDefense: 56, rimProtect: 60, rebound: 86, switch: 58, pace: 54, closer: 78 },
  shamet:   { spacing: 92, handler: 30, rimPressure: 28, poaDefense: 46, rimProtect: 10, rebound: 24, switch: 40, pace: 58, closer: 56 },
  alvarado: { spacing: 76, handler: 78, rimPressure: 64, poaDefense: 84, rimProtect: 12, rebound: 24, switch: 62, pace: 86, closer: 58 },
  robinson: { spacing: 5,  handler: 8,  rimPressure: 58, poaDefense: 54, rimProtect: 92, rebound: 94, switch: 48, pace: 48, closer: 44 },
  mcbride:  { spacing: 78, handler: 68, rimPressure: 56, poaDefense: 82, rimProtect: 18, rebound: 30, switch: 66, pace: 78, closer: 56 },
  clarkson: { spacing: 80, handler: 64, rimPressure: 66, poaDefense: 44, rimProtect: 10, rebound: 30, switch: 36, pace: 72, closer: 72 },
  sochan:   { spacing: 42, handler: 42, rimPressure: 64, poaDefense: 80, rimProtect: 58, rebound: 68, switch: 78, pace: 74, closer: 50 },
  hukporti: { spacing: 4,  handler: 8,  rimPressure: 52, poaDefense: 48, rimProtect: 82, rebound: 82, switch: 42, pace: 45, closer: 36 },

  fox:      { spacing: 68, handler: 92, rimPressure: 90, poaDefense: 78, rimProtect: 14, rebound: 32, switch: 58, pace: 94, closer: 86 },
  castle:   { spacing: 66, handler: 78, rimPressure: 74, poaDefense: 80, rimProtect: 24, rebound: 48, switch: 76, pace: 82, closer: 68 },
  vassell:  { spacing: 90, handler: 44, rimPressure: 52, poaDefense: 70, rimProtect: 20, rebound: 36, switch: 64, pace: 70, closer: 70 },
  champ:    { spacing: 88, handler: 28, rimPressure: 48, poaDefense: 82, rimProtect: 44, rebound: 56, switch: 80, pace: 70, closer: 58 },
  wemby:    { spacing: 78, handler: 56, rimPressure: 86, poaDefense: 72, rimProtect: 99, rebound: 94, switch: 86, pace: 66, closer: 88 },
  harper:   { spacing: 68, handler: 74, rimPressure: 78, poaDefense: 66, rimProtect: 14, rebound: 42, switch: 58, pace: 82, closer: 62 },
  keldon:   { spacing: 68, handler: 34, rimPressure: 74, poaDefense: 62, rimProtect: 34, rebound: 62, switch: 58, pace: 70, closer: 58 },
  bryant:   { spacing: 78, handler: 28, rimPressure: 44, poaDefense: 62, rimProtect: 26, rebound: 48, switch: 54, pace: 62, closer: 48 },
  kornet:   { spacing: 8,  handler: 10, rimPressure: 48, poaDefense: 46, rimProtect: 84, rebound: 78, switch: 38, pace: 42, closer: 36 },
});

export const SCHEME_REQUIREMENTS = Object.freeze({
  off: Object.freeze({
    balanced:  { needs: { spacing: 50, handler: 50 }, success: ["cause.scheme.stable"], fail: ["cause.scheme.no_clear_advantage"] },
    inside:    { needs: { rimPressure: 66, rebound: 58 }, success: ["cause.scheme.paint_pressure"], fail: ["cause.lineup.paint_crowded"] },
    perimeter: { needs: { spacing: 72, handler: 54 }, success: ["cause.scheme.counter", "cause.lineup.fit"], fail: ["cause.lineup.spacing_not_enough"] },
    pace:      { needs: { pace: 70, handler: 58 }, success: ["cause.scheme.early_offense"], fail: ["cause.lineup.team_tired"] },
    iso:       { needs: { closer: 74, spacing: 58 }, success: ["cause.scheme.star_advantage"], fail: ["cause.lineup.star_trapped"] },
    motion:    { needs: { handler: 58, spacing: 62 }, success: ["cause.scheme.ball_movement"], fail: ["cause.lineup.weak_handler"] },
  }),
  def: Object.freeze({
    man:    { needs: { poaDefense: 58, switch: 48 }, success: ["cause.defense.stable"], fail: ["cause.defense.no_pressure"] },
    zone:   { needs: { rimProtect: 58, rebound: 58 }, success: ["cause.defense.paint_crowded"], fail: ["cause.defense.corner_open"] },
    press:  { needs: { poaDefense: 72, pace: 68 }, success: ["cause.defense.forced_turnover"], fail: ["cause.defense.press_broken"] },
    paint:  { needs: { rimProtect: 70, rebound: 64 }, success: ["cause.defense.rim_denial"], fail: ["cause.defense.open_three_allowed"] },
    double: { needs: { switch: 68, poaDefense: 64 }, success: ["cause.defense.star_trapped"], fail: ["cause.defense.weakside_punished"] },
    switch: { needs: { switch: 72, poaDefense: 62 }, success: ["cause.defense.no_clean_advantage"], fail: ["cause.defense.size_mismatch"] },
  }),
});

export const TACTIC_LESSONS = Object.freeze({
  motion: Object.freeze({
    lessonId: "motion",
    kind: "off",
    key: "motion",
    title: "团队传导",
    intent: "破解夹击和收缩，靠第二处理点把球提前转到弱侧。",
    needs: Object.freeze(["第二持球点", "空间点", "提前出球"]),
    counters: Object.freeze(["double", "press", "paint"]),
    risks: Object.freeze(["传导失误", "时间被压短", "弱侧射手被扑到"]),
    watchFor: Object.freeze(["early_release", "weakside_open", "turnover_risk"]),
    frames: Object.freeze([
      Object.freeze({
        label: "问题",
        title: "强侧被压住",
        text: "对手把球压在强侧，持球点如果原地等夹击，进攻会停住。",
        focus: "先看球有没有被提前传出来。",
        offense: Object.freeze([
          { id: "handler", label: "1", x: 32, y: 58, ball: true },
          { id: "outlet", label: "2", x: 48, y: 42 },
          { id: "corner", label: "3", x: 82, y: 78 },
          { id: "wing", label: "4", x: 72, y: 30 },
        ]),
        defense: Object.freeze([
          { id: "trap1", label: "D", x: 34, y: 51 },
          { id: "trap2", label: "D", x: 41, y: 64 },
          { id: "low", label: "D", x: 68, y: 70 },
        ]),
        arrows: Object.freeze([
          { from: [32, 58], to: [48, 42], label: "出球" },
        ]),
      }),
      Object.freeze({
        label: "解法",
        title: "第二处理点接应",
        text: "中路接应点上提，球不在夹击里停留，弱侧防守必须开始轮转。",
        focus: "观察第二持球点是否能顺手转移。",
        offense: Object.freeze([
          { id: "handler", label: "1", x: 32, y: 58 },
          { id: "outlet", label: "2", x: 50, y: 42, ball: true },
          { id: "corner", label: "3", x: 84, y: 78 },
          { id: "wing", label: "4", x: 74, y: 30 },
        ]),
        defense: Object.freeze([
          { id: "trap1", label: "D", x: 36, y: 54 },
          { id: "help", label: "D", x: 60, y: 46 },
          { id: "low", label: "D", x: 70, y: 68 },
        ]),
        arrows: Object.freeze([
          { from: [50, 42], to: [84, 78], label: "弱侧" },
        ]),
      }),
      Object.freeze({
        label: "代价",
        title: "传导慢了就会失误",
        text: "多传一次能制造空位，但如果接应点不稳，对手会赌传球路线。",
        focus: "后续直播看提前出球和失误风险。",
        offense: Object.freeze([
          { id: "outlet", label: "2", x: 50, y: 42, ball: true },
          { id: "corner", label: "3", x: 84, y: 78 },
          { id: "wing", label: "4", x: 74, y: 30 },
        ]),
        defense: Object.freeze([
          { id: "deny", label: "D", x: 62, y: 54 },
          { id: "jump", label: "D", x: 72, y: 66 },
          { id: "close", label: "D", x: 80, y: 42 },
        ]),
        arrows: Object.freeze([
          { from: [50, 42], to: [84, 78], label: "风险" },
        ]),
      }),
    ]),
  }),
  paint: Object.freeze({
    lessonId: "paint",
    kind: "def",
    key: "paint",
    title: "收缩护框",
    intent: "把突破和空接赶出禁区，但会让弱侧底角更难兼顾。",
    needs: Object.freeze(["护框高度", "篮板保护", "弱侧轮转"]),
    counters: Object.freeze(["inside", "pace", "iso"]),
    risks: Object.freeze(["底角三分", "长篮板", "弱侧补位慢"]),
    watchFor: Object.freeze(["paint_touch_denied", "corner_three_allowed", "rebound_risk"]),
    frames: Object.freeze([
      Object.freeze({
        label: "问题",
        title: "禁区被连续冲击",
        text: "对手的第一目标是把球送到篮下，护框人如果站得太散会被直接打穿。",
        focus: "先看对手有没有轻松碰到篮筐附近。",
        offense: Object.freeze([
          { id: "drive", label: "1", x: 42, y: 66, ball: true },
          { id: "roller", label: "5", x: 50, y: 30 },
          { id: "corner", label: "3", x: 84, y: 78 },
        ]),
        defense: Object.freeze([
          { id: "poa", label: "D", x: 42, y: 58 },
          { id: "rim", label: "D", x: 51, y: 40 },
          { id: "weak", label: "D", x: 72, y: 67 },
        ]),
        arrows: Object.freeze([
          { from: [42, 66], to: [50, 30], label: "冲框" },
        ]),
      }),
      Object.freeze({
        label: "解法",
        title: "三人收进油漆区",
        text: "外线先放一步，弱侧和中锋都往篮下收，目标是把突破变成高难度终结。",
        focus: "观察禁区触球是否被压低。",
        offense: Object.freeze([
          { id: "drive", label: "1", x: 45, y: 54, ball: true },
          { id: "roller", label: "5", x: 52, y: 30 },
          { id: "corner", label: "3", x: 84, y: 78 },
        ]),
        defense: Object.freeze([
          { id: "poa", label: "D", x: 45, y: 48 },
          { id: "rim", label: "D", x: 52, y: 38 },
          { id: "weak", label: "D", x: 61, y: 58 },
        ]),
        arrows: Object.freeze([
          { from: [72, 67], to: [61, 58], label: "收缩" },
        ]),
      }),
      Object.freeze({
        label: "代价",
        title: "底角会被放出来",
        text: "禁区守住了，代价是弱侧底角会短暂空出来，对手一旦转移快就能惩罚。",
        focus: "后续直播看底角三分和长篮板。",
        offense: Object.freeze([
          { id: "drive", label: "1", x: 51, y: 48, ball: true },
          { id: "corner", label: "3", x: 86, y: 79 },
          { id: "wing", label: "4", x: 76, y: 35 },
        ]),
        defense: Object.freeze([
          { id: "poa", label: "D", x: 50, y: 43 },
          { id: "rim", label: "D", x: 53, y: 36 },
          { id: "weak", label: "D", x: 61, y: 58 },
        ]),
        arrows: Object.freeze([
          { from: [51, 48], to: [86, 79], label: "底角" },
        ]),
      }),
    ]),
  }),
});

export const CAUSE_TEMPLATES = Object.freeze({
  "cause.scheme.counter": [
    "这次不是单纯打进，{OFF_SCHEME} 正好打在 {DEF_SCHEME} 的软肋上。",
    "{DEF} 还在收缩，{OFF} 立刻用 {OFF_SCHEME} 把球转到弱侧。",
    "战术关系打出来了，{OFF} 这回合的第一选择很舒服。",
  ],
  "cause.scheme.blocked": [
    "{OFF} 的思路没错，但 {DEF_SCHEME} 正好卡住了这套 {OFF_SCHEME}。",
    "{DEF} 对这套打法已经有准备，{OFF} 需要换一个攻击方向。",
    "{OFF_SCHEME} 没有打穿第一层防守，{OFF} 被迫在不舒服的位置处理球。",
  ],
  "cause.lineup.fit": [
    "这次阵容配置帮了大忙，场上空间足够，{P} 的处理变得简单了。",
    "刚才的换人开始见效，{S} 在弱侧把防守钉住，{P} 拿到了更好的路线。",
    "{OFF} 现在这五个人更适合执行 {OFF_SCHEME}，球转起来明显顺了。",
  ],
  "cause.lineup.mismatch": [
    "问题还是在人上，{OFF} 想打 {OFF_SCHEME}，但场上配置支撑不住。",
    "{DEF} 敢继续收缩，因为 {OFF} 现在的空间点不够有威胁。",
    "{OFF} 这回合不是没有想法，而是少了能把想法落地的人。",
  ],
  "cause.fatigue": [
    "{P} 前面消耗太大，这次动作明显慢了半拍。",
    "体力开始影响终结质量，{P} 的出手短了。",
    "{DEF} 看准了 {P} 体力下降，防守压得更靠前。",
  ],
  "cause.hot_cold": [
    "{P} 手感正热，{OFF} 这回合明显在主动找他。",
    "{P} 状态偏冷，{DEF} 已经敢稍微放他一步。",
    "球到了 {P} 手里，全队都能感觉到这段火候还在。",
  ],
  "cause.coach.adjustment_success": [
    "这就是刚才调整的价值，{OFF} 用 {ACTION} 改变了这一回合的第一选择。",
    "暂停后的布置开始兑现，{OFF} 连续把球送到更舒服的位置。",
    "刚才那次换人不是换体力而已，它直接改变了 {DEF} 的防守站位。",
  ],
  "cause.coach.adjustment_failed": [
    "这次调整还没解决根本问题，{DEF} 依然能把 {OFF} 赶到不舒服的位置。",
    "{ACTION} 改了表面，但场上的核心矛盾还在。",
    "{OFF} 想改变节奏，可执行条件没有跟上，效果只出来了一半。",
  ],
  "cause.opponent.adaptation": [
    "{DEF} 已经开始读懂这个套路，第一步防守明显提前了。",
    "对手不是随机变阵，{DEF} 正在针对 {OFF} 最近连续使用的打法。",
    "{DEF} 开始把防守重心移向弱侧，{OFF} 不能一直靠同一个出口。",
  ],
});

export const ADAPTATION_RULES = Object.freeze({
  repeat_perimeter: {
    patternId: "pattern.repeat_perimeter",
    adaptationId: "adapt.switch_chase_shooters",
    targetDef: "switch",
    prewarn: "{DEF} 已经开始提前扑底角，{OFF} 不能一直靠同一套外线站位吃饭。",
    applyText: "{DEF} 真正把防线推到外线，开始追着射手跑。",
    cooldown: 6,
  },
  repeat_iso: {
    patternId: "pattern.repeat_iso",
    adaptationId: "adapt.double_star",
    targetDef: "double",
    prewarn: "{DEF} 明显看到了核心持球过重，下一步可能要夹第一下启动。",
    applyText: "{DEF} 开始包夹核心，逼弱侧球员处理。",
    cooldown: 5,
  },
  primary_tired: {
    patternId: "pattern.primary_tired",
    adaptationId: "adapt.press_primary_handler",
    targetDef: "press",
    prewarn: "{DEF} 看准了主控体力下降，后场压力要上来了。",
    applyText: "{DEF} 从后场就开始压主控第一下运球。",
    cooldown: 5,
  },
  no_sub_fatigue: {
    patternId: "pattern.no_sub_fatigue",
    adaptationId: "adapt.push_pace",
    targetOff: "pace",
    prewarn: "{DEF} 发现这组人在硬撑，准备提速继续消耗。",
    applyText: "{DEF} 把节奏推快，开始追着疲劳点打。",
    cooldown: 5,
  },
});
