# oh-my-co-work 4.x · 协同文档中心实施计划

| 属性 | 内容 |
|------|------|
| 目标版本 | `4.x`（首版 `4.0.0`） |
| 状态 | 规划中（未开工） |
| 更新日期 | 2026-09-01 |
| 设计文档 | 本文 §3 设计要点；实现期可再拆 `docs-4x.md` |
| 前置 | `3.8` 封板（引擎/工作台拆分与加固已落地，打包流水线修复后随 `3.8.0` 发布） |

主题：**把散落的协同文档聚起来**。会话跑完留下群报告 `ANNOUNCEMENT.md`、会话索引 `README.md`、节点台账 `step-*.md`——它们都在 `data/journals/sessions/{id}/` 下，但用户要靠文件管理器翻目录才能看。4.0 给它们一个家：一个新开标签即可进入的文档中心页面。

---

## 1. 背景与目标

- 现状痛点：文档**七零八落**——每条会话一个目录，用户不知道哪条会话有产出、产出在哪、哪份是最新。
- 目标：一个**独立的文档中心页面，新开浏览器标签打开**：左侧菜单（默认按群模板聚合，可切按时间排序），右侧渲染 Markdown；**群公告可编辑**；从会话/流程轨/顶栏一键打开。
- 与现状的区别：3.x 的「打开 MD」是 `window.open` 指向**裸文件**（无菜单无上下文）；4.0 新开的标签是**完整文档中心页面**并直接定位到该文件。
- 边界：只聚合 `data/journals/` 的会话文档与熔炉相关 MD；`docs/`（仓库文档）不进这个视图。

## 2. 实施原则

1. **不另起第二个 web 服务**：并入现有 Express + Vue 应用——新增 `/docs` **独立页面路由**（用户新开标签进入）+ `/api/docs` 路由。第二个端口 = 第二套本机令牌/Origin 安全面 + 第二份打包负担；复用现成的 `requireLocalAccess`、UI 壳与三平台打包流水线。新标签与工作台同属一个 SPA，令牌 bootstrap 与安全模型自动生效。
2. **只渲染，不执行**：Markdown 渲染器关闭内嵌 HTML（`html: false`），链接一律 `rel="noopener"`。公告与台账里混有 agent 产出，绝不允许直插 HTML（XSS 面）。
3. **编辑分层**：只有 `ANNOUNCEMENT.md` 可编辑——复用既有 `saveSessionAnnouncement` 的 `announcementManual` 语义（人工编辑后，自动刷新不覆盖，须 force）。`step-*.md` / `README.md` 是台账/审计，默认只读；要改走「复制为公告 / 另存」。**不允许改台账破坏溯源。**
4. **单一事实源不动**：SQLite 仍是调度真相，MD 仍可直接用文本工具/git 读。文档中心只是**视图层**——不复制文件、不建第二份索引库。
5. **安全沿用 2.0.1 模型**：全部走本机令牌 + 回环 Origin；文件路径白名单 + basename 校验防穿越（复用 uploads.js 的清洗模式）。
6. 小步提交、行为不变优先；渲染器等新依赖先在计划里定型号，不临时起意。

## 3. 设计要点

### 3.1 数据源与列表

```
data/journals/sessions/{sessionId}/
├── ANNOUNCEMENT.md   # 群报告（可编辑）
├── README.md         # 会话文档索引（只读）
└── step-NN-<id>.md   # 节点台账（只读）
```

- 列表 = 扫 `journals/sessions/*`（取 mtime/size）+ DB join（`sessions ↔ groups`）得群模板名、会话标题、状态。
- 扫描带 60s 缓存 + mtime 增量，会话多时列表也不抖。
- 文件名白名单：`ANNOUNCEMENT.md` / `README.md` / `step-\d+-[A-Za-z0-9_-]+\.md`，其余拒绝。

### 3.2 菜单与排序

- **默认：按群模板**——一级 = 群模板（含单聊模板归入「单聊」组），二级 = 该群下会话（按更新时间倒序），三级 = 该会话的文档树（公告 → 索引 → 节点按 step 序）。
- **可切：按时间**——全库文档按 mtime 倒序的扁平列表，显示「群模板 · 会话 · 文件名」。
- 排序偏好记忆在 `appSettings`（`docsHub.sort`），不写 localStorage。

### 3.3 渲染与编辑

- 渲染器：`markdown-it`（web 运行时依赖，约 100KB；`html:false` + `linkify`）。代码高亮 4.0 不上，4.1 再评估（highlight.js 按需加载）。
- 编辑：右栏「编辑」按钮仅对公告出现；`el-input textarea` 编辑（不做富文本），保存走既有 `saveSessionAnnouncement`（写入 `announcementManual: true`）。未保存离开弹确认。
- 大文件护栏：单文件读取上限 1MB，超出截断并提示「用系统打开看全文」。

### 3.4 打开方式与联动

