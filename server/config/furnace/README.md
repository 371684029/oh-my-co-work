# 熔炉上下文（进仓库）

角色壳各一份 prompt、一份记忆种子。运行时装入当前侧重的一套，并拼上会话情境，写成 `data/furnace/ACTIVE.md`。默认是通用 Agent；系统审核与闸门更专业，不是能力上限。

设计见 [docs/tech-crucible-3.2.md](../../../docs/tech-crucible-3.2.md)。

| 文件 | 作用 |
| --- | --- |
| **skills/**（仓库根） | **主维护**：`furnace-core` / `furnace-acw-ctl` / `furnace-refine-skill` / `furnace-review` → 同步到工作区 `.grok/skills/` |
| `prompts/*.md` | **过渡**：仍拼进 `ACTIVE.md`；与 Skill 重复时以 Skill 为准 |
| `prompts/session.md` | 群聊主持壳（过渡） |
| `prompts/refine.md` | 炼化角色壳（过渡） |

`SITUATION.md` 是本场节点地图（哪个节点是什么）。不要把多套角色 prompt 拼在一起。
配置示例见 `grok-config.example.toml`（`api_key` 一律写「秘钥」）。
