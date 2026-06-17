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
