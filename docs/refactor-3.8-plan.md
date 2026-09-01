# oh-my-co-work 3.8 · 重构与加固实施计划

| 属性 | 内容 |
|------|------|
| 目标版本 | `3.8.x` |
| 状态 | **已实施**（3.8.0 / 3.8.1 / 3.8.2 代码完成；浏览器交互冒烟受本机资源限制未跑，三平台打包冒烟交给发布流水线） |
| 更新日期 | 2026-09-01 |
| 设计文档 | 本文档；拆分后同步 `directory-structure.md` / `frontend-components.md` |
| 前置 | `3.7.x` 封板；3.x 全部用户可见行为保持不变 |

主题：**还债不加feature**。3.7 收口时留下的三个结构性风险（上帝文件、前端零测试、CI 无静态检查）在本版收口。

---

## 1. 背景与动机

3.7.4 时点的实测数字（wc -l，不含 node_modules / packages）：

| 风险 | 证据 |
|------|------|
| 引擎上帝文件 | `server/src/engine.js` **4090 行**：advance 主循环、闸门状态机（handleGateAction 单函数 700+ 行）、@插队、adapter 事件、归档全在一个文件；`advance()` / `handleGateAction` 无任何直测，只被 furnace 测试间接覆盖 |
| 工作台上帝文件 | `web/src/views/Workbench.vue` **5657 行**（模板 1104 + 脚本 2569 + scoped CSS 1983，约 40 个 ref / 60 个函数）；`FurnaceWorkspace.vue` 1210 行 |
| 前端逻辑三处复制 | 终端状态→文案映射与 isRunning 在 `TerminalWorkspace.vue` / `TerminalSessionCard.vue` / `FurnaceWorkspace.vue` 各写一份；满屏/全屏/Esc 折叠逻辑在 TerminalWorkspace 与 FurnaceWorkspace 重复；上传流程在 Workbench 与 FurnaceWorkspace 重复 |
| 前端零测试 | `web/` 无任何测试文件；`furnacePetAtlas.js`（16 向 look 角度数学、裁切）只靠注释说"有回归测试守着"，实际没有 |
| CI 无静态检查 | `.github/workflows/ci.yml` 只有 test + build + 打包冒烟；全仓无 ESLint、无类型检查 |
| 安全毛刺 | `localAccess.js` 的 REST 接受 `?token=` 查询串（可泄入浏览器历史 / 日志 / Referer） |

---

## 2. 实施原则

1. **行为不变是硬约束**：API 路由、错误码、WebSocket 协议、DB schema、`ptyPlain.js` 提取算法、三平台打包产物形态全部不动。
2. **先立表征测试，再动刀**：拆 engine 前先为 `advance()` / `handleGateAction` 写直测（现有 mkdtemp 数据根 + 依赖注入模式），测试绿了才允许移动代码。
3. **门面兜底**：`engine.js` 保留为薄门面 re-export，`routes.js` / `services.js` 的 import 路径不变；前端拆分同理，`Workbench.vue` 路径不变，只换内部。
4. **小步提交**：遵守 AGENT.md——一个 PR ≤ 400 行有效变更；每次移动都要 `npm test` + 演示流冒烟（`npm run dev:server` + `dev:web` 跑通演示流）。
5. **不加运行时依赖**：不引入 Pinia（沿用 furnaceUi.js 的模块级 ref 组合式模式）；ESLint 是 devDependency，只进根工作区。
6. **单一来源优先**：任何一份逻辑只允许存在一份——状态映射、满屏逻辑、上传流程，拆完即删副本。

---

## 3. 版本切分

| 版本 | 主题 | 交付边界 |
|------|------|----------|
| `3.8.0` | 引擎拆分 + 直测 | `engine.js` → `server/src/engine/` 模块化；gate/advance 有了直接单测；对外 import 不变 |
| `3.8.1` | 工作台拆分 + 状态收敛 | `Workbench.vue` → 三栏组件化；终端状态收敛进 composables；复制逻辑删除；`Workbench.vue` ≤ 800 行 |
| `3.8.2` | 工程加固收口 | ESLint 进 CI；REST 收紧 `?token=`；web 纯逻辑测试；3.8 最终封板 |

---

## 4. Phase 1：3.8.0 引擎拆分

### 4.1 任务

- [x] 表征测试先行（代码移动前）：
  - [x] `server/test/engineAdvance.test.js`：覆盖 线性推进 / waiting_human 停住 / gate 三票（auto/human/admin）幂等键 / 完成后归档 / interrupted 恢复
  - [x] `server/test/engineGates.test.js`：覆盖 同意 / 拒绝 / 参数闸门 / 重复提交幂等 / 归档后操作报 `ARCHIVED`
  - [x] 全部用现有测试基建：`mkdtempSync` 数据根、`node:test` 内置 runner、不引第三方库
- [x] `engine.js` 改为薄门面（re-export，现 46 行），逻辑迁入 `server/src/engine/`：

