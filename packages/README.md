# oh-my-co-work 运行包（提交在 git）

这是 **打包后的可运行压缩包**（前端 dist + 后端 bundle + 内置 node_modules），**不是源码**。
解压后直接启动，**不需要再执行 npm install**（仍需本机安装 Node.js ≥ 18）。

## 版本策略

- **同大版本**：覆盖替换同平台 zip（小版本只留最新）
- **新大版本**：只保留当前大版本包，旧大版本 zip 全部删除
- **多平台**：linux / win32 / darwin 各一份（当前大版本内互不覆盖）
- **发布门禁**：三平台包内 `BUILD_INFO.json` 的版本、源码提交必须一致，并包含当前熔炉图集；任一不符则不发布 latest

## 仓库内文件

| 平台 | 文件 | 大小 | 源码提交 | 构建时间 |
|------|------|------|----------|----------|
| darwin-arm64 | [`oh-my-co-work-v3-darwin-arm64.zip`](./oh-my-co-work-v3-darwin-arm64.zip) | 23888136 | `9c865a000e95` | 2026-09-02T02:50:04.431Z |
| linux-x64 | [`oh-my-co-work-v3-linux-x64.zip`](./oh-my-co-work-v3-linux-x64.zip) | 24046284 | `9c865a000e95` | 2026-09-02T02:50:04.718Z |
| win32-x64 | [`oh-my-co-work-v3-win32-x64.zip`](./oh-my-co-work-v3-win32-x64.zip) | 23882407 | `9c865a000e95` | 2026-09-02T02:50:03.459Z |

版本：`3.7.4`（大版本 v3）

## 启动

解压对应平台的 zip → Windows 双击 `start.bat`；macOS/Linux 运行 `./start.sh`。
