# 战术联动系统资源包与 AI 可追溯规格

本文是《战术、换人、文字直播联动系统策划案》的落地资源补全。目标是把缺失资源逐项补齐，并让后续实现天然支持：

- AI 可验证：状态、DOM、文本、断言可被自动读取。
- AI 可追溯：每次玩家操作、战术判断、换人、回合结果都有 trace id 和原因链。
- AI 可 debug：失败时能定位是数据、规则、文本、UI 还是数值问题。

## 1. 全局追溯协议

### 1.1 核心 ID

后续所有系统事件都要带稳定 ID。

| 字段 | 示例 | 用途 |
| --- | --- | --- |
| `matchId` | `g5-knicks-spurs-seed-demo-001` | 单局比赛唯一标识 |
| `possessionId` | `p-0042` | 回合唯一标识 |
| `coachActionId` | `ca-0017` | 玩家操作唯一标识 |
| `adjustmentId` | `adj-0009` | 调整反馈窗口唯一标识 |
| `contextId` | `ctx-p-0042` | 回合因果上下文唯一标识 |
| `livecastId` | `feed-0132` | 文字直播唯一标识 |
| `adaptationId` | `opp-adapt-0004` | 对手反制唯一标识 |

### 1.2 追溯链

每条关键直播都应该能向前追溯：

```text
livecastId
-> possessionId
-> contextId
-> coachActionId 或 adaptationId
-> involvedPlayers
-> causeIds
-> assertionIds
```

示例：

```json
{
  "livecastId": "feed-0132",
  "possessionId": "p-0042",
  "contextId": "ctx-p-0042",
  "source": "coach_adjustment",
  "coachActionId": "ca-0017",
  "adjustmentId": "adj-0009",
  "causeIds": ["cause.scheme.counter.zone_spacing", "cause.lineup.spacing_added"],
  "outcomeTags": ["open_three", "made", "weakside"],
  "involvedPlayers": ["mcbride", "bridges"],
  "debugNote": "perimeter vs zone succeeded after spacing substitution"
}
```

### 1.3 AI Debug 快照字段

后续 `window.__NBA_LIVE_VERIFY__.getState()` 建议增加：

```js
{
  tacticalDebug: {
    lastPossessionContext,
    lineupProfiles,
    activeAdjustmentWindows,
    lastCoachAction,
    opponentAdaptation,
    livecastTrace,
    assertionSummary
  }
}
```

这些字段应稳定存在。第一版可以为空对象，但不要频繁改名。

## 2. 球员战术标签数据

### 2.1 标签定义

所有标签取值 0-100。

| 标签 | 说明 | 低值表现 | 高值表现 |
| --- | --- | --- | --- |
| `spacing` | 空间与外线牵制 | 防守可收缩 | 防守必须贴近 |
| `handler` | 持球、推进、抗压 | 容易被紧逼影响 | 能破压迫、组织 |
| `rimPressure` | 冲框与杀伤 | 不能压缩防线 | 能攻击篮筐造犯规 |
| `poaDefense` | 持球点防守 | 容易被一步过 | 能压迫发起点 |
| `rimProtect` | 护框 | 禁区威慑弱 | 能改变冲框选择 |
| `rebound` | 篮板与终结回合 | 容易丢板 | 能保护篮板 |
| `switch` | 换防能力 | 错位容易被点名 | 能覆盖多个位置 |
| `pace` | 转换速度与回防 | 提速收益低 | 适合快攻/紧逼 |
| `closer` | 关键回合稳定性 | 压力下波动大 | 可承担关键选择 |

### 2.2 尼克斯标签表

