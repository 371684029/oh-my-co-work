# oh-my-co-work

<p align="center">
  <img src="./docs/assets/logo-mark.jpg" alt="oh-my-co-work logo" width="104" height="104" />
</p>

<h3 align="center">把人、Agent、脚本和 TUI 放进同一条 Workflow</h3>

<p align="center">
  群聊式多智能体协同工作台 · 本地优先 · 可视化流程 · 人工闸门 · 内嵌真实终端
</p>

<p align="center">
  <a href="https://github.com/371684029/oh-my-co-work/stargazers"><img src="https://img.shields.io/github/stars/371684029/oh-my-co-work?style=flat-square&color=409eff" alt="GitHub stars" /></a>
  <img src="https://img.shields.io/badge/version-3.3.0-409eff?style=flat-square" alt="version 3.3.0" />
  <img src="https://img.shields.io/badge/2.0-hardened-67c23a?style=flat-square" alt="2.0 hardened" />
  <img src="https://img.shields.io/badge/Node.js-%E2%89%A518-43853d?style=flat-square" alt="Node.js >= 18" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-6e6e73?style=flat-square" alt="platforms" />
  <img src="https://img.shields.io/badge/data-local--first-67c23a?style=flat-square" alt="local first" />
</p>

> **节点是死的，人是活的。**
> Workflow 负责串起过程，人可以确认、拒绝、插队、绕行，也可以随时回来继续。

<img src="./docs/assets/screenshots/workbench-home.webp" alt="oh-my-co-work 工作台首页：左对齐欢迎区与右侧熔炉桌宠" width="100%" />

<img src="./docs/assets/screenshots/workbench-overview.webp" alt="oh-my-co-work 三栏协同工作台" width="100%" />

## 为什么做它

很多自动化工具仍然散落在 BAT、PowerShell、CLI、TUI 和不同 Agent 里：执行在终端，决策在聊天，进度靠人脑记，出错后很难复盘。

`oh-my-co-work` 把这些能力收进一个本地工作台：

- **像群聊一样协作**：一个工作流就是一个群聊，一个 Agent / 脚本就是一个成员。
- **关键决定交给人**：启动、参数、审核都可以设置人工闸门；群聊同意最后一步即完成并归档。
- **过程始终可见**：左边看会话，中间对话和执行，右边看流程与报告。
- **终端不再跳出去**：真实 PTY 内嵌 TUI；熔炉桌宠可直接开 Grok Build（已装且已登录时默认满屏）。
- **数据留在本机**：SQLite、Markdown 台账、附件和日志全部保存在本地。

## 2.0：真实 TUI，不是终端模拟

<img src="./docs/assets/screenshots/embedded-tui-fullscreen.webp" alt="oh-my-co-work 内嵌 TUI 全屏工作区" width="100%" />

服务端使用 `node-pty`，前端使用 `xterm.js`。普通命令继续走原有 pipe 模式；交互式 CLI 可选择内嵌终端：

- 对话中出现实时终端卡，保留任务时序。
- 点击进入中栏终端工作区，右侧流程仍然可见。
- 支持键盘输入、窗口缩放、重新附着、停止进程与日志。
- 工作台和终端都可以独立全屏；终端另有 **满屏**，铺满页面、不调用系统全屏。
- 群聊走完默认归档并释放本会话进程；成员单聊不自动归档。其它占用可在设置里手动释放。
- **2.0.1**：本机 REST/WebSocket 使用随机访问令牌与回环 Origin 校验；停止、PID、长输出与断线重连已加固。

<table>
  <tr>
    <td width="50%">
      <img src="./docs/assets/screenshots/chat-terminal-collaboration.webp" alt="对话、闸门与右侧流程轨同屏" />
      <p align="center"><b>对话、闸门与流程同屏</b></p>
    </td>
    <td width="50%">
      <img src="./docs/assets/screenshots/terminal-member-settings.webp" alt="可配置的内嵌终端成员" />
      <p align="center"><b>脚本成员按需启用 TUI</b></p>
    </td>
  </tr>
</table>

## 已实现

| 能力 | 说明 |
|------|------|
| 群聊式工作流 | 群模板、成员、会话、线性节点与实时状态 |
| 人工闸门 | 启动确认、参数输入、同意/拒绝；最后一步为「同意并完成」 |
| 熔炉 | 右侧桌宠（默认小头像，距底约三分之一）；已装且已登录直接开 Grok TUI |
| 内嵌 TUI | PTY + xterm，支持输入、ANSI、resize、回放、停止、主题、粘贴确认、满屏与全屏 |
| 流程轨 | 当前节点、历史、克隆、跳过步骤折叠、从节点继续；适配角标 |
| 场外协助 | `@成员` 临时插队，完成后回到主流程 |
| 快捷输入 | `/` 指令、`@` 协助、`#` 会话参数与节点输出 |
| 群报告 | 自动汇总参数、节点输入输出和人工备注，落地 Markdown |
| 会话治理 | 置顶、改名、删除、续跑；群聊完成即归档；设置里释放资源、备份、配额与脱敏 |
| JSONL Adapter | 可信侧通道提问转闸门、工具卡与结果写回；失败降级为真实终端 |
| 本地数据 | SQLite + Markdown + 本地附件和日志 |

