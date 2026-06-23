# AI 易懂项目结构优化执行文档

## 目标

把项目整理成 AI / Agent 能快速理解、定位、修改、验证的结构。优化优先级不是“目录漂亮”，而是：

- 新 Agent 能在 3 分钟内知道入口、核心模块、验证命令。
- 改战术板、指挥台、文字直播、赛后复盘时，不必先通读 `src/live-sim.mjs`。
- 每个功能域都有清晰边界：状态从哪里来、DOM 在哪里渲染、AI 快照在哪里验证。
- 每一次拆分都保持玩家可见行为不变，并且通过现有 AI 合约。

## 当前结构问题

- `src/live-sim.mjs` 同时承担 app 启动、比赛推进、文字直播、暂停指挥台、换人、战术板、赛后复盘和 UI 事件绑定，文件过大。
- `src/ai-verify.mjs` 已经提供稳定快照，但功能域和快照域还没有在目录结构上对应起来。
- `docs/architecture.md` 只是模块说明，还不是“改什么去哪里”的 Agent 地图。
- 战术板已经升级为 `five-v-five-action-motion-v2`，它边界清晰，适合作为第一批样板拆分。

## 执行原则

- 不恢复 `index.html`，产品入口仍然只有 `live.html`。
- 不改比赛数值结算，不改玩家流程，不改 AI 合约字段语义。
- 每次只拆一个功能域，先抽函数和最小依赖，再跑验证。
- `src/live-sim.mjs` 保留为 app shell / orchestration 层，不继续塞新功能。
- 新模块必须使用显式 `import` / `export`，不引入 script-tag globals。
- 文档和验证必须跟代码一起改：新增模块后同步 `docs/architecture.md`、`AGENTS.md`、`tools/check-ai-contract.mjs`。

## 目标目录形态

```text
src/
  live-sim.mjs                  app shell：启动、主流程、跨域协调
  state.mjs                     全局状态和常量
  utils.mjs                     通用小工具
  tactical.mjs                  战术因果和 trace 逻辑
  ai-verify.mjs                 AI 快照唯一公开入口
  ai/
    dom-utils.mjs               AI 快照 DOM 小工具
    command-signals.mjs         指挥台快照 helper
    tactic-lesson-signals.mjs   战术板快照和动作采样 helper
    postgame-signals.mjs        赛后复盘快照 helper
  features/
    tactic-board.mjs            战术板学习层：打开、播放、渲染、时间轴
    command-center.mjs          暂停指挥台：助教、最终方案、提交
    livecast.mjs                文字直播：行渲染、trace DOM、反馈行
    postgame-recap.mjs          赛后教练组复盘
  data/
    commentary-data.mjs
    series-pbp-data.mjs
    tactical-data.mjs
```

## 分阶段执行

### Phase 1：文档和战术板样板拆分

交付：

- 新增本文件作为结构优化执行文档。
- 新增 `src/features/tactic-board.mjs`。
- 将战术板学习层从 `src/live-sim.mjs` 迁出：
  - `lessonForScheme`
  - `lessonIdForAdvice`
  - `openTacticLesson`
  - `closeTacticLesson`
  - `seekTacticLesson`
  - `toggleTacticLessonAuto`
  - 战术板播放 RAF
  - 战术板 DOM 渲染
  - action motion 绘制 helper
- `src/live-sim.mjs` 只保留调用入口：事件绑定、指挥台卡片打开战术板、赛后复盘打开战术板。

验收：

- 战术板只能在暂停 / 节间 / 赛后复盘打开。
- `motion` 和 `paint` 仍返回 `five-v-five-action-motion-v2`。
- 拖动时间轴后，10 名球员、球、active actions、beat phase 都可被 AI 读到。
- `node tools/check-ai-contract.mjs --url=...` 通过。

### Phase 2：指挥台拆分

交付：

- 新增 `src/features/command-center.mjs`。
- 迁出暂停指挥台 UI、助教提示、最终方案、推荐隐藏逻辑。
- `live-sim.mjs` 只负责进入 / 退出指挥台和比赛主循环衔接。

验收：

- 比赛进行中没有常驻指挥台 tab。
- 暂停期间多次点战术，只提交最终方案。
- 普通模式推荐默认隐藏，助教提示打开后显示。
- `command.*` AI assertions 通过。

