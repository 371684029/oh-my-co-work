# oh-my-co-work 自测体系（Self-Testing Guide）

> 更新：2026-09-02 · 适用 v3.7.4 + 3.8 重构 + 4.0.0 文档中心之后的代码形态
> 本文回答三个问题：**测什么、怎么跑、哪些套路**。写给贡献者与 AI Agent。

---

## 1. 一页总览

| 层 | 位置 | 工具 | 规模 | 跑法 |
|----|------|------|------|------|
| 服务端单元/集成 | `server/test/*.test.js`（25 文件） | Node 内置 `node:test` + `node:assert/strict` | **139 例** | `npm test` |
| 前端纯逻辑 | `web/test/*.test.mjs`（3 文件） | 同上（浏览器不用开） | **23 例** | `npm run test:web` |
| 自愈/冒烟脚本 | `scripts/selftest-*.mjs` + `test-enter-send.mjs` | 独立脚本，**不走 test runner** | 4 + 1 个 | `node scripts/selftest-xxx.mjs` |
| 静态核查 | ESLint + 模板绑定核查 | eslint 9 / 临时脚本 | 0 error 基线 | `npm run lint` |
| 发布自测 | CI + 打包流水线 | GitHub Actions | 每次推 main | 自动 |

设计原则（AGENT.md §5.5）：**只用 Node 内置 runner，不引第三方测试库**；测试与实现同一提交；前端只测"抽成纯逻辑的部分"，不测组件挂载。

---

## 2. 怎么跑

```bash
npm test                 # 服务端全量（workspace 委托到 server，node --test test/*.test.js）
npm run test:web         # 前端纯逻辑
node --test test/docsHub.test.js   # 单文件调试
npm run lint             # ESLint 0-error 基线
npm run build -w web     # vite 构建（模板/导入错误的兜底网）
```

> 注：服务端 139 例中，`adaptBackup.test.js` 的 444 权限用例在 **root 用户下按设计 skip**（root 对 444 文件仍可写，断言无意义）——本地 root 跑是 138 pass + 1 skipped；CI（非 root）139 全绿。

CI（`.github/workflows/ci.yml`）每次 push/PR 按序执行：**Install → Lint → Test → Test web → Build web → Pack dry-run + 真机冒烟**（解压 linux 包 → `node start.mjs` → curl `/api/health`）。推 main 还会触发 `pack-release.yml`：三平台打包 → verify-pack → validate（三包必须同 sourceCommit）→ 发布 `latest`。

---

## 3. 服务端测试的四个套路

### 3.1 隔离数据根：每个测试文件一个临时 SQLite

测试文件顶部先设环境再 import（顺序不能反，db.js 在 import 时读 `ACW_DATA_ROOT`）：

```js
const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'acw-docs-hub-'))
process.env.ACW_DATA_ROOT = dataRoot

const { initDb } = await import('../src/db.js')
initDb()
const { createMember, createGroup, createSessionFromGroup } = await import('../src/services.js')
```

`node --test` 每个文件是独立进程 → 每文件一个干净库，互不污染。测试里用 `services.js` 造真实数据（成员/群/会话），不 mock DB。

### 3.2 表征测试先行：重构前锁行为（3.8.0 的做法）

拆 `engine.js`（4090 行）之前，先写 `engineAdvance.test.js` / `engineGates.test.js` **针对旧代码**把行为钉死：human 闸门停住、场外暂停+前跳恢复、参数追加语义（`#1` 不覆盖、递增成 `#2`）、幂等键回放、`ARCHIVED`/`NOT_WAITING`/`INTERRUPTED` 错误码……14 例全绿后才允许移动一行代码；拆分后这两个文件**原样**通过，即为"行为未变"的证据。

要点：表征测试**断言的是现状，不是理想**。写的时候发现断言失败，先区分"发现真 bug"还是"我对行为理解错了"——3.8 时两次失败都是后者（参数是追加不是覆盖、审核闸门的聊天附言 `mainGateWaiting=false`），改断言不改代码。

### 3.3 依赖注入：不 spawn 也能测"会碰真实世界"的代码

凡是会 spawn 进程/开浏览器的模块，留一个可注入的缝：

