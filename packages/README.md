# oh-my-co-work 运行包（提交在 git）

这是 **打包后的可运行压缩包**（前端 dist + 后端 bundle + 内置 node_modules），**不是源码**。
解压后直接启动，**不需要再执行 npm install**（仍需本机安装 Node.js ≥ 18）。

## 版本策略

- **同大版本**：覆盖替换同平台 zip（小版本只留最新）
- **新大版本**：只保留当前大版本包，旧大版本 zip 全部删除
- **多平台**：linux / win32 / darwin 各一份（当前大版本内互不覆盖）

## 仓库内文件

| 平台 | 文件 | 大小 |
|------|------|------|
| darwin-arm64 | [`oh-my-co-work-v2-darwin-arm64.zip`](./oh-my-co-work-v2-darwin-arm64.zip) | 20853718 |
| linux-x64 | [`oh-my-co-work-v2-linux-x64.zip`](./oh-my-co-work-v2-linux-x64.zip) | 21027353 |
| win32-x64 | [`oh-my-co-work-v2-win32-x64.zip`](./oh-my-co-work-v2-win32-x64.zip) | 21371748 |

版本：`2.6.0`（大版本 v2）

## 启动

解压对应平台的 zip → Windows 双击 `start.bat`；macOS/Linux 运行 `./start.sh`。
