# Changelog

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