# oh-my-co-work 3.3 · Grok Build 教程

| 属性 | 内容 |
|------|------|
| 目标版本 | `3.3` |
| 状态 | **已封板** |
| 日期 | 2026-08-18 |

本机没有 Grok Build、或没有登录时，**展示下载 / 登录 / 配置教程**。不隐藏精灵。已装且已登录后点精灵直接开 TUI。

检测（不启动 grok，避免弹浏览器）：

| 缺口 | 判定 |
| --- | --- |
| 未安装 | PATH / `~/.grok/bin/grok` 找不到命令 |
| 未登录 | 没有 `auth.json`、没有 `XAI_API_KEY`、配置里也没有真实 `api_key` |
| 未配置 | `config.toml` 里没有非「秘钥」占位的 `api_key` |

探测字段：

| 字段 | 含义 |
| --- | --- |
| `canRun` | 已装且已登录（官方 OAuth 即可），够开熔炉 |
| `ready` | `canRun` 且已写好第三方 `config.toml` 真实秘钥 |

未装或未登录时点精灵弹教程。本机 `canRun`（已装且已登录）时点精灵**直接开熔炉 Grok TUI（默认满屏）**，不先弹教程。

入口：右侧熔炉桌宠（未装或未登录时弹教程；可戳可拖）· 设置 → **Grok Build 教程**。

配置示例：`server/config/furnace/grok-config.example.toml`。所有 `api_key` 均为 **秘钥**，不要把真实密钥写进仓库。

官方安装：

```bash
curl -fsSL https://x.ai/cli/install.sh | bash
```

Windows：`irm https://x.ai/cli/install.ps1 | iex`

说明：https://docs.x.ai/build/overview

原「3.3 桌面精灵」后置。
