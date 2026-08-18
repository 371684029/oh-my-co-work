# oh-my-co-work 3.3 · Grok Build 教程

| 属性 | 内容 |
|------|------|
| 目标版本 | `3.3` |
| 状态 | **已接线** |
| 日期 | 2026-08-18 |

本机没有 Grok Build、没有登录、或 `~/.grok/config.toml` 还没写好秘钥时，**展示下载 / 登录 / 配置教程**。不隐藏精灵。

检测（不启动 grok，避免弹浏览器）：

| 缺口 | 判定 |
| --- | --- |
| 未安装 | PATH / `~/.grok/bin/grok` 找不到命令 |
| 未登录 | 没有 `auth.json`、没有 `XAI_API_KEY`、配置里也没有真实 `api_key` |
| 未配置 | `config.toml` 里没有非「秘钥」占位的 `api_key` |

入口：点顶栏精灵（缺口时弹教程）· 设置 → **Grok Build 教程**。

配置示例：`server/config/furnace/grok-config.example.toml`。所有 `api_key` 均为 **秘钥**，不要把真实密钥写进仓库。

官方安装：

```bash
curl -fsSL https://x.ai/cli/install.sh | bash
```

Windows：`irm https://x.ai/cli/install.ps1 | iex`

说明：https://docs.x.ai/build/overview

原「3.3 桌面精灵」后置。
