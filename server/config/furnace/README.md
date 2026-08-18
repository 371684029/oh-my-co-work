# 熔炉上下文（进仓库）

三套作用各一份 prompt、一份记忆种子。运行时只装当前这一套，写成 `data/furnace/ACTIVE.md`。

| 文件 | 作用 |
| --- | --- |
| `prompts/member-adapt.md` | 把当前成员接到工作台 |
| `prompts/node-adapt.md` | 把当前步骤接到工作台 |
| `prompts/review.md` | 闸门通过 / 拒绝 |

`memory-seed/` 只在本机 `data/furnace/memory/` 还不存在时复制过去。不要把三套拼进同一份。