```js
// docsHub.openDocsPath(targetPath, deps) —— deps.openTarget 默认 openLocalPath
await docsHub.openDocsPath(file, { openTarget: async (p) => opened.push(p) })
assert.equal(opened[1], dir)        // 文件 → 断言打开的是"所在目录"而不是文件本身
```

同款：`terminalService` 的 `platform`/`run`/`resolveExecutable` 注入（Windows 逻辑在 Linux 上测）、`runners` 的执行体注入。测试跑得快、无副作用、CI 稳定。

### 3.4 轮询等待异步落地：别和批处理抢跑

凡是"动作 → 异步落盘/异步推进"的断言，**禁止**动作后立刻同步读结果。两个真实教训：

- 引擎推进走 `setImmediate(advance)` → 用轮询（25ms × 60 次）等 `status === 'archived'`；
- 终端日志按 `OUTPUT_BATCH_MS` 批量刷盘 → 曾有测试进程退出后立刻 `readFileSync` 读到空串，**偶发失败**。修复：轮询等 `UNIQUE_REDACT_MARKER` 出现再断言，连跑 5 次全绿。

```js
async function poll(fn, times = 60) {
  for (let i = 0; i < times; i++) { const r = await fn(); if (r) return r; await wait(25) }
  return null
}
```

---

## 4. 前端测试：只测"抽成纯逻辑的部分"

组件不挂载测试（无 Vitest/浏览器），策略是**把逻辑抽成无副作用模块**，让 `node --test` 直接 import：

| 模块 | 测什么 | 为什么值得测 |
|------|--------|--------------|
| `views/docs/markdownRenderer.js` | XSS 转义、三类链接行为、路径识别启发式 | 文档中心的安全与核心体验（10 例） |
| `composables/terminalStatus.js` | 三 variant 文案契约、isRunning | 文案差异是历史行为，防"顺手统一"漂移 |
| `composables/furnacePetAtlas.js` | 图集几何/clip 映射/16 向角度/裁切数学 | 纯数学，回归即视觉事故 |

两个实测套路：

**XSS 锁死**：`html:false` 下断言渲染产物不含可执行节点——

```js
const out = render('<script>alert(1)</script>')
assert.equal(out.includes('<script>'), false)
assert.equal(/<a [^>]*javascript:/i.test(render('[点我](javascript:alert(1))')), false)
```

