# 下载压缩包 · 一键使用

适合「解压 → 双击启动 → 关浏览器即停」的用户。

## 从哪下载

- **固定入口（推荐）**：[Releases · latest](https://github.com/371684029/apple-co-work/releases/tag/latest)  
  每次推 `main` 会自动打 zip 并更新此页。
- 也可在仓库 **Releases** 页选带 `pack-` 前缀的历史包。

（zip **不会**进 git 仓库目录；不要在源码树里找 `release/`。）

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