| 新模块 | 迁入内容（现 engine.js 中的职责） |
|--------|--------------------------------|
| `engine/store.js` | DB 原语：会话/节点/消息读写、persistNodeIo、resolveParamsMap、syncAutoSessionTitle（新增公共原语层，用于解除循环依赖） |
| `engine/advance.js` | advance() 主循环、openFlowGate、finishMainlineIfComplete |
| `engine/gates.js` | handleGateAction / handleGateActionCore、三票语义、幂等键 |
| `engine/offsite.js` | @成员 插队：offsite 节点插入/复用/回归主线归档 |
| `engine/adapterEvents.js` | applyAdapterEvent：question→闸门、tool 卡、结果写回 |
| `engine/sessionLifecycle.js` | 会话创建（群/单聊）/ 克隆续跑 / 从节点继续 / 中断恢复 / markInterruptedOnBoot |
| `engine/archive.js` | 归档/解档、归档尾节点簿记、群报告刷新/保存、processDueArchives |
| `engine/mentions.js` | mention 解析、串行执行队列、runMentionedMembers |
| `engine/userInput.js` | postUserMessage：聊天记录、闸门附言、@协助分派 |

- [x] 模块间依赖单向（store→offsite→archive→adapterEvents→advance→sessionLifecycle→gates→mentions→userInput 的 DAG），无环
- [x] `directory-structure.md` 同步 engine/ 目录说明

> 与计划的偏差：计划表列了 6 个模块，实际拆为 9 个——新增 `store.js`（公共原语层）并把归档/群报告独立成 `archive.js`、@协助执行独立成 `mentions.js` / `userInput.js`，以满足「依赖单向、禁止环」的硬约束；各职责区域与计划一致。

### 4.2 验收

- [x] `npm test` 全绿（133 用例：原 117 + 1 skip + 新增 14 个引擎直测 + localAccess 新增 1）
- [x] `git grep "from './engine.js'"` 调用方（index.js / services.js / 测试）零改动
- [x] 演示流冒烟：服务启动 `/api/health` ok、bootstrap→受保护接口令牌校验通过；交互冒烟见 §5.2 备注

---

## 5. Phase 2：3.8.1 工作台拆分

### 5.1 任务

- [x] `Workbench.vue`（5657 行）拆为 `web/src/views/workbench/`：

| 新文件 | 迁入内容 |
|--------|----------|
| `Workbench.vue`（原路径保留，现 799 行） | 布局壳 + 组装（chat header、终端工作区、BubbleList、欢迎屏） |
| `components/SessionRail.vue`（301 行） | 左栏：会话列表（Conversations）、分组/成员发起、筛选 |
| `components/FlowRail.vue`（1203 行） | 右栏：流程轨节点、角标、群报告 Tab、「从这里继续」 |
| `components/ComposerPanel.vue`（990 行） | 中栏输入区：XSender、`/` `@` `#` 快捷面板、参数引用 |
| `composables/useSessionDetail.js`（2343 行） | 会话详情加载、消息、闸门 pendingGate、流程轨/群报告状态 |
| `composables/useTerminalSessions.js`（379 行） | WS 重连、replay 累积（256k 上限）、seq 增量、gap 处理 |
| `composables/useFurnaceSync.js`（120 行） | 桌宠三态同步 watch + `?furnace=1` 开炉 + startWorkbench 启动 |

- [x] 复制逻辑单一来源化（拆完即删旧副本）：
  - [x] 终端状态→文案映射 + isRunning → `web/src/composables/terminalStatus.js`，四处（TerminalWorkspace / TerminalSessionCard / FurnaceWorkspace / TerminalView）改引；三场景措辞差异（运行中/交互中、已完成/已结束）用 variant 保留，行为不变
  - [x] 满屏/全屏/Esc 折叠 → `composables/pagefill.js`（usePagefill），TerminalWorkspace 与 FurnaceWorkspace 共用
  - [x] 本地文件选择/上传 → `composables/localUploads.js`（useLocalUploads），ComposerPanel 与 FurnaceWorkspace 共用
- [x] scoped CSS 随组件迁移；跨组件共享的 `.wb-chat-col` 归入 `styles.css`
- [x] `frontend-components.md` 同步拆分结构与「优先 Element-Plus-X」约定不变

> 与计划的偏差：
> 1. 新增 `composables/useFurnaceWorkspace.js`（343 行）——FurnaceWorkspace 的 GUI/TUI 对话逻辑抽出后才能落到 ≤900 行验收；
> 2. 删除 `Workbench.vue` 里未被引用的死 CSS `@keyframes welcome-rise`（8 行）——只为达成 ≤800 行，无渲染影响。

### 5.2 验收