| playerId | 定位 | spacing | handler | rimPressure | poaDefense | rimProtect | rebound | switch | pace | closer | 推荐用途 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `brunson` | 核心持球 / 关键单打 | 72 | 92 | 82 | 62 | 12 | 28 | 48 | 72 | 92 | 破局、关键球、半场持球 |
| `bridges` | 3D 侧翼 / 弱侧惩罚 | 86 | 48 | 58 | 86 | 34 | 42 | 82 | 74 | 70 | 破联防、外线牵制、换防 |
| `anunoby` | 防守锁 / 空间锋线 | 84 | 36 | 62 | 94 | 54 | 52 | 90 | 72 | 72 | 防核心、弱侧三分、锋线换防 |
| `hart` | 篮板锋线 / 能量点 | 58 | 56 | 68 | 78 | 45 | 86 | 76 | 80 | 62 | 篮板、转换、补防、拼抢 |
| `towns` | 空间内线 / 二核心 | 80 | 44 | 74 | 56 | 60 | 86 | 58 | 54 | 78 | 拉开内线、错位、篮板 |
| `shamet` | 纯射手 | 92 | 30 | 28 | 46 | 10 | 24 | 40 | 58 | 56 | 破联防、弱侧定点 |
| `alvarado` | 替补持球 / 抢断手 | 76 | 78 | 64 | 84 | 12 | 24 | 62 | 86 | 58 | 抗紧逼、提速、压迫后卫 |
| `robinson` | 护框 / 篮板 / 吃饼 | 5 | 8 | 58 | 54 | 92 | 94 | 48 | 48 | 44 | 护框、篮板、终结防守 |
| `mcbride` | 防守后卫 / 次持球 | 78 | 68 | 56 | 82 | 18 | 30 | 66 | 78 | 56 | 抗紧逼、补空间、外线防守 |
| `clarkson` | 微波炉得分 | 80 | 64 | 66 | 44 | 10 | 30 | 36 | 72 | 72 | 替补火力、单打续分 |
| `sochan` | 防守锋线 / 活力 | 42 | 42 | 64 | 80 | 58 | 68 | 78 | 74 | 50 | 防守换防、篮板、能量阵容 |
| `hukporti` | 替补护框 / 吃饼 | 4 | 8 | 52 | 48 | 82 | 82 | 42 | 45 | 36 | 护框、篮板、短时间顶内线 |

### 2.3 马刺标签表

| playerId | 定位 | spacing | handler | rimPressure | poaDefense | rimProtect | rebound | switch | pace | closer | 推荐用途 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `fox` | 核心后卫 / 提速发起 | 68 | 92 | 90 | 78 | 14 | 32 | 58 | 94 | 86 | 快攻、关键持球、攻击疲劳点 |
| `castle` | 全能后卫 / 第二持球 | 66 | 78 | 74 | 80 | 24 | 48 | 76 | 82 | 68 | 抗压推进、换防、冲框 |
| `vassell` | 侧翼射手 / 得分点 | 90 | 44 | 52 | 70 | 20 | 36 | 64 | 70 | 70 | 外线惩罚、弱侧终结 |
| `champ` | 3D 锋线 | 88 | 28 | 48 | 82 | 44 | 56 | 80 | 70 | 58 | 外线拉开、锋线防守 |
| `wemby` | 超级内线 / 护框核心 | 78 | 56 | 86 | 72 | 99 | 94 | 86 | 66 | 88 | 护框、错位、关键终结 |
| `harper` | 突破型替补后卫 | 68 | 74 | 78 | 66 | 14 | 42 | 58 | 82 | 62 | 替补突破、第二持球 |
| `keldon` | 强壮锋线 / 冲击篮筐 | 68 | 34 | 74 | 62 | 34 | 62 | 58 | 70 | 58 | 冲框、锋线对抗、篮板 |
| `bryant` | 替补射手锋线 | 78 | 28 | 44 | 62 | 26 | 48 | 54 | 62 | 48 | 弱侧空间、替补外线 |
| `kornet` | 替补护框 / 吃饼 | 8 | 10 | 48 | 46 | 84 | 78 | 38 | 42 | 36 | 护框、篮板、短时间内线 |

