# 战术联动系统全局影响与适配方案

## 1. 结论

这个系统加上以后，会影响整个游戏的主要运行链路。

它不是一个孤立新功能，而是一个横切系统。它会成为以下模块共同读取的底层协议：

```text
回合结算
战术选择
换人系统
文字直播
教练提示
对手 AI
关键球
赛后评价
AI 验证
Debug 追溯
```

但它不意味着要推倒重写整个游戏。更合理的方式是建立一个新的“战术因果层”，让现有模块逐步接入。

改造原则：

```text
不让每个模块各自发明原因。
所有模块统一读写 context、causeId、adjustmentId、trace。
旧玩法继续跑，新系统先记录、再解释、最后影响数值。
```

## 2. 全局适配边界

### 2.1 必须适配的模块

这些模块需要直接接入新系统：

| 模块 | 必须适配原因 |
| --- | --- |
| 全局状态 `S` | 需要保存 context、阵容画像、调整窗口、debug 事件 |
| 数据层 `commentary-data.mjs` | 需要球员标签、战术需求、原因模板 |
| 回合结算 `runPossession()` | 每个回合必须生成 `PossessionContext` |
| 战术切换 `setMyScheme()` | 玩家战术操作必须创建 `coachActionId` 和 `adjustmentWindow` |
| 换人 `applySub()` / `renderSubs()` | 换人必须改变 `LineupProfile` 并产生可追溯反馈 |
| 文字直播 `pushFeed()` | 关键文本必须带 `livecastId`、`causeId`、`contextId` |
| 对手 AI `aiThink()` | 对手反制必须读取玩家倾向并生成 `adaptationId` |
| 指挥台 `renderCmd()` | UI 要展示战术关系、阵容适配、风险和建议 |
| 教练提示 `renderCoachPrompt()` | 提示要从 context 中读取问题，而不是零散判断 |
| AI 验证 `ai-verify.mjs` | 快照和断言要覆盖新系统 |

### 2.2 需要轻量适配的模块

这些模块不一定要深改，但要读取或记录新 trace：

| 模块 | 适配方式 |
| --- | --- |
| 自动轮换 `autoRotate()` | 系统换人也要更新阵容画像，但不一定创建玩家 action |
| 危机决策 | 触发原因应来自 context 和 adjustment 状态 |
| 关键球系统 | 关键球选择应生成特殊 `coachActionId` |
| 教学助教 | 引导动作要接入同一套 trace，方便验证 |
| 赛后评价 | 可以读取 adjustment 成功率、有效指挥、被反制次数 |
| 部署脚本 | 文档和工具需要随项目部署，但玩法不受影响 |

### 2.3 可以基本不动的部分

这些部分受影响较小：

| 模块 | 原因 |
| --- | --- |
| 静态入口 `live.html` 基础结构 | 只需要新增少量 `data-testid` 和读局面板容器 |
| 基础样式 | 只需要为新面板和反馈文本加样式 |
| 原始 pbp JSON | 仍可作为数据审计资源，不必改 |
| 当前 AI verification 入口 | 继续复用，只扩展字段和断言 |

## 3. 新的全局数据结构

建议在 `S` 中新增一个集中状态，而不是把字段散落到各处。

```js
S.tactical = {
  possessionSeq: 0,
  coachActionSeq: 0,
  adjustmentSeq: 0,
  livecastSeq: 0,
  adaptationSeq: 0,

  lastContext: null,
  contextHistory: [],

  lineupProfiles: {
    knicks: null,
    spurs: null
  },

  lastCoachAction: null,
  activeAdjustmentWindows: [],
  resolvedAdjustmentWindows: [],

  playerPatterns: {
    recentOffSchemes: [],
    recentDefSchemes: [],
    starUsage: {},
    tiredPlayersTargeted: []
  },

  opponentAdaptation: null,
  adaptationHistory: [],

  livecastTrace: [],
  debugEvents: []
};
```

### 3.1 为什么要集中放

如果不集中，后续会出现几个问题：