- **新开标签是默认打开方式**：顶栏「文档」、右栏「打开 MD」、会话内文档引用，都以 `window.open('/docs?session=…&file=…')` 新开一个完整文档中心页面并定位到对应文件。工作台标签页保持原样，不被导航走。
- 3.x 的「打开 MD」是 `window.open` 指向**裸文件 URL**（无菜单）；4.0 换成指向文档中心页面，同一个新标签习惯，但内容从裸 MD 变成带菜单的页面。
- 「系统打开」（起 OS 查看器/编辑器）保留为文档中心右侧的次按钮。
- WebSocket 事件复用既有 `announcement.updated`：文档中心标签开着时内容自动刷新（4.0 最简实现：收到事件重拉当前文件）。

## 4. 版本切分

| 版本 | 主题 | 交付边界 |
|------|------|----------|
| `4.0.0` | 协同文档中心 MVP | `/api/docs` 列表/读/存公告；`/docs` 视图：左菜单双排序 + 右渲染；公告可编辑；工作台跳转；安全护栏 |
| `4.1.0` | 检索与导出 | 全文搜索（内存扫描，不引 FTS）；节点文档徽标（状态/适配角标）；「打包本群全部 MD」导出；代码高亮评估 |
| 后置 | 4.x 其它线 | 托盘独立窗、多终端标签治理、更多 CLI Adapter、文档版本历史/diff（git 化台账另案） |

`4.0` 不做：富文本编辑、协作多人光标、云端同步、`docs/` 仓库文档聚合。

## 5. Phase 1：4.0.0 文档中心 MVP

### 5.1 服务端

- [ ] `server/src/docsHub.js`：扫描与缓存（见 §3.1）；路径白名单与穿越拦截
- [ ] `GET /api/docs/list?sort=group|time`：分组/扁平两种形态
- [ ] `GET /api/docs/file?sessionId=&name=`：读单文件（1MB 截断标记）
- [ ] `POST /api/docs/announcement`：保存公告（透传既有 `saveSessionAnnouncement`，含 manual 语义）
- [ ] `routes.js` 挂接 + `web/src/api.js` 对应方法；`directory-structure.md` / `data-storage.md` 同步

### 5.2 前端

- [ ] `router.js` 加 `/docs` 独立页面路由；`App.vue` 顶栏「文档」入口**新标签打开**
- [ ] `views/DocsHub.vue`：左菜单（双排序切换、群模板分组树）+ 右内容（渲染/编辑切换），独立页面自带返回工作台入口（同标签回工作台/关标签均可）
- [ ] `views/workbench/composables/useDocsHub.js`：列表状态、当前文档、保存与离开守卫
- [ ] `FlowRail`「打开 MD」改为 `window.open('/docs?…')` 新开标签打开文档中心（保留系统打开次按钮）
- [ ] markdown-it 接入（`html:false`）+ 基础排版样式沿用 `--ecw-*` 令牌

### 5.3 测试与安全

- [ ] `server/test/docsHub.test.js`：扫描结构、双排序、白名单与穿越拦截、公告保存 manual 语义、1MB 截断
- [ ] 渲染 XSS 用例：含 `<script>` / `onerror` 的 MD 不产生可执行节点
- [ ] 三平台打包冒烟通过（沿用既有流水线）

### 5.4 验收

- [ ] 打开文档中心：默认群模板分组可见；切时间排序列表变化；点开公告可读、可编辑、保存后流程轨群报告同步更新
- [ ] 台账文件无编辑入口；越权文件名请求被拒
- [ ] 群聊完成归档后，文档中心立即可见该会话文档（新会话自动入列）

## 6. Phase 2：4.1.0 检索与导出（粗纲）

- [ ] 全文搜索：输入关键词 → 内存扫描 `journals` 命中文件 + 行摘要
- [ ] 节点文档徽标：状态 / 适配 / 克隆角标沿用流程轨语义
- [ ] 「打包本群全部 MD」：服务端打 zip 下载（复用 adaptBackup 的打包基建）
- [ ] 代码高亮评估（按需引入，不默认全量）

## 7. 不动项

- 不改 SQLite schema、不改 journal 写入格式（`step-*.md` frontmatter 不动）。
- 不改 `requireLocalAccess` 安全模型；文档中心不引入新端口。
- 不做多人协作、不做云同步、不动 `docs/` 仓库文档。
- 自动刷新不覆盖人工编辑的既有语义（`announcementManual`）不回退。

## 8. 风险与对策

| 风险 | 对策 |
|------|------|
| agent 产出混入恶意 HTML/脚本 | 渲染器 `html:false` + XSS 测试用例锁死 |
| 用户误改台账破坏溯源 | 台账只读；编辑入口只给公告 |
| 会话量大列表卡顿 | 60s 缓存 + mtime 增量；菜单分组懒展开 |
| 新依赖膨胀运行包 | markdown-it ~100KB，verify-pack 体积基线对比 |
| 与 3.8 拆分后的模块边界冲突 | docsHub 独立成模块，不进 engine/；走 services/routes 层 |

## 9. 4.0 完成定义（封板口径）

同时满足才可称 4.0 落地：

- `/docs` 页面（新标签打开）可用：默认群模板排序 + 可切时间排序；公告可读可编辑可保存；顶栏与「打开 MD」均新开标签进入。
- 台账只读 + 路径白名单 + 渲染不执行 HTML，安全用例全绿。
- 工作台「打开 MD」默认内嵌跳转；`announcement.updated` 联动刷新。
- 三平台打包冒烟通过；README / data-storage / frontend-components / directory-structure 已同步。
