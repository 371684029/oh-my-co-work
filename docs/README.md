当前开发线：**v5.9.0**（见仓库根 `package.json`）。

# 文档索引

本目录为 **oh-my-co-work** 的设计与约定文档。上手运行请先看仓库根目录 [README.md](../README.md)。

**历史计划索引**（2.x～4.x 只读参考）：见 [archive/README.md](./archive/README.md)。

## 命名规范

自 2026-11-09 起，`docs/` 根目录的 Markdown 文档统一按 **类别前缀 + 全小写 kebab-case** 命名：

| 前缀 | 类别 | 收录内容 |
|------|------|----------|
| `plan-` | 版本类 | 版本实施计划与需求文档：`plan-<版本>.md`（如 `plan-5.7.0.md`）、`plan-<主题>.md`（如 `plan-crucible-3x.md`） |
| `tech-` | 技术类 | 架构与模块设计、实现原理、数据方案（如 `tech-design.md`、`tech-data-storage.md`） |
| `spec-` | 规范类 | 工程与目录约定、自测体系、实机 QA 清单（如 `spec-selftest.md`、`spec-qa-checklist.md`） |
| `guide-` | 指南类 | 上手演示、脚本接入、压缩包用户说明（如 `guide-demo.md`、`guide-script.md`） |
| `product-` | 产品类 | 宗旨与验收、对外案例口径、品牌资产（如 `product-mvp.md`、`product-ai-case-blog.md`） |

约定：

1. 新文档先定类别再加前缀；一类一前缀，不新造同义前缀，不混用大小写。
2. 已封板版本的文档留在 `docs/` 根目录（避免破坏链接），只在 [archive/README.md](./archive/README.md) 登记为历史线。
3. `assets/` 只放图片等素材；非 Markdown 配套文件（如 `author-contact.example.json`）不加前缀。
4. 重命名文档时同步全仓库引用；`electron/main.js` 等代码内硬编码路径与锚点一并更新。

## product- 产品类

| 文档 | 用途 |
|------|------|
| [product-mvp.md](./product-mvp.md) | 宗旨、验收；`1.x` 已封 · `2.6.0` 已封 · `3.8.0` 已封（3.x）· 当前发布线 `4.9.0`（双引擎 TUI + 文档中心合并 + 桌面 Logo） |
| [product-ai-case-blog.md](./product-ai-case-blog.md) | **对外案例博客**（单一事实源）：标题/简介/分类/标签/封面/场景/痛点/AI 工具/用户/覆盖范围/频率/层级/提效/规划；README 对外叙事对齐本文 |
| [product-brand-logo.md](./product-brand-logo.md) | **Logo 含义与资产** |

## guide- 指南类

| 文档 | 用途 |
|------|------|
| [guide-demo.md](./guide-demo.md) | **怎么看演示效果**（启动、演示流点选、排障） |
| [guide-script.md](./guide-script.md) | **写脚本指南**：占位符 / `ACW_*` / cwd / 缺参拦截（CI03） |
| [guide-release-user.md](./guide-release-user.md) | **压缩包用户说明**（一键启动；默认关浏览器不停服务） |

## tech- 技术类

| 文档 | 用途 |
|------|------|
| [tech-architecture-map.md](./tech-architecture-map.md) | **架构图 / 代码结构图**：全局运行拓扑、引擎状态机、执行体与终端链路、前端分层、数据落盘、读码路线（新人第一份） |
| [tech-design.md](./tech-design.md) | 完整技术设计（含后置能力） |
| [tech-data-storage.md](./tech-data-storage.md) | **数据怎么存（SQLite / MD / 文件）** 当前实现说明 |
| [tech-data-and-ops.md](./tech-data-and-ops.md) | 数据分层原则、稳定与扩展 P0–P4；**§9 待改进 backlog**（含脚本上下文注入） |
| [tech-tui-2x.md](./tech-tui-2x.md) | **2.x 内嵌 TUI 设计**：真实 PTY、终端卡、工作区、适配器与安全边界 |
| [tech-crucible-3x.md](./tech-crucible-3x.md) | **3.x 熔炉设计**：Grok Agent、无内置工具；加人改代码 / 加适配节点 |
| [tech-crucible-3.2.md](./tech-crucible-3.2.md) | **3.2 工作流 prompt 工程**：节点一览、当前节点合同、角色壳换挡 |
| [tech-crucible-3.3.md](./tech-crucible-3.3.md) | **3.3 Grok Build 教程**：未安装/未登录/未配置时的下载登录配置 |
| [tech-crucible-3.5.md](./tech-crucible-3.5.md) | **3.5 熔炉 GUI / TUI**：铺满页面 + 缩小；同一 grok 进程 |
| [tech-crucible-3.7.md](./tech-crucible-3.7.md) | **3.7 3.x 最终封板**：chatgpt-pets 图集、头像、GUI 可读正文、短合同开炉、PTY 宿主 |
| [tech-crucible-grok-client.md](./tech-crucible-grok-client.md) | **Grok 客户端原理**：官方 CLI + node-pty，不是自研 Chat API |
| [tech-crucible-gui-plain.md](./tech-crucible-gui-plain.md) | **GUI 可读正文**：去 TUI 框线/底栏，不把整屏抄进聊天区 |