### 2.4 AI 验证断言

| assertionId | 规则 |
| --- | --- |
| `traits.every_player.present` | 每个 roster player 必须有 trait 数据。 |
| `traits.range.valid` | 所有 trait 必须在 0-100。 |
| `traits.primary_tags.nonempty` | 每名球员至少有 2 个 70+ 标签或 1 个明确定位标签。 |
| `lineup.profile.changes_after_sub` | 换人完成后，`lineupProfile` 至少一个维度发生变化。 |

## 3. 战术适配规则表

### 3.1 进攻战术适配

| offScheme | 核心意图 | 关键需求 | 适配成功标签 | 不适配反馈标签 |
| --- | --- | --- | --- | --- |
| `balanced` | 降低短板暴露，常规读防守 | 平均能力、体力稳定 | `balanced_execution` | `no_clear_advantage` |
| `inside` | 冲击禁区、造犯规、压缩防线 | `rimPressure`、`rebound`、内线体力 | `paint_pressure`、`foul_pressure` | `paint_crowded`、`rim_protection_problem` |
| `perimeter` | 用外线惩罚收缩 | `spacing`、`handler` | `open_three`、`weakside_spacing` | `spacing_not_enough`、`late_pass` |
| `pace` | 提速、早攻、消耗对手 | `pace`、`handler`、平均体力 | `early_offense`、`fatigue_attack` | `rushed_turnover`、`team_tired` |
| `iso` | 核心解决问题 | `closer`、核心体力、弱侧空间 | `star_advantage`、`mismatch_attack` | `star_trapped`、`primary_tired` |
| `motion` | 多点传导，拆包夹和紧逼 | `handler`、`spacing`、多人处理球 | `ball_movement`、`assist_chain` | `pressure_disrupts_pass`、`weak_handler` |

### 3.2 防守战术适配

| defScheme | 核心意图 | 关键需求 | 适配成功标签 | 不适配反馈标签 |
| --- | --- | --- | --- | --- |
| `man` | 基础对位，少犯错 | `poaDefense` 平均稳定 | `stable_matchup` | `no_pressure` |
| `zone` | 收缩禁区，保护冲框 | `rimProtect`、`rebound`、轮转 | `paint_crowded` | `corner_open`、`slow_rotation` |
| `press` | 压迫推进，制造失误 | `poaDefense`、`pace`、体力 | `forced_turnover`、`backcourt_pressure` | `press_broken`、`defense_tired` |
| `paint` | 护框，逼外线 | `rimProtect`、`rebound` | `rim_denial`、`block_threat` | `open_three_allowed` |
| `double` | 夹击核心，逼弱侧处理 | `switch`、轮转、防守纪律 | `star_trapped` | `weakside_punished` |
| `switch` | 覆盖外线和错位 | `switch`、锋线深度 | `no_clean_advantage` | `size_mismatch`、`rebound_leak` |

### 3.3 执行质量分档

| 档位 | 条件 | 数值建议 | 文本方向 |
| --- | --- | --- | --- |
| `fit.good` | 关键需求多数达标，且无明显疲劳红线 | 战术收益 100% | “战术执行出来了” |
| `fit.partial` | 战术克制成立，但阵容或体力有缺口 | 战术收益 55%-75% | “思路对，但效果打折” |
| `fit.bad` | 被克制或关键需求严重缺失 | 战术收益 20%-40%，负面标签提高 | “这套打法执行不了” |

### 3.4 AI 验证断言

| assertionId | 规则 |
| --- | --- |
| `scheme.fit.exists` | 每个回合 context 必须包含 `schemeFit`。 |
| `scheme.fit.valid_enum` | `schemeFit` 只能是 `good`、`partial`、`bad`。 |
| `scheme.fit.reasoned` | `partial` 或 `bad` 时必须有 `fitReasonIds`。 |
| `scheme.livecast.explains_bad_fit` | 连续 2 次 `bad` 后，直播必须至少出现一次解释文本。 |

