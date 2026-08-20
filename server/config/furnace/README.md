# 熔炉上下文（进仓库）

角色壳各一份 prompt、一份记忆种子。运行时只装当前这一套，并拼上会话情境，写成 `data/furnace/ACTIVE.md`。开熔炉时再写入同目录 `AGENTS.md` 标记块（官方 Grok CLI 会读），**不改** `~/.grok/AGENTS.md`。

设计见 [docs/crucible-3.2.md](../../../docs/crucible-3.2.md)。

| 文件 | 作用 |
| --- | --- |
| `prompts/session.md` | 群聊主持：读懂这场群在做什么 |
| `prompts/member-adapt.md` | 把当前成员接到工作台 |
| `prompts/node-adapt.md` | 把当前步骤接到工作台 |
| `prompts/review.md` | 闸门通过 / 拒绝 |

`SITUATION.md` 是本场节点地图（哪个节点是什么）。不要把多套角色 prompt 拼在一起。
配置示例见 `grok-config.example.toml`（`api_key` 一律写「秘钥」）。