```text
战术系统有一套原因。
直播系统有一套原因。
换人系统有一套原因。
AI 验证又要从 DOM 猜原因。
```

集中状态可以让所有系统共享同一条因果链。

### 3.2 历史记录要限长

为了避免页面长时间运行后状态无限增长：

```text
contextHistory 保留最近 12 个回合。
livecastTrace 保留最近 40 条。
debugEvents 保留最近 80 条。
resolvedAdjustmentWindows 保留最近 10 个。
adaptationHistory 保留最近 10 个。
```

AI debug 需要足够追溯，但不能无限堆积。

## 4. 数据层适配

### 4.1 球员数据

当前球员只有基础能力：

```text
off / thr / def / reb / pg / ft / star
```

需要补：

```js
traits: {
  spacing: 72,
  handler: 92,
  rimPressure: 82,
  poaDefense: 62,
  rimProtect: 12,
  rebound: 28,
  switch: 48,
  pace: 72,
  closer: 92
}
```

影响：

```text
换人建议会从“谁累了”变成“谁能解决当前战术问题”。
阵容画像可以计算。
战术适配可以判断。
AI 验证可以检查换人是否真的改变阵容能力。
```

### 4.2 战术数据

当前已有：

```text
OFF_SCHEMES
DEF_SCHEMES
MATCHUP
DEF_BASE
SCHEME_FLAVOR
```

需要补：

```js
SCHEME_REQUIREMENTS = {
  perimeter: {
    needs: ["spacing", "handler"],
    successCauses: ["cause.scheme.counter", "cause.lineup.fit"],
    failCauses: ["cause.lineup.mismatch", "cause.scheme.blocked"]
  }
}
```

影响：

```text
战术不再只是克制矩阵，而是会检查阵容能否执行。
```

### 4.3 文字模板

当前模板按事件结果组织：

```text
make / miss / steal / block / turnover
```

需要新增按原因组织：

```text
cause.scheme.counter
cause.lineup.fit
cause.fatigue
cause.opponent.adaptation
cause.coach.adjustment_success
```

影响：

```text
直播可以解释“为什么”。
玩家操作能被明确回应。
AI 可以验证文本和 cause 是否一致。
```

## 5. 回合系统适配

### 5.1 `runPossession()` 的新职责

当前 `runPossession()` 同时负责：

```text
选人
计算失误
计算出手类型
计算命中
生成直播
更新数据
切换球权
```

接入新系统后，它还要负责：

```text
创建 PossessionContext
记录主要原因
记录战术适配
记录阵容适配
把结果写回 context
把 context 交给直播和调整窗口
```

但不建议把这些全部直接写进 `runPossession()`。

推荐拆辅助函数：

```js
createPossessionContext(off, def)
resolveSchemeFit(context)
resolveLineupFit(context)
recordOutcomeCause(context, outcome)
finalizePossessionContext(context)
```

### 5.2 接入顺序

第一阶段只记录，不影响数值：

```text
算命中率仍按旧逻辑。
但把参与计算的原因写入 context。
直播开始读取 context。
```

第二阶段才让 context 反过来影响部分数值：

```text
阵容适配会影响战术收益。
对手反制会影响战术收益。
调整窗口会追踪结果。
```

这样风险更低。

## 6. 战术系统适配

### 6.1 玩家切战术

`setMyScheme(kind, key)` 需要新增：

```text
生成 coachActionId。
记录 before / after。
判断目标问题。
创建 adjustmentWindow。
写 debug event。
同步 AI verification。
```

示例 trace：

```json
{
  "eventName": "coach.action",
  "coachActionId": "ca-0017",
  "type": "scheme_change",
  "payload": {
    "kind": "off",
    "from": "balanced",
    "to": "perimeter",
    "targetProblem": "opponent_zone"
  }
}
```

### 6.2 战术按钮 UI

战术按钮需要能显示当前关系：

```text
克制
勉强
被克制
需要空间
需要持球
体力风险
```

不建议显示数值。

建议显示：

```text
外线火力
克制联防，但当前空间一般
```

## 7. 换人系统适配