## 4. 原因型文字模板

模板变量：

| 变量 | 含义 |
| --- | --- |
| `{OFF}` | 进攻方名称 |
| `{DEF}` | 防守方名称 |
| `{P}` | 主要球员 |
| `{S}` | 次要球员 |
| `{OFF_SCHEME}` | 进攻战术名 |
| `{DEF_SCHEME}` | 防守战术名 |
| `{ACTION}` | 最近玩家操作 |

### 4.1 `cause.scheme.counter`

```text
这次不是单纯投进了，{OFF_SCHEME} 正好打在 {DEF_SCHEME} 的软肋上。
{DEF} 还在收缩，{OFF} 立刻用 {OFF_SCHEME} 把球转到弱侧。
战术关系打出来了，{OFF} 这回合的第一选择就很舒服。
{DEF_SCHEME} 给了空间，{OFF_SCHEME} 把这个空间放大成了机会。
```

### 4.2 `cause.scheme.blocked`

```text
{OFF} 的思路没错，但 {DEF_SCHEME} 正好卡住了这套 {OFF_SCHEME}。
这次战术执行到最后一步变形了，{DEF} 的防守站位提前等在那里。
{OFF_SCHEME} 没有打穿第一层防守，{OFF} 被迫在不舒服的位置处理球。
{DEF} 对这套打法已经有准备，{OFF} 需要换一个攻击方向。
```

### 4.3 `cause.lineup.fit`

```text
这次阵容配置帮了大忙，场上空间足够，{P} 的处理变得简单了。
刚才的换人开始见效，{S} 在弱侧把防守钉住，{P} 拿到了更好的路线。
这不是一个人的回合，是阵容把战术条件凑齐了。
{OFF} 现在这五个人更适合执行 {OFF_SCHEME}，球转起来明显顺了。
```

### 4.4 `cause.lineup.mismatch`

```text
问题还是在人上，{OFF} 想打 {OFF_SCHEME}，但场上配置支撑不住。
{DEF} 敢继续收缩，因为 {OFF} 现在的空间点不够有威胁。
战术选择可以理解，但这套阵容执行到最后会缺一个处理点。
{OFF} 这回合不是没有想法，而是少了能把想法落地的人。
```

### 4.5 `cause.fatigue`

```text
{P} 前面消耗太大，这次动作明显慢了半拍。
体力开始影响终结质量，{P} 的出手短了。
{DEF} 看准了 {P} 体力下降，防守压得更靠前。
这不是单纯手感问题，{P} 的腿已经开始给不出回应。
```

### 4.6 `cause.hot_cold`

```text
{P} 手感正热，{OFF} 这回合明显在主动找他。
{P} 状态偏冷，{DEF} 已经敢稍微放他一步。
球到了 {P} 手里，全队都能感觉到这段火候还在。
{P} 还没从低迷里出来，这次机会出来了但没吃住。
```

### 4.7 `cause.coach.adjustment_success`

```text
这就是刚才调整的价值，{OFF} 用 {ACTION} 改变了这一回合的第一选择。
暂停后的布置开始兑现，{OFF} 连续把球送到更舒服的位置。
刚才那次换人不是换体力而已，它直接改变了 {DEF} 的防守站位。
{ACTION} 后的效果出来了，{OFF} 终于不再沿着同一堵墙硬撞。
```

### 4.8 `cause.coach.adjustment_failed`

```text
这次调整还没解决根本问题，{DEF} 依然能把 {OFF} 赶到不舒服的位置。
{ACTION} 改了表面，但场上的核心矛盾还在。
{OFF} 想改变节奏，可执行条件没有跟上，效果只出来了一半。
这次布置没有让 {DEF} 犹豫，下一回合可能还得继续变。
```

### 4.9 `cause.opponent.adaptation`