## spec- 规范类

| 文档 | 用途 |
|------|------|
| [spec-selftest.md](./spec-selftest.md) | **自测体系**：node:test 分层（139+23 例）、表征测试/依赖注入/轮询三套路、静态核查与发布闸门 |
| [spec-qa-checklist.md](./spec-qa-checklist.md) | **实机检查清单**（5.2.0 TEST-07）：三平台复制/粘贴/IME/缩放/通知勾选 |
| [spec-qa-notification.md](./spec-qa-notification.md) | **通知实机检查清单**（5.4.0 NTF-T3）：三平台权限、弹出、深链、托盘角标、勿扰 |
| [spec-frontend-components.md](./spec-frontend-components.md) | **优先 Element-Plus-X** + UI 布局/氛围约定 |
| [spec-directory-structure.md](./spec-directory-structure.md) | 目录与模块边界（对齐代码） |

## plan- 版本类

按版本线从早到晚排列：

| 文档 | 用途 |
|------|------|
| [plan-tui-2x.md](./plan-tui-2x.md) | **2.x 实施计划**：2.0～2.3 阶段、任务、测试、风险与完成定义 |
| [plan-crucible-3x.md](./plan-crucible-3x.md) | **3.x 实施计划**：3.0 入口 → 3.7 封板 |
| [plan-refactor-3.8.md](./plan-refactor-3.8.md) | **3.8 重构与加固计划**：引擎拆分 / 工作台拆分 / lint 与令牌收紧（已实施） |
| [plan-docs-4x.md](./plan-docs-4x.md) | **4.x 协同文档中心计划**：4.0.0 文档中心（已实施）、4.1.0 检索导出、4.2.0 发布更新与本地历史保留（备份/恢复/迁移链规范） |
| [plan-refine-search-4x.md](./plan-refine-search-4x.md) | **4.5 熔炉炼化 + 4.6 全局模糊搜索实施计划**（已实施核心） |
| [plan-4.7.0.md](./plan-4.7.0.md) | **4.7～5.x 总纲**（早期演进大纲；4.8/4.9 细节见下两份） |
| [plan-4.8.0.md](./plan-4.8.0.md) | **4.8.0 双引擎 TUI**：Cursor CLI + 熔炉、默认 TUI、桌面全屏；含落地跟踪 |
| [plan-4.9.0.md](./plan-4.9.0.md) | **4.9.0 文档中心与桌面图标**：Logo 托盘/exe、炼化 Skill、群报告并入文档中心；含落地跟踪 |
| [plan-5.0.0.md](./plan-5.0.0.md) | **5.0.0 目标与验收**：性能 / 交互达到「能用」；细节台账在 5.1.0 |
| [plan-5.1.0.md](./plan-5.1.0.md) | **5.1.0 全量优化清单（桌面端优先）**：内置 CLI、Electron 壳、熔炉精灵、性能、安全、仓库与发布的问题台账，带优先级与勾选状态 |
| [plan-5.2.0.md](./plan-5.2.0.md) | **5.2.0 全方位优化（进行中）**：熔炉 CLI 复制粘贴、炼化还原、文档中心入口 |
| [plan-5.3.0.md](./plan-5.3.0.md) | **5.3.0 规划**：可追溯、复用、扩展性、命令面板等 |
| [plan-5.4.0.md](./plan-5.4.0.md) | **5.4.0 规划**：完整桌面系统通知 |
| [plan-5.5.0.md](./plan-5.5.0.md) | **5.5.0 收尾 5.x 未完成项**：备份全异步、全站 E2E、设置页 i18n/aria、前端按需分块、三平台桌面包、`useSessionDetail` 拆分；剩实机通知 QA |
| [plan-5.6.0.md](./plan-5.6.0.md) | **5.6.0 需求文档**：5.x 收尾加固与三平台桌面补全（P0/P1/P2 需求清单与 DoD）；代码侧 P0 已收尾 |
| [plan-5.7.0.md](./plan-5.7.0.md) | **5.7.0 需求文档**：打包链路一劳永逸与发布治理（PKG-01~14 / REPO-01）；PKG-01~10 已落地 |

