# 下载运行包 · 一键使用

适合「解压 → 双击启动 → 用完在启动窗口 Ctrl+C 结束」的用户。

## 从哪下载

仓库 [`packages/`](../packages/) 里是 **打包后的运行包**（不是源码）：

| 策略 | 行为 |
|------|------|
| **小版本**（同大版本 + 同平台） | **覆盖替换** 对应 zip |
| **大版本 / 其它平台** | **增量** 新增文件，旧包保留 |

按本机系统选：

- Windows：`apple-co-work-v1-win32-x64.zip`
- Linux：`apple-co-work-v1-linux-x64.zip`
- macOS：`apple-co-work-v1-darwin-arm64.zip` 或 `darwin-x64`

目录：https://github.com/371684029/apple-co-work/tree/main/packages  
备选：[Releases · latest](https://github.com/371684029/apple-co-work/releases/tag/latest)

## 需要什么

- 本机已安装 **Node.js ≥ 18**（https://nodejs.org ；**推荐 Node 22+**，可走内置 sqlite，不受 better-sqlite3 编译影响）
- **不需要**先手动 `npm install`
- 若本机 Node 与打包 ABI 不一致：启动会尝试自动适配；**Node 22+** 即使适配失败也会用内置 `node:sqlite` 继续启动
- 不解压进需要管理员权限的系统目录即可

## 怎么启动

| 系统 | 操作 |
|------|------|
| **Windows** | 双击 `start.bat` |
| **macOS / Linux** | 终端执行 `chmod +x start.sh && ./start.sh`，或 `node start.mjs` |

然后：

1. 启动本机服务（默认 `http://127.0.0.1:3780`）
2. 自动打开浏览器
3. **关闭浏览器不会停服务**（切换标签页也不会）；结束请在启动窗口 **Ctrl+C**

如需「关浏览器后尝试退出服务」（实验性，可能误杀），可：

```bash
# Windows CMD
set ACW_AUTO_EXIT=1&& node start.mjs

# macOS / Linux
ACW_AUTO_EXIT=1 node start.mjs
```

## 演示流

打开后进入 **工作台** → 开聊选 **「演示流」**。  
若看不到：设置 → 偏好 → 打开「显示演示示例」。

## 数据在哪

运行后会在解压目录生成 `data/`（SQLite、日志、群报告等）。

## 注意

- 包内是 **前端 dist + 后端 bundle + 内置 node_modules**，不是完整源码树
- 请用与系统匹配的 zip（`better-sqlite3` 为平台原生模块；Node 22+ 可回退内置 sqlite）
- 请用 `127.0.0.1`，少用 `localhost`（避免 IPv6 问题）
