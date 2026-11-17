---
name: furnace-refine-skill
description: 熔炉炼化：备份、改源 ACW-REFINE 契约、保存成员、试跑 verify、还原。
version: 1.0.0
acw.minVersion: 6.4.0
---

# 熔炉炼化改源 (furnace-refine-skill)

**目标**：让协同台向脚本注入本轮输入（`ACW_*` env / 占位符），脚本 stdout 产出稳定标题正文 → 写入 `nodes/step-*.md` 与群报告。与 **`agent-refine-skill`**（外部 Agent 只写群报告）不同，本 Skill **会改成员源文件**。

## Checklist

1. **备份**：`node acw-ctl.mjs backup-source --member "成员名"`（或设置保存时自动 `data/backups/refine`）。
2. **真实入口**：优先炼化 `node *.mjs` / 业务脚本；勿把仅包装的 `.bat` 当主入口（本地双击可用 bat，炼化应对准 node）。
3. **改源契约**：在可注释脚本首部插入 `ACW-REFINE` 块（已有标记勿重复插核心契约，可补 `acwSyncArgvFromEnv`）：
   - 读 `ACW_HUMAN_INPUT`、`ACW_PARAM_1…n`、`ACW_PARAMS_JSON`。
   - stdout **最先**打印 `### <标题>`（标题默认可用成员显示名）。
   - 多参从 `#3` 起与 `snippets/acw-read-params.mjs` 一致。
4. **保存成员**：在设置勾选「熔炉炼化」并保存 → 服务端 `applyRefineOnMemberSave`；或 `PATCH /api/members/:id` 打开 `config.refine.enabled` 后让用户点保存。
5. **试跑**：`node acw-ctl.mjs verify-member --member "成员名"`（或设置页「试跑验证」）；探针 `ACW_HUMAN_INPUT=acw-verify-probe`，stdout 须含 `###`。
6. **失败**：引导「还原到炼化前」或还原中心；勿手改 sqlite。

## 规格 JSON

熔炉可协助产出 `config.refine.format`（`title`、input/output 模板）；保存后 `status=done`。契约事实源：`docs/guide-script.md` §炼化。

## 不要

- 不要用本 Skill 代替外部 Cursor 写群报告（用 `POST /api/docs/refine`）。
- 不要删适配备份目录叙事时碰 `data/backups/adapt`（产品已移除适配）。