# 文档索引

本目录为 **oh-my-co-work** 的设计与约定文档。上手运行请先看仓库根目录 [README.md](../README.md)。

| 文档 | 用途 |
|------|------|
| [mvp.md](./mvp.md) | 宗旨、验收；`1.x` 已封 · 当前发布线 `2.6.0` 最终封板（§2.19～§2.28） |
| [demo.md](./demo.md) | **怎么看演示效果**（启动、演示流点选、排障） |
| [RELEASE-USER.md](./RELEASE-USER.md) | **压缩包用户说明**（一键启动；默认关浏览器不停服务） |
| [technical-design.md](./technical-design.md) | 完整技术设计（含后置能力） |
| [tui-2x.md](./tui-2x.md) | **2.x 内嵌 TUI 设计**：真实 PTY、终端卡、工作区、适配器与安全边界 |
| [tui-2x-plan.md](./tui-2x-plan.md) | **2.x 实施计划**：2.0～2.3 阶段、任务、测试、风险与完成定义 |
| [crucible-3x.md](./crucible-3x.md) | **3.x 熔炉设计**：Grok Agent、无内置工具；加人改代码 / 加适配节点 |
| [crucible-3x-plan.md](./crucible-3x-plan.md) | **3.x 实施计划**：3.0 入口 → 3.1 适配 → 3.2 情境注入 → 3.3 桌面 |
| [crucible-3.2.md](./crucible-3.2.md) | **3.2 工作流 prompt 工程**：节点一览、当前节点合同、角色壳换挡 |
| [data-storage.md](./data-storage.md) | **数据怎么存（SQLite / MD / 文件）** 当前实现说明 |
| [data-and-ops.md](./data-and-ops.md) | 数据分层原则、稳定与扩展 P0–P4；**§9 待改进 backlog**（含脚本上下文注入） |
| [script-guide.md](./script-guide.md) | **写脚本指南**：占位符 / `ACW_*` / cwd / 缺参拦截（CI03） |
| [frontend-components.md](./frontend-components.md) | **优先 Element-Plus-X** + UI 布局/氛围约定 |
| [brand-logo.md](./brand-logo.md) | **Logo 含义与资产** |
| [directory-structure.md](./directory-structure.md) | 目录与模块边界（对齐代码） |
| [author-contact.example.json](./author-contact.example.json) | 支持与交流配置示例 |

## 维护原则

1. **README** = 对外/对内第一入口（安装、运行、功能现状、API 摘要）。  
2. **mvp.md** = MVP 做没做、验什么。  
3. **technical-design.md** = 为什么这样设计、后置怎么做。  
4. **data-storage.md** = **当前实现**（落库路径、脚本执行、群报告、弹窗）；改 runner/journal/设置时必改。  
5. **data-and-ops.md** = 工程优先级 + **§9 待改进 backlog**（脑子懵了先记着）。  
6. 改代码导致行为变化时，至少更新 README + data-storage（或 mvp 对照）；涉及架构再改 technical-design。  
7. 改工作台布局 / 视觉氛围 / 组件用法时，同步 [frontend-components.md](./frontend-components.md)。  
8. **及时维护**：合并功能当天补文档修订记录，避免实现与文档漂移。  
9. **版本纪律**：`1.x` 已最终封板；当前发布线 **`2.x` 内嵌 TUI**；**`3.x` 熔炉** 仅规划（见 [crucible-3x.md](./crucible-3x.md)），未开工。

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
| 3.x | **规划中**：熔炉（加人/建群/闸门可配；桌面形态亦名熔炉）；Grok Build 式编码后置到 3.2/3.3。 |