### 7.1 玩家换人

`applySub(team, outId, inId, byCoach)` 如果 `byCoach === true`，需要：

```text
生成 coachActionId。
记录换人前后的 LineupProfile。
创建 substitution 类型 adjustmentWindow。
生成 cause.lineup.* 相关候选原因。
写 debug event。
```

### 7.2 自动轮换

`autoRotate()` 不应该创建玩家操作，但要更新阵容画像。

建议：

```text
系统自动轮换 -> eventName = lineup.profile.updated
玩家主动换人 -> eventName = coach.action + lineup.profile.updated
```

这样 AI debug 能区分“玩家导致的变化”和“系统自然轮换”。

### 7.3 换人建议

`getSubSuggestion()` 需要读取：

```text
当前 opponent scheme
当前我方 scheme
LineupProfile 短板
体力红线
activeAdjustmentWindow
opponentAdaptation
```

输出结构建议：

```js
{
  problem: "马刺正在紧逼",
  need: "第二持球点",
  candidates: ["mcbride", "alvarado"],
  warning: "布伦森体力偏低，继续单持球风险增加"
}
```

UI 再把它转成自然语言。

## 8. 文字直播系统适配

### 8.1 `pushFeed()` 增加 trace 参数

当前：

```js
pushFeed(team, text, opt)
```

建议扩展为：

```js
pushFeed(team, text, {
  ...opt,
  trace: {
    livecastId,
    possessionId,
    contextId,
    causeIds,
    coachActionId,
    adjustmentId,
    adaptationId
  }
})
```

### 8.2 DOM 属性

关键直播行建议增加：

```html
data-ai-livecast-id="feed-0132"
data-ai-possession-id="p-0042"
data-ai-context-id="ctx-p-0042"
data-ai-cause-ids="cause.scheme.counter cause.lineup.fit"
data-ai-adjustment-id="adj-0009"
```

影响：

```text
AI 可以从 DOM 直接验证文本和原因链。
不执行 JS 的工具也能追溯。
```

### 8.3 文本生成优先级

接入后，直播选择文本的优先级应变为：

```text
玩家最近调整反馈
对手反制预兆
战术克制或被克制
阵容适配或不适配
体力/手感
普通结果
```

这样玩家才会感到操作被系统回应。

## 9. 教练提示和指挥台适配

### 9.1 教练提示

当前提示多由局部条件触发：

```text
对手一波流
体力低
状态冷
固定套路被针对
```

接入后，这些提示应该来自统一原因：

```text
lastContext.causeIds
activeAdjustmentWindows
opponentAdaptation
lineupProfiles
```

优点：

```text
提示、直播、实际结算说的是同一件事。
```

### 9.2 指挥台

指挥台需要新增读局摘要：

```text
当前问题
战术关系
阵容适配
主要风险
建议方向
```

但要注意：指挥台不能变成公式面板。

推荐展示：

```text
马刺正在收缩，外线是突破口。
外线火力克制联防，但当前空间只是一般。
建议补一个射手或第二持球点。
```

## 10. 对手 AI 适配

### 10.1 `aiThink()` 的新输入

对手 AI 不能只随机从战术池里选。

它应该读取：

```text
玩家最近进攻战术
玩家最近防守战术
核心使用率
疲劳球员
刚刚生效的 adjustmentWindow
玩家是否重复使用同一方案
```

### 10.2 反制流程

标准流程：

```text
检测 pattern
生成 prewarn
等待 1-2 回合
应用 adaptation
写入 context
直播解释
玩家反制后降低 adaptation
```

### 10.3 影响

对手 AI 会从“随机变阵”变成“读玩家”。

这会显著提高系统感，但也带来风险：

```text
如果预兆不清楚，玩家会觉得作弊。
如果反制太快，玩家刚调整成功就被打断，会挫败。
如果反制太弱，又没有存在感。
```

所以必须配合反制节奏表和预兆文本。

## 11. 关键球、危机决策、赛后评价适配

### 11.1 关键球

关键球选择也应该生成 `coachActionId`。

