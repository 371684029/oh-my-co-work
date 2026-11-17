---
name: furnace-acw-ctl
description: 通过 acw-ctl.mjs 添加成员、建群模板、编排步骤（HTTP API，与设置页同源）。
version: 1.0.0
acw.minVersion: 6.4.0
---

# 成员与群模板 (furnace-acw-ctl)

在工作目录执行 **`node acw-ctl.mjs`**（需本机 oh-my-co-work 已启动；令牌由 bootstrap 自动获取）。

## 查询

- `node acw-ctl.mjs members`
- `node acw-ctl.mjs groups`
- `node acw-ctl.mjs help`

## 添加或更新脚本成员

1. 先看用户给的工具目录：README / package.json / 入口脚本，弄清启动命令与参数顺序（`#1` `#2`…）。
2. 落库示例：

```bash
node acw-ctl.mjs add-member --name "newBranch" --cmd "node index.mjs #1 #2 #3" --cwd "D:\\ai\\work\\newBranch"
```

- `--file` 替代 `--cmd`；常驻 TUI 加 `--keepalive`；静默后台加 `--pipe`；同名自动更新。
- 需要炼化时在设置页勾选「熔炉炼化」并保存，或见 **`furnace-refine-skill`**；`add-member --refine` 若 CLI 支持则与 GUI 一致。
- 多参 Node 脚本：改参逻辑参考工作区 `snippets/acw-read-params.mjs`（`#3` 起 rest 读 `ACW_PARAM_n` / `ACW_PARAMS_JSON`）。

## 建群与步骤

```bash
node acw-ctl.mjs add-group --title "前端流水线" --cwd "D:\\ai\\work" --steps "human:输入需求,成员名:步骤标题,成员名:另一格:gate"
```

- `:gate` 表示跑完需人工确认。
- 往已有群追加：`node acw-ctl.mjs append-step --group "群名" --member "成员名" --title "步骤标题" [--gate]`

## 备份（炼化改源前）

```bash
node acw-ctl.mjs backup-source --member "成员名" [--files "路径1,路径2"]
```

备份在 `data/backups/refine`；用户可在「文档中心 → 还原中心」对比与还原。

## 收尾

执行后 `members` / `groups` 核对一遍，提示用户去左侧群模板点「开聊」。