# apple-co-work 运行包（提交在 git）

这是 **打包后的可运行压缩包**（前端 dist + 后端 bundle + 内置 node_modules），**不是源码**。
解压后直接启动，**不需要再执行 npm install**（仍需本机安装 Node.js ≥ 18）。

## 版本策略

- **小版本（同大版本）**：覆盖替换同平台的 `apple-co-work-v{N}-{platform}-{arch}.zip`
- **大版本**：新增 `v{N+1}-…`，旧大版本包保留
- **多平台**：linux / win32 / darwin 各一份，互不覆盖

当前构建：`1.0.0-dev` · 平台 `linux-x64` · 提交 `a06513b`
本机产物：[`apple-co-work-v1-linux-x64.zip`](./apple-co-work-v1-linux-x64.zip)（5254746 bytes）

## 仓库内文件

- [`apple-co-work-v1-linux-x64.zip`](./apple-co-work-v1-linux-x64.zip)

## 启动

解压 → Windows 双击 `start.bat`；macOS/Linux 运行 `./start.sh`。