**路径识别基于原始文本**（4.0 踩过的坑）：markdown-it 的转义规则会把 `C:\work\a` 的反斜杠切成独立的 **`text_special`** token，逐 token 匹配永远找不到完整路径——渲染器必须把**连续的 text/text_special token 串接后**整体识别；且贪婪匹配会把路径后的中文句子吞进去，需要"空白后跟 CJK 即截断"启发式。对应用例：`C:\work\a b\`（空格+反斜杠）、`/var/log`（句中 POSIX 不误判）、`C:\tools\x，`（尾随标点不入路径）。

---

## 5. 自愈/冒烟脚本（selftest-\*.mjs）

`scripts/selftest-forward-jump.mjs`、`selftest-session-ops.mjs`、`selftest-v1-priority.mjs`、`selftest-v1-stability.mjs`——**不走 test runner**，是独立长流程脚本（起真实服务/跑完整流），用于手工自愈验证与发版前巡检。另有 `test-enter-send.mjs`（输入框回车发送的单点验证）。与单测的分工：单测管"单元语义不变"，selftest 管"整条流程能走通"。**注意**：这类脚本默认针对真实运行中的服务与真实数据（如 `selftest-session-ops` 断言库里已有群模板），不要在含重要数据的实例上随手跑。

---

## 6. 静态核查：两个便宜的门禁

**ESLint**（`eslint.config.js`，flat config）：`no-undef` / `no-unused-vars`（`^_` 豁免）/ `no-empty`(allowEmptyCatch) 等正确性规则 0 error；风格类不进 lint。`.vue` 用 eslint-plugin-vue essential。它的实战价值：3.8 拆分时抓到一个**被 try/catch 吞掉的 `ReferenceError`**（gates.js 漏 import，单测全绿但熔炉开炉同步静默失效）。

**模板绑定核查**：Vue SFC 的"模板引用了 setup 没暴露的标识符"**构建和 lint 都不报**，运行时才白屏。拆大组件后跑一遍（临时脚本，思路如下）：

1. 正则提取 `<script setup>` 的声明（import / const / let / 解构 / 函数参数）；
2. 正则提取模板表达式（`{{ }}`、`v-*`、`@*`、`:*`）里的根标识符（剔除字符串字面量、对象 key、`v-for`/`v-slot` 别名、`$event` 等）；
3. 差集即嫌疑名单——**逐个人工确认**（多数是 v-for 别名/defineProps 声明的 props，props 会自动进模板作用域）。

---

## 7. 发布自测（打包流水线）

| 闸门 | 校验什么 | 失败案例 |
|------|----------|----------|
| CI pack dry-run | 代码改了还能不能打出可用包：打包 → verify-pack → 解压真机起服 → `/api/health` | — |
| verify-pack | zip 内 BUILD_INFO 平台/版本、图集字节一致、原生模块魔数（按 node-pty 实际加载序） | 3.7.1 图集裁切回归 |
| validate-release-packages | 三平台 zip 侧车 `.build.json` 一致、**同 sourceCommit** | win32 包连续 5 天未真正入库（流水线 rebase 把新 zip 盖回旧包，2026-09-01 修复：先提交本平台 zip 再 rebase + 提交前自检 sourceCommit） |
| 发布 | GitHub Release `latest` 删旧建新 | — |

**本地复现流水线失败**的套路：流水线会把 zip 提交回 main，`git pull` 后直接跑 `npm run validate:packages` 即可在本地看到与 CI 相同的报错（win32 那次就是这么 3 分钟定位的）。

---

## 8. 本地实弹验证（curl 层）

涉及安全/网络行为的改动，测试之外再起真实服务打一轮：

```bash
ACW_PORT=3979 node server/src/index.js &
TOKEN=$(curl -s -H "Origin: http://127.0.0.1:5173" http://127.0.0.1:3979/api/bootstrap \
  | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).token")
curl -o /dev/null -w "%{http_code}" "http://127.0.0.1:3979/api/members?token=$TOKEN"              # 期望 401（3.8.2 收紧）
curl -o /dev/null -w "%{http_code}" -H "X-ACW-Token: $TOKEN" http://127.0.0.1:3979/api/members    # 期望 200
curl -o /dev/null -w "%{http_code}" http://127.0.0.1:3979/docs                                    # 期望 200（SPA 回退）
```

---

## 9. 新增测试的约定（checklist）

- [ ] 放 `server/test/*.test.js`（或 web 纯逻辑 `web/test/*.test.mjs`），`node:test` + `assert/strict`，**不引第三方测试库**
- [ ] 文件顶部 `mkdtempSync` + `ACW_DATA_ROOT`，再 import 模块
- [ ] 会 spawn 的依赖一律注入；异步落盘/推进一律轮询
- [ ] 表征测试断言现状；先区分 bug 与理解偏差，再动断言
- [ ] 测试与实现同一提交；行为变化同步 AGENT.md §5.5 与本文档
- [ ] 推 main 前本地四连：`npm run lint` / `npm test` / `npm run test:web` / `npm run build -w web`

## 10. 经验沉淀（本项目实测）

1. **测试偶发失败 ≠ 稳定**：`readFileSync` 撞上批量刷盘的竞态，单次全绿不代表绿。修复方向是轮询等待，不是 `setTimeout` 赌运气。
2. **表征测试的价值在"拆"之前**，不在之后——它同时是重构护栏和规格说明书（参数追加、闸门三票语义都写在了用例里）。
3. **markdown-it 的转义会重排 token**：任何"基于原始文本"的后处理都要考虑 `text_special`，逐 token 匹配必翻车。
4. **单测全绿 + 静态核查 ≠ 安全**：3.8 的漏 import 被吞在 try/catch 里，是 ESLint 的 `no-undef` 抓到的——静态门禁与测试是互补，不是替代。
5. **委托给子代理的代码，报告只是线索**：3.8.1 的接线、4.0.0 的页面，全部按"build + lint + 双测试 + 模板绑定 + grep 单一来源"逐项复核后才算完成。
