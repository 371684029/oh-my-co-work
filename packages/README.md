# apple-co-work 运行包（提交在 git）

这是 **打包后的可运行压缩包**（前端 dist + 后端 bundle + 内置 node_modules），**不是源码**。
解压后直接启动，**不需要再执行 npm install**（仍需本机安装 Node.js ≥ 18）。

## 版本策略

- **同大版本**：覆盖替换同平台 zip（小版本只留最新）
- **新大版本**：只保留当前大版本包，旧大版本 zip 全部删除
- **多平台**：linux / win32 / darwin 各一份（当前大版本内互不覆盖）

## 仓库内文件

| 平台 | 文件 | 大小 |
|------|------|------|
| darwin-arm64 | [`apple-co-work-v1-darwin-arm64.zip`](./apple-co-work-v1-darwin-arm64.zip) | 5139136 |
| linux-x64 | [`apple-co-work-v1-linux-x64.zip`](./apple-co-work-v1-linux-x64.zip) | 5270728 |
| win32-x64 | [`apple-co-work-v1-win32-x64.zip`](./apple-co-work-v1-win32-x64.zip) | 5071746 |

版本：`1.2.0`（大版本 v1）

## 启动

解压对应平台的 zip → Windows 双击 `start.bat`；macOS/Linux 运行 `./start.sh`。