```text
{DEF} 已经开始读懂这个套路，第一步防守明显提前了。
对手不是随机变阵，{DEF} 正在针对 {OFF} 最近连续使用的打法。
{DEF} 开始把防守重心移向弱侧，{OFF} 不能一直靠同一个出口。
这回合能看出来，{DEF} 已经把 {OFF_SCHEME} 当成重点处理。
```

### 4.10 AI 验证断言

| assertionId | 规则 |
| --- | --- |
| `livecast.trace.has_cause` | 关键直播必须带至少一个 `causeId`。 |
| `livecast.text.matches_cause` | `causeId` 属于调整反馈时，文本必须包含操作反馈含义。 |
| `livecast.no_over_explain` | 最近 5 回合长解释文本不超过 2 条。 |
| `livecast.after_action.exists` | 玩家操作后 3 回合内必须出现至少 1 条相关反馈或解释。 |

## 5. 调整反馈窗口判定标准

### 5.1 窗口通用结构

```js
{
  adjustmentId: "adj-0009",
  sourceActionId: "ca-0017",
  type: "off_scheme_change",
  targetProblem: "opponent_zone",
  expectedCauseIds: ["cause.scheme.counter", "cause.lineup.fit"],
  startPossessionId: "p-0042",
  remainingPossessions: 5,
  metrics: {
    goodShotCount: 0,
    badShotCount: 0,
    turnoverCount: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    expectedCauseHits: 0,
    negativeCauseHits: 0
  },
  result: null
}
```

### 5.2 操作类型判定

| 操作类型 | 目标 | 成功 | 部分成功 | 失败 |
| --- | --- | --- | --- | --- |
| `off_scheme_change` | 让进攻获得更好出手 | 5 回合内 2 次目标原因命中，失误不增加 | 出现目标原因但被体力/手感抵消 | 没出现目标原因，且负面原因连续出现 |
| `def_scheme_change` | 降低对手优势 | 对手坏出手或失误增加 | 对手效率下降但仍有单点爆破 | 对手连续打出克制标签 |
| `substitution` | 改善阵容画像或体力 | `lineupProfile` 目标维度提升且对应原因出现 | 维度提升但比分/过程未体现 | 维度无改善或换人造成新短板 |
| `timeout` | 止血、回体力、重置节奏 | 对手连得被打断，体力/失误改善 | 节奏变稳但仍未反超局面 | 暂停后继续失误或被打同一问题 |
| `clutch_choice` | 关键回合策略兑现 | 产生高质量关键出手或防成 | 出手合理但未命中 | 选择被完全反制或失误 |

### 5.3 过程质量优先

反馈判定优先看过程，不只看得分。

例如：

```text
空位三分投丢：战术可判部分成功或成功。
顶人强投命中：战术不一定成功。
换人后推进顺畅但没得分：可以判部分成功。
```

### 5.4 AI 验证断言

| assertionId | 规则 |
| --- | --- |
| `adjustment.created_after_action` | 战术、换人、暂停后必须创建或更新 adjustment window。 |
| `adjustment.has_expected_causes` | 每个 window 必须有 `expectedCauseIds`。 |
| `adjustment.resolves` | window 到期后必须得到 `success`、`partial` 或 `failed`。 |
| `adjustment.feedback_livecast` | window 结束后必须生成一条反馈直播或教练提示。 |

## 6. 对手反制节奏表

### 6.1 倾向检测