- [x] `Workbench.vue` 799 行（≤800）；`FurnaceWorkspace.vue` 899 行（≤900）
- [x] 状态映射 / 满屏逻辑 / 上传流程 全仓各只有一份（grep 验证）
- [x] `npm run build -w web` 绿；ESLint 0 error；模板绑定静态核查通过（每个模板标识符都能在 setup 作用域解析）
- [ ] 演示流 + 熔炉开炉人工冒烟 —— **本机资源不足以起 Chromium（渲染进程 OOM×4），改用静态代理核查（模板绑定 + 构建 + 测试 + HTTP smoke）；待有桌面环境补跑一次人工冒烟**

---

## 6. Phase 3：3.8.2 工程加固收口

### 6.1 任务

- [x] ESLint（devDependency，仅根工作区）：
  - [x] flat config `eslint.config.js`；规则从宽起步：`no-undef` / `no-unused-vars`（`^_` 豁免）/ `no-async-promise-executor` 等 0 error，风格类不进 lint；`.vue` 用 eslint-plugin-vue essential（组件名规则豁免）
  - [x] `package.json` 加 `lint` script；CI（ci.yml）在 Test 前加 `npm run lint`
  - 顺手清理：5 处死导入/死变量、2 处同义正则转义（行为不变）
- [x] 令牌收紧（`localAccess.js`）：
  - [x] REST 一律不接受 `?token=`，只认 `Authorization: Bearer` 与 `X-ACW-Token`
  - [x] **WebSocket 例外保留**：`/ws` 查询串令牌保留（4.x 再考虑首包鉴权）；`web/src/api.js` 本就只用 header，无需改动
  - [x] `server/test/localAccess.test.js` 补用例：query token 在 REST 上拒绝、header 正常（3/3 绿；本机 curl 实测 401/200）
- [x] web 纯逻辑测试（不引入 Vitest，沿用 node:test）：
  - [x] `web/test/petAtlas.test.mjs`：图集几何、clip 映射、16 向 look 角度、裁切数学（7 例）
  - [x] `web/test/terminalStatus.test.mjs`：三 variant 文案契约 + isRunning + 连接态（6 例）
  - [x] 根 `package.json` 加 `test:web`（`node --test web/test/*.test.mjs`）；CI 一起跑
- [ ] 文件体积预算（可选护栏）：`scripts/check-file-size.mjs` —— 后置 3.8.x 补丁，不阻塞封板

### 6.2 验收

- [x] 本机全绿：lint 0 error + `npm test`（133）+ `npm run test:web`（13）+ `npm run build -w web`
- [x] 本机实测：REST 带 `?token=` 返回 401；页面 bootstrap 与 header 访问正常；`/api/health` 免令牌
- [ ] 三平台打包 + 冒烟通过（pack-release 流水线零改动）—— 交给 push main 的 pack-release 流水线执行

---

## 7. 不动项（明确不做）

- 不改 DB schema、不改 API 路由与错误码、不改 WS 协议。
- 不动 `shared/ptyPlain.js` 提取算法与 `sanitizeFurnaceGuiText` 词表（熔炉 GUI 行为冻结）。
- 不引入 TypeScript、不引入 Pinia / Vitest、不改打包产物形态。
- 不做视觉/交互改版；scoped CSS 只搬家不重写。
- `?token=` 的 WS 首包鉴权、engine 模块再细分（如 gates 内部再拆）、多终端标签治理 → 后置 4.x。

---

## 8. 风险与对策

| 风险 | 对策 |
|------|------|
| engine 拆分引入推进顺序/幂等回归 | 表征测试先写先绿；门面 re-export 保证调用方零改动；每步移动跑全量测试 |
| Workbench 拆分破坏 WS 重连 / replay 时序 | useTerminalSessions 保持现有函数签名，只搬家不改逻辑；断线重连列入人工冒烟清单 |
| CSS 搬家后样式漂移 | 只移动不重写；拆分前后各截一张三栏/熔炉满屏截图人工比对 |
| lint 首轮报错淹没 | 规则从宽、0 error 起步；风格规则明确不进本轮 |
| 与并行功能开发冲突 | 3.8 期间冻结 engine.js / Workbench.vue 的新功能改动；新功能一律在 3.8 合入后开 |

---

## 9. 3.8 完成定义（封板口径）

同时满足才可称 3.8 落地：

- [x] `engine.js` 46 行门面，逻辑全部位于 `server/src/engine/`，gate / advance 有直接单测（engineAdvance 6 + engineGates 8）。
- [x] `Workbench.vue` 799 行，三栏各自成组件；状态映射 / 满屏 / 上传全仓单一来源。
- [x] CI 含 lint；REST 不再接受 `?token=`（WS 除外）；web 纯逻辑有 node:test 覆盖（13 例）。
- [ ] 演示流与熔炉全流程人工冒烟通过 —— 待桌面环境补跑；静态代理核查已过（构建 / lint / 146 测试用例 / 模板绑定核查 / HTTP smoke）
- [ ] 三平台打包冒烟通过 —— push main 由 pack-release 流水线执行
- [x] README、directory-structure.md、frontend-components.md、本计划已同步。
