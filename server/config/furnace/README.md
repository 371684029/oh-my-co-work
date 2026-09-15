# 熔炉上下文（进仓库）

角色壳各一份 prompt、一份记忆种子。运行时装入当前侧重的一套，并拼上会话情境，写成 `data/furnace/ACTIVE.md`。默认是通用 Agent；系统审核与闸门更专业，不是能力上限。

设计见 [docs/crucible-3.2.md](../../../docs/crucible-3.2.md)。

| 文件 | 作用 |
| --- | --- |
| `prompts/session.md` | 群聊主持：通用 Agent，审核/闸门更专业 |
| `prompts/member-adapt.md` | 把当前成员接到工作台 |
| `prompts/node-adapt.md` | 把当前步骤接到工作台 |
| `prompts/refine.md` | 把成员输入/输出炼成文档；保存时改源契约 |

`SITUATION.md` 是本场节点地图（哪个节点是什么）。不要把多套角色 prompt 拼在一起。
配置示例见 `grok-config.example.toml`（`api_key` 一律写「秘钥」）。