## 快速开始

### 直接使用运行包

在 [`packages/`](./packages/) 或 [latest release](https://github.com/371684029/oh-my-co-work/releases/tag/latest) 下载对应平台压缩包：

```text
Windows  → 解压后双击 start.bat
macOS    → 解压后运行 ./start.sh
Linux    → 解压后运行 ./start.sh
```

运行包已包含依赖，通常不需要再次执行 `npm install`；本机仍需 Node.js 18+。

### 从源码启动

```bash
git clone https://github.com/371684029/oh-my-co-work.git
cd oh-my-co-work
npm install

# 终端 1：API / Workflow 引擎
npm run dev:server

# 终端 2：Vue 工作台
npm run dev:web
```

打开 <http://127.0.0.1:5173>，选择内置的「演示流」并点击开聊。工作台会通过 `/api/bootstrap` 领取本机令牌；`/api/health` 无需令牌，其余 `/api` 与 WebSocket 需要令牌。请用 `127.0.0.1`，少用 `localhost`。

脚本成员默认使用内嵌终端。仅非交互脚本才在设置里改回「普通执行」。

### 配置一个内嵌 TUI 成员

在 **设置 → 成员管理** 中选择“内嵌终端”，或直接使用以下配置：

```json
{
  "kind": "script",
  "script": {
    "mode": "command",
    "command": "your-cli",
    "scriptWorkDir": "/your/workspace",
    "executionMode": "terminal"
  }
}
```

未设置 `executionMode` 时默认内嵌终端；只有显式选择普通执行才会走原来的 pipe。

## 技术栈

```text
Vue 3 + Element Plus + Element-Plus-X
                  │ WebSocket
Node.js + Express + Workflow Engine
                  │
        node-pty / ConPTY / PTY
                  │
      BAT · PowerShell · CLI · TUI

SQLite ── 调度真相
Markdown ── 可读台账
Local Files ── 附件与日志
```

这是一个 npm workspaces 项目：

```text
web/       Vue 工作台与 xterm 终端
server/    API、Workflow 引擎、PTY 与进程治理
shared/    状态、参数和格式化约定
docs/      产品、架构、存储与实施文档
packages/  可直接运行的三平台压缩包
```

## 文档

| 文档 | 内容 |
|------|------|
| [2.x TUI 设计](./docs/tui-2x.md) | 产品形态、PTY 架构、协议、安全与平台兼容 |
| [2.x 实施计划](./docs/tui-2x-plan.md) | 2.0～2.3 阶段、测试、风险与完成定义 |
| [3.x 熔炉设计](./docs/crucible-3x.md) | Grok Agent + 提示词适配；加人改代码 / 加适配节点；桌面亦名熔炉 |
| [3.x 熔炉计划](./docs/crucible-3x-plan.md) | 3.0～3.3 阶段与完成定义 |
| [脚本接入指南](./docs/script-guide.md) | BAT / PowerShell / CLI、参数、cwd 与终端模式 |
| [数据存储](./docs/data-storage.md) | SQLite、Markdown、附件、日志与备份 |
| [技术设计](./docs/technical-design.md) | Workflow、会话、节点、闸门与扩展设计 |
| [演示指南](./docs/demo.md) | 从启动到跑通演示流 |

## 路线图

- [x] 1.x：群聊工作台、流程引擎、闸门、归档与续跑
- [x] 2.0：真实 PTY、终端卡、中栏 TUI 工作区与全屏
- [x] 2.0.1：本机令牌与 Origin 防护、PID/长输出/重连修复
- [x] 2.2：常驻交互终端、start.bat 修复、终端卡与闸门打磨
- [x] 2.2.1：内嵌终端默认常驻、非 Windows 运行时自动、bootstrap 要 Origin
- [x] 2.3.0 最终封板：设置释放资源、去掉超时/归档闸门、终端守护者
- [x] 2.4.0 最终封板：终端偏好、配额、日志脱敏、重连缺口提示、JSONL Adapter 提问转闸门
- [x] 2.5.0 最终封板：首页「皆可 Workflow」后加重标识终端守护者
- [x] 2.6.0 最终封板：终端满屏（铺满 HTML 页面）与全屏并存
- [x] 3.3.0 最终封板：熔炉桌宠、适配、工作流 prompt、Grok Build 教程；已登录直接开 TUI；群聊完成即归档
- [ ] 后续：多终端标签治理、更多 CLI Adapter
- [ ] 桌面壳、托盘与系统通知

## 参与项目

欢迎提交 [Issue](https://github.com/371684029/oh-my-co-work/issues) 或 Pull Request：

1. 先描述使用场景和希望解决的问题。
2. 行为变化同步更新文档。
3. 新执行体优先保持可插拔，不把具体工具写死在 Workflow 内核。

如果这个项目让你的脚本、Agent 或 TUI 更容易协作，欢迎点一个 **Star**。
它会帮助更多正在解决同类问题的人看到这个项目。
