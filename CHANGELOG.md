# Changelog

## 6.14.0 — 熔炉 TUI / 临时协助 / 炼化 diff

- **熔炉**：TUI 下节流解析 PTY replay，右侧对话抽屉有正文；**「回到最新」** 回 xterm 底部。
- **临时协助**：`@成员` 不再用群聊正文 `appendProjectParams` 冲掉「下一步」绑定的 `#n`；与主线一致校验 `ctx.params`。
- **文档中心**：炼化/节点 **unified diff 红绿对比**（行号 + 删红增绿），流程轨同步。

## 6.13.0 — FSK-B、工作区确认、设置拆分

- **FSK-B**：`furnace.promptsFromSkills`；会话/炼化/审核 ACTIVE 嵌入 bundled **Skill 正文**；`session.md` 不再重复整段手册。
- 自定义 **Grok workspace**：同步 Skills 前 **二次确认**（`NEEDS_WORKSPACE_ACK`）；Prefs 可编辑 `grok.workspaceDir`。
- **工程**：`MembersListPanel` / `PrefsFurnaceSkillsCard` / `PrefsGrokCard` 拆分。
- **治理**：[`docs/plan-backlog-wont-do.md`](docs/plan-backlog-wont-do.md) 明确禁止项。

## 6.12.0 — backlog P2 + 体验收口

- **RFD-13**：文档中心炼化 diff **导出 `.patch`**；`GET /members/:id/refine/history/:manifestId/patch?file=`。
- **RFD-22**：时间线事件 `refine.source_patched`；工作台时间线分类 **炼化改源**。
- **NTF-R**：终端/Agent 步炼化整理完成后轻量 toast；炼化回落 toast 接线。
- **CUR-F**：Cursor 熔炉启动时镜像 bundled Skills 到 `.cursor/rules/*.mdc`。
- **fix**：首屏预载 `ElDropdown` CSS，修复会话列表 ⋯ 菜单重启后竖排裸样式。

## 6.11.0 — 产品 backlog P1 收口

- 设置：`settings.refine.backup`（兼容 `adapt.backup`）；成员炼化 **文档标题** 可编辑。
- 文档中心炼化台账 **按成员名过滤**；`?pane=refine&memberId=` 高亮；`GET /members/:id/refine/history`。
- 流程轨失败节点深链「查看该成员炼化 diff」。
- **RCL-07**：纯包装 `.bat` 默认不插契约（`patchBatWrapper` 覆盖）。
- **SRC-06**：`Ctrl/Cmd+Shift+F` 打开全局聊天搜索。
- 文案：核心「适配」标签改为「炼化/回落」口径。

## 6.1.0 — 文档中心扁平 + 终端历史定格（口径）

- 文档中心「按群模板」：**一会话一行**，点开会话群报告；节点台账不进侧栏（仍可搜索/深链）。
- 工作台终端：进程结束或服务重启后，从 `terminal_sessions` + 日志尾部 **只读回填** 会话内定格卡（文本回放，非位图截图）。

## 6.10.0 — 文档与协作指引对齐

- `AGENTS.md` 升至 6.10.0：补充 `electron/`、`skills/`、`engine/` 目录与 `plan-backlog` 入口。
- `README` 路线图瘦身为阶段表，版本史移交 `CHANGELOG` / `plan-backlog`。
- `docs/product-mvp.md`、`docs/tech-architecture-map.md`、`docs/README.md` 当前发布线对齐。
- `docs/guide-release-user.md` 补充贡献期 PR 策略；`docs/plan-6.10.0.md` 本版台账。
- E2E：`ci-e2e-smoke` 多会话切换断言改为「搜索全部会话聊天」（6.2 全局搜索后旧文案失效）。

## 6.9.0 — 熔炉按 ACTIVE 绑定要改的工具

- 已保存且有脚本路径的成员可「进入熔炉改这个工具」，不看炼化开关和试跑成败。
- 绑定写在 `data/furnace/ACTIVE.md`：正在改、已挂起、未绑定。换成员才新开进程；先聊别的、继续改同一成员都接着聊。
- 短脚本试跑看自己的退出码，抽屉显示「退出码 N」，不再只写 `EXIT`。打印标题后仍不退出的进程按常驻通过。探针程序起不来立刻失败，不再把本机服务干等到超时。正式执行会清掉 `ACW_VERIFY`。
- 进入熔炉时记下所选的 Grok 或 Cursor。只要没关掉规则写入，工具提示也会写入 `AGENTS.md`。

## 6.8.0 — 试跑失败 → 熔炉炼化 + 会话命名

- 炼化试跑未通过：成员设置与文档中心 **「前往熔炉炼化」**；`GET /api/members/:id/refine/verify-prompt`；弹窗选 Grok/Cursor/外部；跳进工作台熔炉并复制任务到剪贴板（TUI 粘贴）。
- 会话自动命名：`autoTitleParam1` / `kickoff` 优先；群聊与 @协助不再 `syncAutoSessionTitle`。

## 6.5.0 — 炼化改源 unified diff

- 保存前 `refine/plan` 与文档中心还原区共用 `buildUnifiedDiff`（git 式 `@@` hunk）。
- 关闭「炼化改源前备份」时不再改写源文件（`backup_disabled`）。
- 文档中心 `/docs?pane=refine`；成员保存 toast 提示查看 diff。
- 清理遗留「是否适配」文案与 API 客户端；偏好备份文案对齐炼化。

## 6.4.0 — 熔炉 Skill 化 + 炼化 IO 收口

- 熔炉 Grok：`skills/furnace-*` 同步至 `.grok/skills/`；`AGENTS.md` 瘦身；`ACTIVE.md` 列 Skills。
- 炼化：情境自动切 `REFINE` 角色；JSONL `adapterResult.summary` 进炼化链；文档中心 **step 台账可编辑**。
- 设置：成员炼化契约预览（默认展开）、`refine.format` 只读摘要、bat 包装警告；偏好页 **熔炉 Skills** 一键同步。
- 流程轨：节点失败时深链文档中心 / 成员炼化。
- 文档：`guide-script.md` §3.0 对接模型；`tech-crucible-3.2` Skills 增补。

## 6.2.0 — 全局搜索、完成归档、炼化合一

见 `docs/plan-6.2.0.md` 与 PR #172。