配套文件：[author-contact.example.json](./author-contact.example.json) — 支持与交流配置示例。

## 维护原则

1. **README** = 对外/对内第一入口（安装、运行、功能现状、API 摘要）。对外叙事（痛点表、面向谁、AI 层级）对齐 [product-ai-case-blog.md](./product-ai-case-blog.md)，改定位先改案例文再同步 README。  
2. **product-mvp.md** = MVP 做没做、验什么。  
3. **tech-design.md** = 为什么这样设计、后置怎么做。  
4. **tech-data-storage.md** = **当前实现**（落库路径、脚本执行、群报告、弹窗）；改 runner/journal/设置时必改。  
5. **tech-data-and-ops.md** = 工程优先级 + **§9 待改进 backlog**（脑子懵了先记着）。  
6. 改代码导致行为变化时，至少更新 README + tech-data-storage（或 product-mvp 对照）；涉及架构再改 tech-design。  
7. 改工作台布局 / 视觉氛围 / 组件用法时，同步 [spec-frontend-components.md](./spec-frontend-components.md)。  
8. **及时维护**：合并功能当天补文档修订记录，避免实现与文档漂移。  
9. **版本纪律**：`1.x` / `2.x` / **`3.7.0` 熔炉 3.x** 均已封板。

## 版本修订记录

| 版本 | 说明 |
|------|------|
| 1.7.0 | 产品统一更名为 `oh-my-co-work`。 |
| 1.8.0 | **1.x 最终封板**：跳过未执行流程默认折叠，可展开查看。 |
| 2.0.1+ | 折叠改为「未跑过的废弃节点」；去掉默认全屏。 |
| 2.0.0 | **最终封板**：真实 PTY、终端卡、中栏交互、工作台/终端全屏与发布文档。 |
| 2.0.1 | **安全加固**：本地令牌、Origin 防护、PID 与长输出/重连修复。 |
| 2.2.0 | **最终封板**：常驻终端不判超时、start.bat 双击修复、终端卡与闸门打磨、移除资源页。 |
| 2.2.1 | 内嵌终端默认常驻；非 Windows 运行时自动；下一步不杀常驻 PTY；bootstrap 要 Origin。 |
| 2.2.2 | 对话/流程轨去掉归档与超时操作；设置里选择释放资源；脚本默认不超时。 |
| 2.3.0 | **最终封板**：设置释放资源；去掉超时杀进程与归档闸门；首页文案与截图。 |
| 2.4.0 | 最终封板：终端偏好、配额、日志脱敏、JSONL Adapter、成员开聊复用。 |
| 2.5.0 | 最终封板：首页「皆可 Workflow」后加重标识终端守护者。 |
| 2.6.0 | 最终封板：终端满屏（铺满 HTML 页面）与全屏并存。 |
| 3.x | **3.7.0 最终封板**：铺满 GUI/TUI、chatgpt-pets 桌宠图集、GUI 附件（路径进 PTY）、Grok 原理 |
| 3.7.1 | 熔炉桌宠/头像裁切修复；修复 Windows 内嵌终端「File not found」启动失败；收回适配筛选 Tab；生产包发布流水线加固（打包即验 + CI 成本收紧）。 |
| 3.7.2 | 修复熔炉启动报错 `unexpected argument '--prompt'`：官方 grok CLI 没有 --prompt 参数，短启动词改经 AGENTS.md/rules 文件传，不走命令行。 |
| 3.7.3 | 临时协助节点折叠状态标出实际 @ 的成员（读 output.assists/lastInvoked 结构化数据）。 |
| 3.7.4 | 支持与交流补邮箱联系方式（371684029@qq.com）。 |
| 3.8.x | 已实施：重构与加固——engine/Workbench 拆分、复制逻辑单一来源、ESLint 进 CI、REST 收紧 `?token=`、web 纯逻辑测试。详见 [plan-refactor-3.8.md](./plan-refactor-3.8.md)。 |
| 4.x | 文档中心 4.0～4.2 已封；炼化/搜索 4.5～4.6；桌面窗口 4.7；双引擎 TUI 4.8；图标与文档中心合并 4.9。跟踪见 [plan-4.8.0.md](./plan-4.8.0.md)、[plan-4.9.0.md](./plan-4.9.0.md)。 |
