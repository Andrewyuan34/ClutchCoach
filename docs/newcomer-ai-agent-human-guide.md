# 新手 / AI Agent 体验与修改指南

这份文档给第一次接触项目的人和 AI Agent 使用。目标是让你不用先理解构建配置，也能快速完成：

- 打开游戏
- 亲自体验一局
- 让 AI 验证当前版本是否正常
- 把体验问题讲给 AI，继续改

本项目是静态 ES module 页面，没有打包流程。唯一入口是 `live.html`。

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
5. 切到“指挥台”。
6. 正常模式下，战术按钮不会默认标“建议”；需要帮助时点“助教提示”。
7. 叫暂停后，可以反复试不同战术，只有暂停结束时的最终方案会被系统记录。
8. 回到文字直播，看战术、换人、暂停是否在后续回合里产生反馈。

推荐重点体验：

- 不开助教提示时，自己判断战术。
- 打开助教提示时，看系统如何解释战术/阵容/风险。
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
4. 进入指挥台。
5. 点“助教提示”，确认推荐显示；再关闭，确认推荐隐藏。
6. 叫暂停。
7. 暂停期间连续切换多个进攻/防守战术。
8. 点击继续比赛。
9. 检查文字直播只结算最终战术方案。
10. 读取 `#ai-verification-state` 或 `window.__NBA_LIVE_VERIFY__.getState()`。

关键判断：

- `getAssertSummary().pass` 应为 `true`。
- 直播行数量不超过 60。
- 每条直播行应有 `data-ai-livecast-id`。
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
node --check src/ai-verify.mjs
node --check src/tactical.mjs
node --check src/state.mjs
node --check src/utils.mjs
node --check src/data/commentary-data.mjs
node --check src/data/series-pbp-data.mjs
node --check src/data/tactical-data.mjs
node --check tools/check-ai-contract.mjs
```

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
- 当前在哪个面板：文字直播 / 指挥台 / 实时数据。
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
src/tactical.mjs                  战术因果、调整窗口、trace、AI debug
src/data/tactical-data.mjs        球员战术特征、战术适配、对手反制
src/ai-verify.mjs                 AI 原生验证快照和断言
tools/check-ai-contract.mjs        静态/URL 合约检查
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
