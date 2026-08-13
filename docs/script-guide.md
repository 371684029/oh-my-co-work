# 写脚本指南（成员 script 契约）

| 属性 | 内容 |
|------|------|
| 状态 | **1.0.0 开发中** · CI03 |
| 关联 | [data-storage.md](./data-storage.md)、[data-and-ops.md](./data-and-ops.md) §9.1 |
| 更新日期 | 2026-07-28 |

面向：在「设置 → 成员」里配置 `script`（file / command）的作者。  
原则：**一切以成员配置为准**；引擎不包壳、不擅自改 cwd。

---

## 1. 两种模式

| mode | 配置 | 说明 |
|------|------|------|
| `file` | `script.filePath` / `path` | 跑本机脚本文件（bat/cmd/ps1/sh/py/js…） |
| `command` | `script.command` | 一段本机命令（走 PATH） |

可选：`runtime`、`args`、`env`、`timeoutMs`（默认 10 分钟）、`cwd`、`detach`、`showScriptPopup`、`executionMode`、`useHumanAsStdin` / `passHumanInput`、`successCodes`。

### 1.1 内嵌终端模式（2.0）

成员脚本默认 `executionMode: "terminal"`（内嵌真实 PTY）。仅非交互脚本才设 `"pipe"`：

```json
{
  "script": {
    "mode": "command",
    "command": "your-cli",
    "scriptWorkDir": "D:\\work",
    "executionMode": "terminal",
    "timeoutMs": 3600000
  }
}
```

- `terminal` 或未配置：对话终端卡 + 中栏工作区。
- `pipe`：保持原有普通执行/弹窗行为。
- TUI 必须在当前进程前台运行；脚本内调用 `Start-Process` / `start` 强制新窗口会脱离内嵌 PTY。
- 终端输入不会自动成为聊天消息；工具要输出结构化业务事件时应使用 2.x Adapter，而不是要求主项目解析屏幕字符。

---

## 2. 占位符（command / args / filePath / env 值均支持）

| 写法 | 含义 |
|------|------|
| `#1` / `{#1}` / `{1}` | 会话项目参数第 1 段（空格/换行切分） |
| `#2`… | 同理 |
| `#群聊` / `{#群聊}` | 群模板名片 |
| `#文件夹` / `{#文件夹}` / `{folder}` | 成员 script：`{folder}`/`{cwd}` 为 **脚本工作目录**；快捷指令 shell：`{folder}` 为会话工作目录目标，`{cwd}` 有脚本锚点时为脚本工作目录 |
| `#a` / `{#a}` / `{a}` / `{input}` / `{human}` | 调用参数：本轮输入框全文 / `@` `/` 去掉触发词后的正文 |
| `{sessionId}` | 当前会话 id |

长 key 优先替换（`#文件夹` 先于 `#1`）。

---

## 3. 环境变量（子进程可读）

| 变量 | 说明 |
|------|------|
| `ACW_HUMAN_INPUT` | 本轮人话全文（闸门附言 / 补参提交 / 上一次人工输入） |
| `ACW_PARAMS_JSON` | 全部参数 map 的 JSON |
| `ACW_PARAM_1` / `ACW_PARAM_#1` | 单个 `#1` |
| `ACW_PARAM_群聊` / `ACW_PARAM_文件夹` | 系统参数别名 |
| `ACW_SESSION_ID` / `ACW_MEMBER_ID` | 会话与成员 |
| `ACW_CWD` / `ACW_FOLDER` / `ACW_SCRIPT_PATH` | 工作目录与脚本路径 |

兼容旧名：`ECW_*` 同步写入。

---

## 4. cwd 与相对路径

**成员 script** 与 **斜杠 `/` 指令 shell** 共用 `scriptWorkDir`（兼容 `scriptDir`）与 `resolveScriptFilePath`；选脚本或保存时**自动**把脚本工作目录填为脚本所在目录。**与会话 / 群 / 成员「工作文件夹」无关。**

| 场景 | 说明 |
|------|------|
| 成员 · 脚本文件 / 命令 | 浏览选脚本或锚点脚本 → 自动 `scriptWorkDir`；命令含 `node index.mjs` 等时保存/运行也会推断 |
| 斜杠 `/` 指令 · 跑脚本 | 同上；可 **继承成员脚本工作目录**；不会用会话工作文件夹顶替 |
| **快捷键触发** · 跑脚本 | `hotkeyScript: true`（兼容 `desktopHotkey`）：**脚本工作目录须手填且必填**；页内/桌面/任意绑键同一规则 |
| 斜杠 / 快捷键 · 开编辑器/资源管理器 | `{folder}` / spawn cwd 为「工作目录目标」（会话/群文件夹或自定义路径） |

保存斜杠指令时会根据脚本路径补全 `scriptWorkDir`（桌面快捷键项除外）。

---

## 5. 缺参拦截（CI01）

若成员模板（`defaultText` / `command` / `path` / `args` / `env`）引用了 `#1`，或配置了 `requiresParams` / `minParams`：

- 会话尚无非空 `#1` 时：**不启动脚本**，弹出「需要项目参数」闸门  
- 提交后从**本步**继续，不跳步  
- 闸门重试时本轮输入全文 → `ACW_HUMAN_INPUT`（不强制再切 `#1`）

显式关闭检查：`config.requiresParams: false` 或 `skipParamsCheck: true`。

---

## 6. 最小示例

**command（回显参数）：**

```text
echo hello #1 folder={folder} a=#a
```

**env：**

```json
{ "MY_TOPIC": "#1", "MY_CWD": "{cwd}" }
```

**Python 读环境：**

```python
import os, json
print(os.environ.get("ACW_HUMAN_INPUT"))
print(json.loads(os.environ.get("ACW_PARAMS_JSON") or "{}"))
```

---

## 7. 不做

- 脚本直连 SQLite  
- 把整份 context 拼进超长 argv（用 env / 日后 `context.json`）  
- 无 `#1` 时静默空跑依赖项目参数的成员步  
