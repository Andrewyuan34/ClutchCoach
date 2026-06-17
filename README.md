# 2026 NBA Finals Live Simulator

一个纯静态的中文文字直播 / 教练指挥模拟器。当前项目只保留 `live.html` 直播版入口，旧的 `index.html` 轻量小游戏已移除。

## 运行

在项目根目录启动任意静态服务器即可：

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

然后打开：

```text
http://127.0.0.1:8000/live.html
```

不要直接双击 `live.html`，因为页面使用 ES modules，浏览器会按模块规则加载 `src/` 下的脚本。

## 项目结构

```text
live.html                     # 页面结构入口
src/live-sim.mjs               # 直播模拟与教练交互主流程
src/state.mjs                  # 全局比赛状态和基础配置
src/utils.mjs                  # DOM / 随机 / 数值工具
src/data/commentary-data.mjs   # 阵容、战术、模板语料
src/data/series-pbp-data.mjs   # 前四场逐回合数据与氛围语料
src/styles/live.css           # 直播页样式
docs/architecture.md          # 模块说明与维护约定
docs/ai-verification.md       # AI 原生验证协议
tools/check-ai-contract.mjs    # 无依赖契约检查脚本
deploy.ps1                    # 上传 live 版静态文件
```

## 验证

语法检查：

```powershell
node --check src/live-sim.mjs
node --check src/state.mjs
node --check src/utils.mjs
node --check src/data/commentary-data.mjs
node --check src/data/series-pbp-data.mjs
```

AI 原生验证：

```text
http://127.0.0.1:8000/live.html?ai_verify=1&seed=demo-001
```

页面会暴露 `window.__NBA_LIVE_VERIFY__`、`#ai-verification-state` JSON 快照，以及稳定的 `data-testid`。详细协议见 [docs/ai-verification.md](docs/ai-verification.md)。

## 部署

`deploy.ps1` 会上传 `live.html`、`src/`、`docs/` 和 `README.md` 到服务器目录，并清理旧的根目录散文件。

```powershell
.\deploy.ps1
```

## AI Contract Check

AI agent / CI can run a dependency-free contract check without opening a browser:

```powershell
node tools/check-ai-contract.mjs
```

When the local server is running, include the served URL:

```powershell
node tools/check-ai-contract.mjs --url='http://127.0.0.1:8000/live.html?ai_verify=1&seed=demo-001'
```

The command prints JSON with `pass`, `failed`, and per-check details.
