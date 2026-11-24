# Changelog

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