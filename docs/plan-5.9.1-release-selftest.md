# 5.9.1 发布前自测记录（2026-11-13）

> 对应 `/goal`：拉 main → 自测近期优化 → 无阻断问题则打包并更新 README/截图。

## 结论

**可发布**：`npm run lint`、`npm test`（391）、`npm run test:web`、`npm run test:electron`、`npm run release:gate`（需先 `npm run pack` 填满 `packages/`）、`node scripts/selftest-refine-adapt.mjs` 均通过。

## 发现与处理

| 项 | 严重性 | 说明 | 处理 |
| --- | --- | --- | --- |
| `npm run seed` 在 workspace 下路径错误 | P1 | `process.cwd()` 为 `server/` 时去找 `server/server/test/fixtures/...` | 已改 `seed.js`：用 `import.meta.url` + `DATA_ROOT` |
| `capture-docs-screenshots.mjs` 过时选择器 | P2 | 无会话时找不到 `.conv-row`；「文档中心」按钮重名 | 脚本：一键开聊演示流 + 「打开右侧文档中心」 |
| 云环境未 `npm install` | 环境 | 初跑 73 fail 均为 `@acw/shared` 缺失 | 文档已写明先 install；非产品缺陷 |
| `release-gate` 缺 darwin zip | 环境 | 本机未打全平台包 | 打 `npm run pack` 后 gate 通过 |
| 桌面包体积 | 预期 | win/linux desktop ~160MB，只放 `release/` | 符合 PKG 护栏 |

## 打包产物（本机）

| 产物 | 路径 |
| --- | --- |
| Linux 轻量 | `packages/oh-my-co-work-v5-linux-x64.zip` |
| Linux 桌面 | `release/oh-my-co-work-v5-linux-x64-desktop.zip` |
| Win 桌面（交叉） | `release/oh-my-co-work-v5-win32-x64-desktop.zip` |

## 截图

`node scripts/capture-docs-screenshots.mjs`（需 `dev:server` + `dev:web`，Playwright chromium；webp 可用 `npx sharp-cli`）。

更新：`docs-hub.webp`（顶栏搜索）、`docs-hub-rail.webp`（顶栏打开右侧文档中心）。
