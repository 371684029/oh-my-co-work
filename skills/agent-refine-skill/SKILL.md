---
name: agent-refine-skill
description: Agent 炼化与主动同步技能。用于第三方 Agent（如 Cursor 等 cowork 后台不可直接监听的外部 Agent）手动调用，主动向 cowork 文档中心传输本次操作的输入、输出与结论。
version: 1.0.0
---

# Agent 炼化技能 (Agent Refine Skill)

## 技能说明
当使用第三方 Agent（如 Cursor、Claude Code 等 cowork 后台无法直接监听进程状态的外部工具）时，无法通过后台自动采集日志。
本技能由第三方 Agent 在完成任务或阶段性产出后**手动主动调用**，将本次改动的上下文、代码 diff 和最终结论格式化传输回 cowork 系统，并同步写进文档中心（ANNOUNCEMENT.md 与节点台账）。

## 外部 Agent 主动调用规范 (Invocation Prompt)
```markdown
请在完成本次代码修改后，调用 agent-refine-skill 技能，将以下信息主动同步写回 cowork 文档中心：
1. 【输入】：本次用户提出的具体修改需求与目标。
2. 【输出/改动】：本次修改涉及的文件列表及核心代码变动（git diff 摘要）。
3. 【结论】：最终验证结果、待注意问题及下阶段建议。
```

## 执行步骤
1. **收集结构化数据**：第三方 Agent 汇总【输入】、【输出/改动】与【结论】。
2. **主动上报写回**：调用本地 API 或写入当前会话的 `journals/sessions/{sessionId}/ANNOUNCEMENT.md` 文件。
3. **刷新文档中心**：系统前端文档中心实时读取并渲染最新炼化台账。