### Phase 3：文字直播拆分

交付：

- 新增 `src/features/livecast.mjs`。
- 迁出 `pushFeed`、直播行 DOM、trace dataset、反馈行生成。

验收：

- 每条直播行仍有 `data-ai-livecast-id`。
- 指挥台提交、后续反馈、赛后复盘仍能追溯到 livecast row。
- 直播行数和滚动表现不退化。

### Phase 4：赛后复盘拆分

交付：

- 新增 `src/features/postgame-recap.mjs`。
- 迁出教练组复盘 item 构建和 DOM 渲染。

验收：

- 赛后最多展示 2 条关键暂停复盘。
- 每条复盘仍包含 `coachActionId` / `adjustmentId` / `acceptedCost`。
- 复盘里的“看战术板”仍能打开对应 lesson。

### Phase 5：AI 快照内部整理

交付：

- 保持 `src/ai-verify.mjs` 为唯一公开入口。
- 内部按功能域整理 snapshot helper，减少大函数堆叠。
- `tools/check-ai-contract.mjs` 按 command / tactic-board / livecast / postgame 分组。

验收：

- `AI_VERIFY_CONTRACT.globalName`、`getState()`、`getAssertions()`、`sampleTacticLessonMotion()` 外部行为不变。
- 静态和 URL 合约都通过。

## 每阶段固定验证

```powershell
node --check src/live-sim.mjs
node --check src/features/tactic-board.mjs
node --check src/features/command-center.mjs
node --check src/features/livecast.mjs
node --check src/features/postgame-recap.mjs
node --check src/ai-verify.mjs
node --check src/ai/dom-utils.mjs
node --check src/ai/command-signals.mjs
node --check src/ai/tactic-lesson-signals.mjs
node --check src/ai/postgame-signals.mjs
node --check src/tactical.mjs
node --check src/state.mjs
node --check src/utils.mjs
node --check src/data/commentary-data.mjs
node --check src/data/series-pbp-data.mjs
node --check src/data/tactical-data.mjs
node --check tools/check-ai-contract.mjs
node tools/check-ai-contract.mjs
node tools/check-ai-contract.mjs --url='http://127.0.0.1:8000/live.html?ai_verify=1&seed=demo-001'
git diff --check
```

## 本轮实际执行范围

本轮已按本文档顺序执行 Phase 1-5。执行方式是每完成一个功能域拆分，就同步更新 `docs/architecture.md`、`AGENTS.md`、`docs/newcomer-ai-agent-human-guide.md` 和 `tools/check-ai-contract.mjs`，再跑静态检查与 AI 合约检查。

## Phase 1 执行记录

- 已新增 `src/features/tactic-board.mjs`。
- 已迁出战术板学习层：lesson 查找、打开 / 关闭弹层、自动播放、时间轴拖动、5v5 action motion 渲染、球员 / 篮球 / 动作线 / 区域 DOM 标记。
- `live-sim.mjs` 现在通过 `initTacticBoardFeature` 初始化战术板，并在指挥台卡片、赛后复盘卡需要学习入口时调用 `openTacticLesson`。
- `tools/check-ai-contract.mjs` 已增加 `structure.tactic_board_feature_module`，用于确认战术板学习层已从主文件迁出。
- 验收重点保持不变：战术板只从暂停 / 节间指挥台或赛后复盘打开，`motion` / `paint` 都保持 `five-v-five-action-motion-v2`，拖动时间轴后 10 名球员、篮球、active actions 和 beat phase 都可被 AI 读取。

## Phase 2 执行记录

