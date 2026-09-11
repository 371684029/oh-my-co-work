# oh-my-co-work 运行包（提交在 git）

这是 **打包后的可运行压缩包**（前端 dist + 后端 bundle + 内置 node_modules），**不是源码**。
解压后直接启动，**不需要再执行 npm install**（仍需本机安装 Node.js ≥ 18）。

Windows **桌面窗口包**（内含 Electron + Node，一般不用装 Node.js）体积超过 GitHub 仓库 100MB 限制，不进本目录；请到 [latest release](https://github.com/371684029/oh-my-co-work/releases/tag/latest) 下载 `*-win32-x64-desktop.zip`。

## 版本策略

- **同大版本**：覆盖替换同平台 zip（小版本只留最新）
- **新大版本**：只保留当前大版本包，旧大版本 zip 全部删除
- **多平台**：linux / win32 / darwin 各一份（当前大版本内互不覆盖）
- **发布门禁**：三平台包内 `BUILD_INFO.json` 的版本、源码提交必须一致，并包含当前熔炉图集；任一不符则不发布 latest

## 仓库内文件

| 平台 | 文件 | 大小 | 源码提交 | 构建时间 |
|------|------|------|----------|----------|
| darwin-arm64 | [`oh-my-co-work-v4-darwin-arm64.zip`](./oh-my-co-work-v4-darwin-arm64.zip) | 24273823 | `6dbdfd2ab154` | 2026-09-11T08:00:17.543Z |
| linux-x64 | [`oh-my-co-work-v4-linux-x64.zip`](./oh-my-co-work-v4-linux-x64.zip) | 24431964 | `6dbdfd2ab154` | 2026-09-11T08:00:17.143Z |
| win32-x64 | [`oh-my-co-work-v4-win32-x64.zip`](./oh-my-co-work-v4-win32-x64.zip) | 24268089 | `89467c7073a8` | 2026-09-11T07:47:18.409Z |

版本：`4.7.0`（大版本 v4）

## 启动

解压对应平台的 zip → Windows 双击 `start.bat`（浏览器）；macOS/Linux 运行 `./start.sh`。
Windows 桌面窗口请用 Release 里的 `*-win32-x64-desktop.zip`。