例如：

```text
选择巨星解决 -> ca-0020
结果：合理出手但未中
反馈：选择没有错，体力影响最后终结
```

这样关键球不会游离在战术系统之外。

### 11.2 危机决策

危机触发原因应来自 context：

```text
连续 bad schemeFit
核心体力红线
对手 adaptation 生效
adjustmentWindow 失败
```

这样危机不是突然弹窗，而是因果链自然推出来。

### 11.3 赛后评价

赛后教练评分可以增加：

```text
有效调整次数
调整成功率
反制应对次数
重复套路被惩罚次数
换人解决战术问题次数
```

这会让整局比赛的教练表现更有总结价值。

## 12. 教学适配

助教模式需要更新。

原来的教学重点是：

```text
进指挥台
切战术
叫暂停
换人
```

新教学应该强调因果：

```text
看到问题
选择战术意图
检查阵容能不能执行
换人补足条件
观察反馈
```

教学 trace 也要完整：

```text
assistant step -> coachActionId -> adjustmentId -> feedback livecast
```

AI 可以验证新手流程是否真的教会了系统，而不是只点完按钮。

## 13. AI 验证适配

### 13.1 快照新增字段

`ai-verify.mjs` 后续需要增加：

```js
{
  tactical: {
    lastPossessionContext,
    lineupProfiles,
    activeAdjustmentWindows,
    opponentAdaptation,
    livecastTrace,
    debugEvents,
    assertions
  }
}
```

### 13.2 新增断言

| assertionId | 规则 |
| --- | --- |
| `tactical.state.present` | `tactical` 快照存在。 |
| `context.after_possession` | 每次回合后都有 `lastPossessionContext`。 |
| `context.trace.ids_present` | 关键 context 必须有 `possessionId` 和 `contextId`。 |
| `livecast.trace.dom_present` | 关键 feed row 必须有 trace DOM 属性。 |
| `coach.action.creates_adjustment` | 玩家切战术/换人后必须创建 adjustment。 |
| `substitution.updates_lineup_profile` | 换人后阵容画像变化。 |
| `adaptation.has_prewarn` | 对手反制生效前必须有预兆。 |
| `debug.events.bounded` | debug events 不无限增长。 |

### 13.3 AI Debug 接口

建议在 `window.__NBA_LIVE_VERIFY__` 增加：

```js
getTacticalTrace()
getLastContext()
getDebugEvents()
getAdjustmentWindows()
getLivecastTrace()
```

这样调试时不需要从 UI 猜。

## 14. 部署与文档适配

### 14.1 README

后续实现后，README 应增加：

```text
如何打开 AI debug 模式。
如何读取 tactical snapshot。
如何跑战术系统 contract check。
```

### 14.2 架构文档

`docs/architecture.md` 应标明：

```text
tactical system 是横切层。
不要在直播、换人、战术模块各自维护原因状态。
原因必须来自 context。
```

### 14.3 验证脚本

现有 `tools/check-ai-contract.mjs` 后续应扩展：

```text
检查 tactical 快照字段。
检查新增 data-testid。
检查关键 trace 字段。
检查文档是否列出 causeId / adjustmentId / contextId。
```

## 15. 迁移路线

### 阶段 0：只补文档和资源

当前阶段。

完成：

```text
策划案
资源包
全局影响与适配方案
```

不改玩法。

### 阶段 1：建立状态和 trace，不改数值

目标：

```text
所有关键事件可追溯。
```

改动：

```text
S.tactical
debugEvents
coachActionId
possessionId
contextId
livecastId
```

玩家体验几乎不变，但 AI 已可追踪。

### 阶段 2：阵容画像和换人建议

目标：

```text
换人开始服务于战术。
```

改动：

```text
traits
LineupProfile
getSubSuggestion()
renderSubs()
AI snapshot
```

玩家能马上感受到变化。

### 阶段 3：原因型直播

目标：

```text
直播开始解释战术和换人。
```

改动：

```text
cause templates
pushFeed trace
context -> livecast
```

这是系统感出现的关键阶段。