- 已新增 `src/features/command-center.mjs`。
- 已迁出指挥台会话、UI 状态、助教读法、代价标签、观察点、最终方案提交、反馈文案和赛后复盘摘要 helper。
- `live-sim.mjs` 现在通过 `initCommandCenterFeature` 注入 `renderCmd`、`setMyScheme`、`fmtClock`、`lineupChangePairs`、`pushFeed`、`noteCoachAction`、`stageCoachEffect` 等跨系统回调。
- `live-sim.mjs` 暂时保留战术按钮组、阵容按钮组和整体 `renderCmd` 编排；这些仍强依赖比赛页面 DOM、换人组件和新手指引，后续可作为 Phase 2b 或 Phase 3 前置继续拆。
- `tools/check-ai-contract.mjs` 已增加 `structure.command_center_feature_module`，用于确认 `createCommandSession`、`commitSubWindowSchemePlan`、`renderCommandStaff`、`commandEffectFeedbackText` 已从主文件迁出。
- 验收重点保持不变：比赛中没有常驻指挥台 tab，暂停/节间才进入指挥台，多次点战术只提交最终方案，助教提示默认隐藏且打开后可追溯到 accepted cost / watchFor / feedback。

## Phase 3 执行记录

- 已新增 `src/features/livecast.mjs`。
- 已迁出 `pushFeed`、`richFeed`、`maybeRichFeed`、`homeCrowdText`、`fmtClock`。
- 直播行 DOM、`data-testid="feed-row"`、`data-ai-livecast-id`、`data-ai-context-id`、`data-ai-cause-ids`、`data-ai-command-session-id`、`data-ai-accepted-cost`、`data-ai-feedback-kind` 等 trace 字段现在集中在 livecast feature。
- `live-sim.mjs` 继续负责比赛事件文本、比分和回合推进，只调用 livecast feature 输出直播。
- `tools/check-ai-contract.mjs` 已增加 `structure.livecast_feature_module`，用于确认直播行渲染和 trace DOM 已从主文件迁出。
- 验收重点保持不变：每条直播行仍可被 AI 通过 DOM 和 `tactical.livecastTrace` 追溯，指挥台提交、后续反馈、赛后复盘仍能连到对应 livecast row。

## Phase 4 执行记录

- 已新增 `src/features/postgame-recap.mjs`。
- 已迁出 `buildPostgameRecapItems` 和 `renderPostCoachRecap`。
- 赛后复盘卡的 `data-testid="post-recap-item"`、`data-testid="post-recap-lesson"`、`data-ai-command-session-id`、`data-ai-coach-action-id`、`data-ai-adjustment-id`、`data-ai-accepted-cost`、`data-ai-lesson-id` 等字段现在集中在 postgame recap feature。
- 该模块从 `command-center.mjs` 读取指挥台摘要 helper，从 `tactic-board.mjs` 打开对应战术板，`live-sim.mjs` 只负责在赛后面板出现时调用 `renderPostCoachRecap`。
- `tools/check-ai-contract.mjs` 已增加 `structure.postgame_recap_feature_module`，用于确认赛后复盘卡构建、trace DOM 和战术板回看入口已从主文件迁出。
- 验收重点保持不变：赛后最多展示关键指挥复盘，卡片仍能追溯 `coachActionId` / `adjustmentId` / `acceptedCost`，并能从“看战术板”打开对应 lesson。

## Phase 5 执行记录

- 已新增 `src/ai/dom-utils.mjs`，集中 `clone`、`isVisible`、`parsePercent` 等浏览器快照小工具。
- 已新增 `src/ai/command-signals.mjs`，迁出指挥台相关快照 helper：推荐可见性、助教读法、阵容确认、面板尺寸、最终提交、accepted cost、watchFor 和草稿刷屏检测。
- 已新增 `src/ai/tactic-lesson-signals.mjs`，迁出战术板快照 helper：lesson 列表、当前战术板 DOM 坐标、5v5 人数、active actions、beat phase、球权采样和 `sampleTacticLessonMotion()`。
- 已新增 `src/ai/postgame-signals.mjs`，迁出赛后复盘快照 helper：复盘卡、trace ids、lesson links、accepted cost 和 livecast 证据。
- `src/ai-verify.mjs` 仍然是唯一公开入口，继续暴露 `window.__NBA_LIVE_VERIFY__`、`getState()`、`getAssertions()`、`getAssertSummary()` 和 `sampleTacticLessonMotion()`。
- `tools/check-ai-contract.mjs` 已增加 `structure.ai_snapshot_helper_modules`，并改为按 helper 模块检查 command / tactic lesson / postgame 的内部快照来源。
- 验收重点保持不变：外部 AI 合约不变，但后续 Agent 可以按功能域去 `src/ai/` 定位快照和断言来源。
