# 下载运行包 · 一键使用

适合「解压 → 双击启动 → 用完关闭启动窗口即可结束」的用户。

## 从哪下载

运行包只发布在 [Releases · latest](https://github.com/371684029/oh-my-co-work/releases/tag/latest)（5.7.0 起不再提交进仓库 `packages/`）：

| 包 | 说明 |
|------|------|
| `oh-my-co-work-v5-<平台>-desktop.zip` | **桌面窗口（推荐）**：内含 Electron + Node，不用装 Node.js |
| `oh-my-co-work-v5-<平台>.zip` | 轻量运行包：需本机 Node.js ≥ 18，打开浏览器 |

`<平台>`：Windows → `win32-x64`，Linux → `linux-x64`，macOS（Apple Silicon）→ `darwin-arm64`。

**一致性门禁**：latest 发布前会检查三平台轻量包内 `BUILD_INFO.json`，版本和源码提交必须与本次构建一致，且必须含当前熔炉图集；任一不符则不发布。

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
3. **关掉浏览器不会停服务**；**关闭启动窗口（bat/终端）或 Ctrl+C** 即可结束服务  

如需「关浏览器后尝试退出服务」（实验性，可能误杀），可：

```bash
# Windows CMD
set ACW_AUTO_EXIT=1&& node start.mjs

# macOS / Linux
ACW_AUTO_EXIT=1 node start.mjs
```

### 无头模式（仅源码仓库 / 开发者）

运行包 zip **不含** Playwright。若在本机克隆源码调试、又不想弹出系统浏览器：

```bash
npm install
npx playwright install chromium
ACW_HEADLESS_BROWSER=1 node start.mjs
```

无界面加载 `http://127.0.0.1:3780/`；**Ctrl+C 或关闭启动终端** 会同时关闭无头浏览器并停止服务。详见 [data-storage.md §7](./data-storage.md#7-环境变量)。

## 演示流

打开后进入 **工作台** → 开聊选 **「演示流」**。  
若看不到：设置 → 偏好 → 打开「显示演示示例」。

## 数据在哪

运行后会在解压目录生成 `data/`（SQLite、日志、群报告等）。

设置（`app-settings.json`）与斜杠命令（`slash-commands.json`）也在 `data/` 下（5.7.0 起；旧版写在 `server/config/`，首次启动自动复制过来），覆盖升级程序文件不会丢设置。桌面包的数据目录在用户配置目录（Windows `%APPDATA%\oh-my-co-work`，Linux `~/.config/oh-my-co-work`，macOS `~/Library/Application Support/oh-my-co-work`）。

每个 zip 根目录有 `BUILD_INFO.json`，可确认该包实际使用的源码提交和构建时间；Release 说明里也写了本次提交。

## CI 打包卡住怎么排查（三平台构建来自哪）

若 Release 说明里的提交明显落后于 main，说明最近的 `pack-release` 没有成功——**这是仓库自身的发布流水线问题，不是熔炉精灵代码的问题**。

排查顺序：

1. 看 [Actions 页面](https://github.com/371684029/oh-my-co-work/actions/workflows/pack-release.yml) 最近一次 `main` 推送的运行结果；若三个 job 都直接失败且提示 `recent account payments have failed or your spending limit needs to be increased`，说明 **GitHub Actions 分钟数/额度用尽或欠费**，所有平台（包括 `ubuntu-latest`）都跑不起来，与代码无关。
2. 私有仓库的 GitHub Actions 分钟数按月限额，且 `windows-latest` 记 **2×**、`macos-latest` 记 **10×** 消耗倍率；旧版 `pack-release.yml` 在**每个 `cursor/**` 分支的每次 push**上都跑一次三平台矩阵，很容易在几天内把免费额度提前烧光，进而卡住 Windows/macOS 包的更新（Linux 因为体量小，历史上多次是靠人工在开发机上重新打包顶上，而不是 CI 自动完成的）。
3. 现版本 `pack-release.yml` 已收紧：只在 **push 到 `main`** 时才打三平台包（`cursor/**` 分支上的每次提交不再触发），并且三平台**全部改用 `ubuntu-latest` + `ACW_PACK_TARGET` 交叉打包**（`better-sqlite3` / `node-pty` 靠 `prebuild-install` 按目标平台下载预编译产物，不需要真机 `windows-latest` / `macos-latest`）。日常测试信号改由单独的 `ci.yml`（仅 `ubuntu-latest`，跑 `npm test` + 前端构建）负责，成本极低。

## 打包即验：怎么保证每次都能打出可用包

三层拦截，坏包不会悄悄混过去：

1. **打包时清架构**：`scripts/pack-release.mjs` 交叉打包（`ACW_PACK_TARGET` 与宿主平台不同）时，会自动核对 `node_modules/**/build/{Release,Debug}` 下每个 `.node` 文件的魔数是否匹配目标平台，删掉宿主平台混进来的错误二进制（例如在 Linux 上交叉打 Windows 包时，`node-pty` 的 `node-gyp rebuild` 只认宿主平台，会在 `build/Release` 留下一份 Linux 版 `pty.node`——不删的话运行时靠 fallback 侥幸能用，但不是「保证对」）。
2. **打完立刻验**：每个平台打完包后立刻跑 `scripts/verify-pack.mjs`，检查 `BUILD_INFO.json`、图集字节是否与源码一致、是否还含旧素材、包内 `.node` 文件架构是否匹配目标平台；桌面包另查 `electron/main.js` 是否自包含（只 import `electron` 与 Node 内置模块）、macOS `Electron.app` 符号链接是否保留——验证失败就不会进 Release。
3. **真起服务**：轻量包 `linux-x64` 解压后 `node start.mjs` + curl `/api/health`；桌面包 `linux-x64` 由 `scripts/desktop-smoke.mjs` 在 xvfb 下真机拉起 Electron，等到工作台加载且 `sqliteDriver=better-sqlite3`。`ci.yml` 对每个 PR / 分支都跑这两项，**合并到 main 之前就能发现「打不出能启动的包」**。

`scripts/verify-pack.mjs` 也可以单独手动跑：

```bash
node scripts/verify-pack.mjs --zip packages/oh-my-co-work-v5-win32-x64.zip --platform win32-x64 --version 5.7.0
```

## 长期解决方案（不只是充值）

除了给 GitHub Actions 账户加钱／提高消费上限，还有几种不花钱、能根治「额度用尽卡住三平台包」的办法，按见效速度排序：

| 方案 | 效果 | 代价 |
|------|------|------|
| **收紧触发范围 + 单 runner 交叉打包**（已落地，见上一节） | 把每次三平台构建的耗时从「1×+2×+10× ≈ 13×」降到「3×1× = 3×」，且只在合并到 `main` 时跑一次，而不是每个分支每次提交都跑 | 无；已随本次修复生效 |
| **仓库转为 Public** | 公开仓库的 GitHub-hosted Actions 分钟数**完全免费、不限量**，彻底不受额度/账单影响 | 需要接受源码公开（README 已按开源项目风格维护，若本来就打算开源，这是最彻底的方案） |
| **自托管 Runner（self-hosted runner）** | 用自己的电脑/服务器注册 Actions runner，跑多少分钟都不计入 GitHub 账单，且可以装 VS Build Tools 后走原生 `windows-latest` 一样的路径 | 需要一台常开的机器，并在仓库 Settings → Actions → Runners 里添加 |
| **手动交叉打包兜底** | 出问题时，任何人（或本项目里的云端 Agent）可以在一台 Linux 机器上执行 `ACW_PACK_TARGET=win32-x64 npm run pack` / `ACW_PACK_TARGET=darwin-arm64 npm run pack`，本地生成对应平台的 zip 后手动上传到 Release，不依赖 Actions 是否可用 | 需要人工触发，不是自动化 |

## 注意

- 包内是 **前端 dist + 后端 bundle + 内置 node_modules**，不是完整源码树
- 请用与系统匹配的 zip（`better-sqlite3` / `node-pty` 为平台原生模块；Node 22+ 可回退内置 sqlite）
- 请用 `127.0.0.1`，少用 `localhost`（避免 IPv6 问题；本机令牌也按回环 Origin 校验）
- 工作台会自动领取本机访问令牌；`/api/health` 可裸调，其它接口与 WebSocket 需要令牌
- **成员脚本 / 快捷指令 shell**：相对路径以「脚本基准目录」为准；详见仓库 [script-guide.md](https://github.com/371684029/oh-my-co-work/blob/main/docs/script-guide.md) §4（运行包内无此 md 时可看 GitHub）