| patternId | 检测条件 | 预兆时机 | 反制时机 | 冷却 |
| --- | --- | --- | --- | --- |
| `pattern.repeat_perimeter` | 最近 5 次进攻中 3 次以上 `perimeter` | 第 3 次后 | 预兆后 1-2 回合 | 6 回合 |
| `pattern.repeat_iso` | 最近 5 次进攻中 3 次以上 `iso` 或核心 usage 过高 | 第 3 次后 | 预兆后 1 回合 | 5 回合 |
| `pattern.primary_tired` | 核心持球人体力低于 38 且继续高使用 | 立即预兆 | 1 回合后 | 4 回合 |
| `pattern.no_sub_fatigue` | 场上 2 人体力低于 40 且玩家未换人 | 立即预兆 | 1-2 回合后 | 5 回合 |
| `pattern.same_defense` | 同一防守连续 6 回合 | 第 5 回合后 | 1 回合后 | 6 回合 |
| `pattern.paint_collapse` | 玩家长期收缩防守 | 第 3 次后 | 1 回合后 | 5 回合 |

### 6.2 反制策略

| patternId | opponentAdaptation | 效果 | 预兆文本方向 |
| --- | --- | --- | --- |
| `pattern.repeat_perimeter` | `adapt.switch_chase_shooters` | 提高扑外线、降低空位三分 | “对手开始提前扑底角” |
| `pattern.repeat_iso` | `adapt.double_star` | 提高包夹核心、逼弱侧 | “对手开始夹第一下启动” |
| `pattern.primary_tired` | `adapt.press_primary_handler` | 增加核心失误和坏出手风险 | “对手看准体力下降” |
| `pattern.no_sub_fatigue` | `adapt.push_pace` | 加快节奏，消耗疲劳阵容 | “对手开始提速追着打” |
| `pattern.same_defense` | `adapt.find_defense_gap` | 对手提高克制战术概率 | “对手已经读到防守站位” |
| `pattern.paint_collapse` | `adapt.spread_corner` | 增加外线惩罚 | “对手开始拉开弱侧空间” |

### 6.3 公平性规则

```text
对手反制不能无预兆立即生效。
第一次反制只给轻度效果。
玩家调整后，反制强度应下降或清空。
同一反制不能连续无限触发。
```

### 6.4 AI 验证断言

| assertionId | 规则 |
| --- | --- |
| `adaptation.prewarn.before_effect` | `opponentAdaptation` 生效前必须有 `prewarnLivecastId`。 |
| `adaptation.cooldown.respected` | 同一 pattern 在冷却内不能重复触发。 |
| `adaptation.clears_after_counterplay` | 玩家做出有效反制后，适应强度应下降。 |
| `adaptation.trace.has_pattern` | 每次对手反制必须指向一个 `patternId`。 |

## 7. 指挥台 UI 资源

### 7.1 信息架构

移动端默认只展示 4 行。

```text
局势：一句总评
战术：我方战术 vs 对方战术，优势/劣势
阵容：最强点 + 最大短板
建议：一个方向，不给唯一答案
```

示例：

```text
局势：马刺正在收缩，禁区变挤。
战术：外线火力克制联防，但需要空间点。
阵容：空间一般，布伦森体力偏低。
建议：补一个射手或第二持球点。
```

### 7.2 DOM 与测试 ID

| UI 元素 | data-testid | AI 验证用途 |
| --- | --- | --- |
| 读局摘要容器 | `coach-read-panel` | 是否显示当前局势 |
| 战术关系行 | `coach-read-scheme-fit` | 验证战术克制/被克制文本 |
| 阵容适配行 | `coach-read-lineup-fit` | 验证阵容画像摘要 |
| 风险提示行 | `coach-read-risk` | 验证体力/重复套路/对手反制 |
| 建议行动行 | `coach-read-suggestion` | 验证建议不是空 |
| 调整反馈区 | `coach-adjustment-feedback` | 验证操作后反馈 |

### 7.3 UI 文案约束

```text
每行不超过 24 个中文字。
只显示强/一般/弱，不显示底层数值。
建议使用“方向”，避免唯一答案。
有玩家最近操作时，优先显示操作反馈。
```

### 7.4 AI 验证断言

