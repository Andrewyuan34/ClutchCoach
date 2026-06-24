# 新手 / AI Agent 体验与修改指南

这份文档给第一次接触项目的人和 AI Agent 使用。目标是让你不用先理解构建配置，也能快速完成：

- 打开游戏
- 亲自体验一局
- 让 AI 验证当前版本是否正常
- 把体验问题讲给 AI，继续改

本项目是静态 ES module 页面，没有打包流程。唯一入口是 `live.html`。

## 0. 相关设计文档

如果任务涉及玩法系统设计，优先读这些文档：

```text
docs/livecast-command-stage-redesign.md              文字直播 -> 暂停 -> 指挥台 -> 反馈的阶段化结构
docs/command-center-ui-density-redesign.md           指挥台信息密度和第一屏 UI 原则
docs/coach-staff-livecast-learning-design.md         教练组抉择、文字直播反馈、战术学习动画方案
docs/tactics-substitution-livecast-system.md         战术、换人、文字直播因果联动
docs/tactics-system-resource-pack.md                 可落地资源、原因标签、反馈窗口和验证规则
docs/ai-readable-structure-refactor-plan.md          AI 易懂项目结构优化的分阶段执行文档
```

## 1. 一句话启动

在项目根目录运行：

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

然后打开：

```text
http://127.0.0.1:8000/live.html
```

如果 8000 端口已被占用，换一个端口即可：

```powershell
python -m http.server 8001 --bind 127.0.0.1
```

对应打开：

```text
http://127.0.0.1:8001/live.html
```

不要直接双击 `live.html`，因为浏览器会按本地文件规则阻止 ES module 读取 `src/` 下的模块。

## 2. 给真人玩家的最短体验路线

1. 打开 `http://127.0.0.1:8000/live.html`。
2. 选择尼克斯或马刺。
3. 点击开始比赛。
4. 如果第一次进入有助教模式，可以跟着走一遍；熟悉后可以直接开始执教。
5. 先留在“文字直播”，观察局势条和连续几个回合的问题。
6. 看到需要处理的信号后，点击“叫暂停”。
7. 暂停后才会进入“指挥台”，正常模式下战术按钮不会默认标“建议”；需要帮助时点“助教提示”。
8. 打开“助教提示”时，先看本次主要问题，再看 1-2 条助教读法；每条读法都应该带一个清楚的代价。
9. 点击“采纳这个方向”，确认最终方案里的“代价”从“待拍板”变成具体代价。
10. 如果战术卡片上有“看战术板”，可以打开可播放的 2D 跑位战术板，理解问题、解法和代价；它是可选学习，不影响数值。
11. 暂停期间可以反复试不同战术，只有点击继续比赛时的最终方案会被系统记录。
12. 回到文字直播，看战术、换人、暂停是否在后续回合里产生反馈，尤其看采纳的代价有没有被直播点名。
13. 终场后看“教练组复盘”，确认它能说清楚一次关键暂停解决了什么、接受了什么代价、后续反馈如何验证，并能从复盘再次打开相关战术板。

推荐重点体验：

- 不开助教提示时，自己判断战术。
- 打开助教提示时，看系统如何解释战术/阵容/风险。
- 比赛进行中没有“指挥台”常驻 tab，只有暂停 / 节间才会出现完整指挥台。
- 暂停期间连续点多个战术，确认直播不会刷出一堆旧选择。
- 连续使用同一打法，观察对手是否出现预警和反制。

## 3. 给 AI Agent 的快速任务流程

当用户说“跑一下”“打开右侧面板”“亲自验证”时，优先执行这条流程：

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

如果服务已经存在，不要重复启动，直接打开：

```text
http://127.0.0.1:8000/live.html
```

需要可复现验证时打开：

```text
http://127.0.0.1:8000/live.html?ai_verify=1&seed=demo-001
```

Agent 验证时建议走这条路径：

