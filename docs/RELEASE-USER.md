# 下载压缩包 · 一键使用

适合「解压 → 双击启动 → 关浏览器即停」的用户。

## 从哪下载

压缩包**提交在 git 仓库**的 `packages/` 目录：

| 策略 | 行为 |
|------|------|
| **小版本**（同大版本，如 1.0 → 1.1） | **覆盖替换** `packages/apple-co-work-v1.zip` |
| **大版本**（如 1.x → 2.0） | **增量**：新增 `apple-co-work-v2.zip`，保留旧的 `v1.zip` |

- 当前大版本包：[`packages/apple-co-work-v1.zip`](../packages/apple-co-work-v1.zip)  
- 直链：https://github.com/371684029/apple-co-work/raw/main/packages/apple-co-work-v1.zip  
- 备选：[Releases · latest](https://github.com/371684029/apple-co-work/releases/tag/latest)

（临时构建目录 `release/` 仍 gitignore，勿与 `packages/` 混淆。）

## 需要什么

- 本机已安装 **Node.js ≥ 18**（https://nodejs.org ）
- 不解压进需要管理员权限的系统目录即可

## 怎么启动

| 系统 | 操作 |
|------|------|
| **Windows** | 双击 `start.bat` |
| **macOS / Linux** | 终端执行 `chmod +x start.sh && ./start.sh`，或 `node start.mjs` |

首次启动会自动 `npm install`（需联网），然后：

1. 启动本机服务（默认 `http://127.0.0.1:3780`）
2. 自动打开浏览器
3. **关闭浏览器窗口后，后台服务默认在数秒内退出**

开发调试若不想自动退出，可：

```bash
# Windows CMD
set ACW_AUTO_EXIT=0&& node start.mjs

# macOS / Linux
ACW_AUTO_EXIT=0 node start.mjs
```

## 演示流

打开后进入 **工作台** → 开聊选 **「演示流」**。  
若看不到：设置 → 偏好 → 打开「显示演示示例」。  
详见压缩包内 `docs/demo.md`。

## 数据在哪

运行后会在本目录生成 `data/`（SQLite、日志、群报告等），备份：

```bash
npm run backup
```

## 注意

- 压缩包**不含** `node_modules`（`better-sqlite3` 需在本机编译安装，跨平台 zip 无法通用）
- 请用 `127.0.0.1`，少用 `localhost`（避免 IPv6 问题）
- 杀毒软件若拦截本机脚本弹窗，可在设置里关闭「脚本弹窗」或加白名单