| assertionId | 规则 |
| --- | --- |
| `ui.read_panel.visible_in_cmd` | 指挥台视图下读局摘要必须可见。 |
| `ui.scheme_fit.matches_state` | 战术关系文本必须和 `lastPossessionContext.schemeFit` 一致。 |
| `ui.suggestion.nonempty` | 建议行动不能为空。 |
| `ui.feedback.after_adjustment` | 玩家操作后反馈区在 3 回合内更新。 |

## 8. 调参与测试脚本

### 8.1 脚本 A：破联防

目标：

```text
验证“战术 + 换人 + 直播解释”是否打通。
```

步骤：

```text
1. 对手防守设为 zone 或 paint。
2. 玩家进攻先保持 inside 或 balanced。
3. 观察冲框受阻文本。
4. 玩家切 perimeter。
5. 如果阵容 spacing 不足，系统应提示效果打折。
6. 玩家换上 shamet 或 mcbride。
7. 后续 3-5 回合应出现 spacing / weakside / open_three 原因。
```

通过标准：

```text
出现 adjustmentWindow。
lineupProfile.spacing 提升。
关键直播解释“换人让外线战术见效”。
AI 断言 pass。
```

### 8.2 脚本 B：抗紧逼

步骤：

```text
1. 对手防守设为 press。
2. 玩家持续使用 motion 或 pace。
3. 主持球人体力下降。
4. 系统提示推进压力。
5. 玩家换上 alvarado 或 mcbride。
6. 后续失误风险下降，直播解释第二持球点接应。
```

通过标准：

```text
handler 画像提升。
turnover cause 减少。
出现抗紧逼反馈文本。
```

### 8.3 脚本 C：核心疲劳

步骤：

```text
1. 玩家连续使用 iso。
2. 核心体力降到 38 以下。
3. 对手预兆：准备夹击或压持球点。
4. 玩家如果不调整，对手反制生效。
5. 玩家叫暂停或改 motion，应降低反制。
```

通过标准：

```text
opponentAdaptation 有 prewarn。
疲劳原因进入 context。
玩家调整后 adaptation 强度下降。
```

### 8.4 脚本 D：重复外线被反制

步骤：

```text
1. 玩家连续使用 perimeter。
2. 对手预兆提前扑底角。
3. 对手切 switch 或提高外线压迫。
4. 玩家改 inside 或 motion，反制降低。
```

通过标准：

```text
pattern.repeat_perimeter 被记录。
prewarnLivecastId 存在。
反制前后 causeId 可追踪。
```

### 8.5 脚本 E：防守选择被破解

步骤：

```text
1. 玩家长时间使用 paint。
2. 对手开始 spread corner。
3. 直播提醒弱侧空间。
4. 玩家改 switch 或 man。
5. 对手外线空位原因下降。
```

通过标准：

```text
same defense pattern 可追踪。
直播解释对手反制。
防守调整后 context 标签变化。
```

## 9. AI 验证与 Debug 规范

### 9.1 新增快照结构建议

```js
{
  tactical: {
    possessionId: "p-0042",
    lastContext: {
      contextId: "ctx-p-0042",
      offScheme: "perimeter",
      defScheme: "zone",
      schemeFit: "good",
      lineupFit: "good",
      causeIds: ["cause.scheme.counter", "cause.lineup.fit"],
      outcomeTags: ["open_three", "made"]
    },
    lineupProfiles: {
      knicks: { spacing: 82, handler: 70, rimProtect: 54 },
      spurs: { spacing: 76, handler: 78, rimProtect: 90 }
    },
    activeAdjustmentWindows: [],
    opponentAdaptation: null,
    livecastTrace: []
  }
}
```

### 9.2 Debug 日志事件