1. 打开页面。
2. 选择一支球队。
3. 开始比赛。
4. 确认比赛进行中只有“文字直播 / 实时数据”入口，没有“指挥台”常驻 tab。
5. 观察到局势提示后点击“叫暂停”，确认暂停后才出现指挥台。
6. 在指挥台内点“助教提示”，确认推荐显示；再关闭，确认推荐隐藏。
7. 暂停期间连续切换多个进攻/防守战术。
8. 点击继续比赛。
9. 确认指挥台消失并自动回到文字直播。
10. 检查文字直播只出现一条`最终布置`摘要，并且只结算最后的战术 / 换人方案。
11. 如果打开了“助教提示”，采纳一条助教读法，确认 `最终方案` 里有具体 `代价`。
12. 在指挥台里点击 `看战术板`，确认能打开 `团队传导` 或 `收缩护框` 的 5v5 动作语法战术板，并且打开后会自动播放。
13. 拖动 `tactic-lesson-scrubber`，确认 10 个球员圆点、篮球、动作线、阶段标记和区域会随时间轴变化。
14. 恢复比赛后等待 2-4 个回合，确认直播反馈能提到这次接受的代价或执行结果。
15. 可以把比赛快进到终场，确认 `postgame.recap` 最多展示 2 条关键暂停，并且每条都有 `coachActionId` / `adjustmentId` / `acceptedCost`。
16. 读取 `#ai-verification-state` 或 `window.__NBA_LIVE_VERIFY__.getState()`。

关键判断：

- `getAssertSummary().pass` 应为 `true`。
- 直播行数量不超过 60。
- 每条直播行应有 `data-ai-livecast-id`。
- `game.phase` 在直播中应为 `live`，暂停指挥台打开时应为 `command`。
- `command.visible` 只能在暂停 / 节间布置窗口为 `true`。
- `command.commit.summaryRows` 在提交过最终方案后应为 `1`。
- `command.commit.draftSpamRows` 应为 `0`，表示暂停里试点过的方案没有逐条刷到直播里。
- `commandStaff.visibleReads` 在助教提示打开时应为 `1` 到 `2`。
- `commandStaff.reads[]` 中每条可见读法都应有 `cost`。
- 采纳助教读法后，`command.commit.acceptedCost` 应存在。
- 后续反馈出现后，`command.commit.feedbackReferencesAcceptedCost` 应为 `true`。
- `tacticLessons.available` 应包含 `motion` 和 `paint`。
- 打开战术板时，`tacticLessons.currentLesson.pureAnimation` 应为 `true`，`personnel` 应为 `10`，`primaryPersonnel` 应为 `5`。
- `tacticLessons.currentLesson.system` 应等于 `five-v-five-action-motion-v2`；`board.actorCount` 应等于 `10`，且 `sideCounts.offense` / `sideCounts.defense` 都应等于 `5`。
- `tacticLessons.currentLesson.board.primaryActorCount` 和 `contextActorCount` 都应等于 `5`。
- `tacticLessons.currentLesson.board.actors[]` 应能读到 10 名球员的当前 DOM 坐标，拖动进度条后主体和对抗方都应有球员坐标变化。
- `tacticLessons.currentLesson.board.ball` 应存在，且 `ballTransfers` 应大于等于 `1`。
- `window.__NBA_LIVE_VERIFY__.sampleTacticLessonMotion("motion")` 应返回 `maxActorTravel`、`ballHolders`、`actionTypes`、`activeActions`、`beatPhase` 和多个采样帧。
- `lesson.watchfor_used_by_feedback` 应通过，表示战术板观察点和直播反馈使用同一套标签。
- `postgame.recap.traceable_when_present` 应通过，表示赛后复盘不是孤立文案，而是能追溯到暂停、助教读法和直播证据。
- 暂停期间多次点击战术，不应立即增加多个正式调整窗口。
- 暂停结束后，只应出现最终进攻战术和最终防守战术的正式反馈。

## 4. 无浏览器的快速验证

如果只是检查项目是否破坏了 AI 合约，运行：

```powershell
node tools/check-ai-contract.mjs
```