### 阶段 4：调整反馈窗口

目标：

```text
玩家操作后能得到 3-5 回合总结。
```

改动：

```text
AdjustmentWindow
success / partial / failed
coach feedback text
postgame coachStats
```

### 阶段 5：对手反制

目标：

```text
比赛形成动态博弈。
```

改动：

```text
playerPatterns
opponentAdaptation
prewarn
adaptation trace
```

### 阶段 6：指挥台重构

目标：

```text
玩家能低成本读局。
```

改动：

```text
coach-read-panel
scheme fit
lineup fit
risk
suggestion
```

## 16. 影响风险

### 16.1 最大风险：系统变重

如果所有东西一次性接入，`live-sim.mjs` 会变得更难维护。

应对：

```text
先抽 tactical helper 模块。
先记录再影响数值。
先少量 cause。
```

### 16.2 数值风险：调整变成标准答案

如果阵容适配影响太大，玩家会被迫固定换人。

应对：

```text
第一版只做 20%-30% 的效果差异。
保留手感、体力、随机性。
多给部分成功反馈。
```

### 16.3 文本风险：像系统说明书

原因型直播如果太直白，会破坏氛围。

应对：

```text
普通回合短。
关键回合解释。
解释写成解说语气，不写公式。
```

### 16.4 AI 风险：对手像作弊

对手反制如果没有预兆，会让玩家不舒服。

应对：

```text
必须先 prewarn。
反制有冷却。
玩家有效调整后反制下降。
```

### 16.5 验证风险：字段频繁变化

AI 验证字段如果不断改名，后续调试会很痛苦。

应对：

```text
字段先稳定。
可以新增字段，不轻易删除字段。
快照允许 null。
```

## 17. 全局适配完成标准

这个系统算真正接入完成，需要满足：

```text
玩家切战术后，能追踪 coachActionId。
玩家换人后，LineupProfile 变化可见。
每个关键回合有 PossessionContext。
关键直播能追溯 contextId 和 causeId。
玩家操作后有 AdjustmentWindow。
对手反制前有 prewarn。
指挥台能显示局势、战术、阵容、风险、建议。
AI verify 能读取 tactical snapshot。
Debug events 能定位问题来源。
```

一句话：

```text
不是让每个模块各自多一点功能，而是让整个游戏都围绕同一条战术因果链工作。
```

## 18. 当前落地状态

已完成第一版全局适配：

- `src/tactical.mjs`：新增战术因果层，统一管理 `coachActionId`、`adjustmentId`、`possessionId`、`contextId`、`livecastId`。
- `src/data/tactical-data.mjs`：新增球员战术特征、战术需求、原因模板、对手反制规则。
- `src/live-sim.mjs`：普通回合、战术切换、换人、暂停、场边决断、关键时刻选择、对手反制、文字直播都接入 trace。
- `live.html` 和 `src/styles/live.css`：指挥台新增读局面板，展示当前战术/阵容/风险/建议；正常模式下推荐默认收起，玩家可用“助教提示”主动打开，新手助教模式自动显示。
- `src/ai-verify.mjs`：AI 快照新增 `tactical`，并新增直播 trace、战术状态、阵容 profile 的内置断言。
- `tools/check-ai-contract.mjs`：契约检查新增战术模块、战术数据、trace 字段、战术快照检查。

已验证：

- `node --check` 通过：`src/live-sim.mjs`、`src/tactical.mjs`、`src/ai-verify.mjs`、`src/state.mjs`、`src/utils.mjs`、`src/data/commentary-data.mjs`、`src/data/series-pbp-data.mjs`、`src/data/tactical-data.mjs`、`tools/check-ai-contract.mjs`。
- `node tools/check-ai-contract.mjs --url='http://127.0.0.1:8000/live.html?ai_verify=1&seed=demo-001'` 通过。
- 浏览器抽样通过：开局、进入指挥台、切换进攻战术后，所有直播行都有 `data-ai-livecast-id`，战术操作和后续回合能追溯到同一个 `coachActionId`/`adjustmentId`。