| eventName | 触发时机 | 必要字段 |
| --- | --- | --- |
| `coach.action` | 玩家切战术、换人、暂停 | `coachActionId`、`type`、`payload` |
| `lineup.profile.updated` | 换人后 | `team`、`before`、`after`、`delta` |
| `possession.context.created` | 回合开始 | `possessionId`、`contextId` |
| `possession.context.resolved` | 回合结束 | `causeIds`、`outcomeTags`、`debugScore` |
| `adjustment.window.created` | 玩家操作后 | `adjustmentId`、`expectedCauseIds` |
| `adjustment.window.resolved` | 窗口结束 | `result`、`metrics` |
| `opponent.adaptation.prewarn` | 对手反制预兆 | `patternId`、`prewarnLivecastId` |
| `opponent.adaptation.applied` | 对手反制生效 | `adaptationId`、`patternId` |
| `livecast.trace.created` | 关键文本生成 | `livecastId`、`causeIds`、`source` |

### 9.3 AI Debug 面板建议

可以不做玩家可见 UI，但验证状态里要能读到：

```text
最近 5 个 debug events
最近 5 个 possession contexts
当前 active adjustment windows
当前 opponent adaptation
最后一条关键直播 trace
失败断言列表
```

### 9.4 总断言清单

| assertionId | 目标 |
| --- | --- |
| `tactical.context.every_possession` | 每个回合都有 context。 |
| `tactical.context.has_cause` | 关键回合至少一个 cause。 |
| `lineup.profile.every_team` | 两队都有 lineupProfile。 |
| `coach.action.traceable` | 玩家操作有 `coachActionId`。 |
| `adjustment.window.traceable` | 操作后可追踪反馈窗口。 |
| `livecast.traceable` | 关键直播可追溯到 context。 |
| `opponent.adaptation.traceable` | 对手反制可追溯到 pattern。 |
| `debug.events.bounded` | debug event 保留最近 N 条，避免无限增长。 |

## 10. 文案风格约束

### 10.1 长度

| 类型 | 建议长度 |
| --- | --- |
| 普通回合 | 18-32 字 |
| 原因解释 | 28-48 字 |
| 调整反馈 | 36-70 字 |
| 节间/暂停总结 | 60-100 字 |

### 10.2 语气

推荐：

```text
像解说员和助教在解释比赛。
强调“为什么”但不暴露公式。
承认部分成功，不只用成功/失败二分。
```

避免：

```text
像系统日志。
直接说数值加成。
每回合都长篇解释。
把建议写成唯一正确答案。
```

### 10.3 重复限制

```text
同一 cause 模板 8 回合内不要重复。
同一 adjustment 只总结一次。
同一 opponent prewarn 5 回合内不要重复。
关键长文本最多每 3 回合 1 条。
```

## 11. 实施前置资源完成度

| 资源 | 本文是否已补 | 后续实现还需 |
| --- | --- | --- |
| 球员战术标签 | 已给完整第一版 | playtest 后微调 |
| 原因型直播模板 | 已给第一批 | 实装后按重复率扩充 |
| 战术适配规则 | 已给第一版 | 数值调参 |
| 调整反馈标准 | 已给第一版 | 根据实战校准阈值 |
| 对手反制节奏 | 已给第一版 | 实装强度控制 |
| 指挥台 UI 草图 | 已给文字低保真 | 视觉与布局实现 |
| 调参测试脚本 | 已给 5 条 | 自动化脚本实现 |
| AI 验证断言 | 已给断言清单 | 接入 `ai-verify.mjs` |
| Debug 追溯协议 | 已给字段和事件 | 代码实现事件缓冲 |

## 12. 总结

后续实现时不要只把这些资源当策划文本，而要当成系统契约。

最重要的三条：

```text
每个关键结果必须有 causeId。
每个玩家操作必须能追踪 adjustmentId。
每条关键直播必须能追溯到 contextId。
```

做到这三条，战术、换人、文字直播就不仅是可玩系统，也会成为可验证、可追溯、可 debug 的 AI 原生系统。

全游戏接入边界、模块影响和迁移路线见：

[战术联动系统全局影响与适配方案](./tactics-system-game-wide-adaptation.md)