如果本地服务正在运行，增加 URL 检查：

```powershell
node tools/check-ai-contract.mjs --url='http://127.0.0.1:8000/live.html?ai_verify=1&seed=demo-001'
```

常用语法检查：

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
node --check tools/player-smoke.mjs
```

如果需要留下“玩家路径”证据，而不是只跑静态合约，运行：

```powershell
node tools/player-smoke.mjs --seed=demo-001
```

它会启动临时本地服务，自动完成选队、开赛、叫暂停、打开助教提示、打开战术板、拖动时间轴、恢复比赛，并把截图与 JSON 证据写到 `snapshots/player-smoke/`。该目录已被 `.gitignore` 忽略，适合本地审计或提交前自查。

## 5. 怎么把体验问题讲给 AI

最有用的反馈格式：

```text
我在 Q1 8:05 叫暂停。
暂停期间我依次点了：强打内线、巨星单打、人盯人、包夹核心。
恢复比赛后，文字直播把每个点过的战术都算作生效。
期望：暂停期间只是试方案，继续比赛后只结算最终方案。
```

如果能补充这些信息，AI 会更快定位：

- 当前比分和时间。
- 当前阶段：文字直播中 / 暂停指挥台中 / 实时数据。
- 你点了哪些按钮，顺序是什么。
- 你看到的异常直播原文。
- 你期望玩家实际感受到什么。

## 6. 让 AI 修改时可以直接这样说

```text
请打开本地 live.html，复现我说的问题。
先用玩家流程确认体验，再读代码修。
修完后用 ai_verify seed 跑一遍，并告诉我：
1. 改了哪些玩家可见行为
2. 哪些 AI 验证通过
3. 是否还有没覆盖的风险
```

或者更短：

```text
右侧面板跑一下，按玩家角度验证这个问题，然后修到可验证。
```

## 7. 项目里最常看的文件

```text
live.html                         页面入口和主要 DOM 锚点
src/live-sim.mjs                  比赛流程、按钮交互、直播、指挥台
src/features/tactic-board.mjs     战术板弹层、5v5 action 动画、播放/拖动
src/features/command-center.mjs   指挥台会话、助教建议、代价、观察点、最终方案追踪
src/features/livecast.mjs         文字直播行、trace DOM、前四场语境、主场氛围文本
src/features/postgame-recap.mjs   赛后指挥复盘卡、trace 字段、战术板回看入口
src/ai/*.mjs                      AI 快照的功能域 helper，按指挥台/战术板/赛后复盘拆分
src/tactical.mjs                  战术因果、调整窗口、trace、AI debug
src/data/tactical-data.mjs        球员战术特征、战术适配、对手反制
src/ai-verify.mjs                 AI 原生验证快照和断言
tools/check-ai-contract.mjs        静态/URL 合约检查
tools/player-smoke.mjs             玩家路径浏览器 smoke，输出截图和 JSON 证据
docs/ai-verification.md           AI 验证协议
docs/architecture.md              模块边界
```

## 8. 常见问题

### 页面空白或模块加载失败

通常是直接双击了 `live.html`。请用 HTTP 服务打开。

### 端口打不开

检查服务是否在项目根目录启动。也可以换端口，比如 8001。

### AI 快照不存在

确认 URL 是 `live.html?ai_verify=1&seed=demo-001`，并等待页面加载完成。

### 页面能玩，但 Agent 验证失败

先跑：

```powershell
node tools/check-ai-contract.mjs
```

如果静态检查通过，再用带 URL 的检查确认本地服务返回的是最新文件。

## 9. 修改原则

- 玩家可见行为优先用实际页面验证，不只看代码。
- 改 UI 时同步更新稳定 `data-testid` 和 AI 文档。
- 改战术/换人/直播因果时，同步检查 `tactical` 快照和直播 `data-ai-*` trace。
- 暂停、节间、关键时刻这类“玩家布置窗口”，要区分草稿选择和正式提交。
- 不要恢复 `index.html` 作为入口；本项目只保留 `live.html`。
