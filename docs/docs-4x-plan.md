# oh-my-co-work 4.x · 协同文档中心实施计划

| 属性 | 内容 |
|------|------|
| 目标版本 | `4.x`（首版 `4.0.0`） |
| 状态 | **4.0.0 已实施**（自动化门禁全绿 + 三平台打包发布实测通过；仅余桌面环境人工冒烟） |
| 更新日期 | 2026-09-02 |
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

### 3.4 链接可点（超链 / 文档互链 / 本地文件夹）

渲染出的内容里链接分三类，行为各不相同：

| 链接类型 | 识别方式 | 点击行为 |
|----------|----------|----------|
| 网页超链 | markdown 显式链接 + `linkify: true` 自动识别 http/https | 新浏览器标签打开（`target="_blank"` + `rel="noopener noreferrer"`） |
| 文档互链 | 指向 journals 内的 MD（`./step-01-x.md`、其它会话的公告/索引） | 文档中心**页内跳转**（浏览器历史可回退），不开新标签，防标签爆炸 |
| 本地文件夹/文件路径 | markdown 显式链接 + 保守自动识别：整行或独立 token 的绝对路径（Windows `C:\…`、UNC `\\srv\share`、POSIX `/…`）与 `#文件夹` 值 | **文件夹**：服务端 `isDirectory` 校验后起系统文件管理器（复用既有 `openLocalPath`，`start`/`open`/`xdg-open`）；**文件不直接打开**（防误执行），默认「打开所在文件夹」；文档中心自己的 MD 除外（页内打开） |

- Windows 反斜杠路径会被 markdown 转义吞掉（`D:\work\a` 渲染成 `D:worka`）：路径识别必须基于**原始文本**做 markdown-it 自定义 inline 规则，不能渲染后补链接。
- 自动识别从严起步：只认整行路径、独立路径 token、`#文件夹` chip，不动普通句子里的词，避免误判；4.1 按使用反馈放宽。
- 安全：`openLocalPath` 沿用既有令牌保护；服务端只放行「真实存在的目录」与 journals 白名单内的文件。MD 内容是本机 agent 产出，这层防的是**误点**（`.exe`、`.bat` 被当文件打开），不假设有远程攻击者。

### 3.5 打开方式与联动

- **新开标签是默认打开方式**：顶栏「文档」、右栏「打开 MD」、会话内文档引用，都以 `window.open('/docs?session=…&file=…')` 新开一个完整文档中心页面并定位到对应文件。工作台标签页保持原样，不被导航走。
- 3.x 的「打开 MD」是 `window.open` 指向**裸文件 URL**（无菜单）；4.0 换成指向文档中心页面，同一个新标签习惯，但内容从裸 MD 变成带菜单的页面。
- 「系统打开」（起 OS 查看器/编辑器）保留为文档中心右侧的次按钮。
- WebSocket 事件复用既有 `announcement.updated`：文档中心标签开着时内容自动刷新（4.0 最简实现：收到事件重拉当前文件）。

## 4. 版本切分

| 版本 | 主题 | 交付边界 |
|------|------|----------|
| `4.0.0` | 协同文档中心 MVP | `/api/docs` 列表/读/存公告；`/docs` 视图：左菜单双排序 + 右渲染；公告可编辑；**链接可点（超链/文档互链/本地文件夹）**；新标签打开；安全护栏 |
| `4.1.0` | 检索与导出 | 全文搜索（内存扫描，不引 FTS）；节点文档徽标（状态/适配角标）；「打包本群全部 MD」导出；代码高亮评估；按反馈放宽路径自动识别 |
| `4.2.0` | 发布更新 + 本地历史保留 | 更新检查（手动触发，可选启动检查默认关）+ 更新面板（changelog/下载指引）+ 更新前一键备份 + **备份恢复** + schema 迁移链正式化；**更新动作永不触碰 DATA_ROOT** |
| 后置 | 4.3+ | 自动下载替换的自更新（self-replace，Windows 需延迟替换脚本，另案）；差量更新；静默后台检查 |
| 后置 | 4.x 其它线 | 托盘独立窗、多终端标签治理、更多 CLI Adapter、文档版本历史/diff（git 化台账另案） |

`4.0` 不做：富文本编辑、协作多人光标、云端同步、`docs/` 仓库文档聚合。

## 5. Phase 1：4.0.0 文档中心 MVP

### 5.1 服务端

- [x] `server/src/docsHub.js`：扫描与缓存（60s + 失效）；路径白名单与穿越拦截
- [x] `GET /api/docs/list?sort=group|time`：分组/扁平两种形态
- [x] `GET /api/docs/file?sessionId=&name=`：读单文件（1MB 截断标记）
- [x] `POST /api/docs/open-path`：链接可点的服务端支撑——`isDirectory` 校验，复用 `openLocalPath` 起系统文件管理器；**文件只开所在目录**（防误执行）
- [x] `POST /api/docs/announcement`：保存公告（透传既有 `saveSessionAnnouncement`，含 manual 语义）
- [x] `routes.js` 挂接 + `web/src/api.js` 对应方法；`directory-structure.md` / `data-storage.md` 同步

### 5.2 前端

- [x] `router.js` 加 `/docs` 独立页面路由；`App.vue` 顶栏「文档」入口**新标签打开**
- [x] `views/DocsHub.vue`（928 行）：左菜单（双排序切换、群模板分组树）+ 右内容（渲染/编辑切换），独立页面自带返回工作台入口
- [x] `views/workbench/composables/useDocsHub.js`（381 行）：列表状态、当前文档、保存与离开守卫
- [x] `FlowRail`「打开 MD」改为 `window.open('/docs?…')` 新开标签打开文档中心（保留系统打开次按钮）
- [x] markdown-it 接入（`html:false`）+ 基础排版样式沿用 `--ecw-*` 令牌
- [x] 链接三类行为（见 §3.4）：自定义 inline 规则**基于原始文本**识别路径（反斜杠不被转义吞掉）；web 链接新标签、文档互链页内跳、文件夹起文件管理器、文件开所在目录

### 5.3 测试与安全

- [x] `server/test/docsHub.test.js`：扫描结构、双排序、白名单与穿越拦截、公告保存 manual 语义、1MB 截断、open-path 防误执行（6 例）
- [x] 链接用例（`web/test/docsRender.test.mjs`）：`C:\work\a b\` 含空格与反斜杠不被转义吞掉、普通句子不误判成路径、UNC 按转义后形态识别、尾随标点不入路径（10 例）
- [x] 渲染 XSS 用例：含 `<script>` / `onerror` 的 MD 不产生可执行节点；`javascript:` 方案不产出链接
- [x] 三平台打包冒烟通过（push main 流水线实测：CI + Pack release 全绿，ceeb6b1）

### 5.4 验收

- [x] 打开文档中心：默认群模板分组可见；切时间排序列表变化；点开公告可读、可编辑、保存后 `announcementManual` 语义生效
- [x] 台账文件无编辑入口；越权文件名请求被拒（本地 curl 实测）
- [ ] 群聊完成归档后文档立即可见——待桌面环境人工跑一次演示流确认（扫描/列表已有测试覆盖）

> 实施偏差（均为缩小范围/简化）：排序偏好存 `localStorage['acw.docsHubSort']`（未动 appSettings）；「系统打开」只保留为 FlowRail 次按钮（页面内省略）；公告更新联动用「刷新按钮 + 切文档重拉」替代 WS 订阅。

## 6. Phase 2：4.1.0 检索与导出（粗纲）

- [ ] 全文搜索：输入关键词 → 内存扫描 `journals` 命中文件 + 行摘要
- [ ] 节点文档徽标：状态 / 适配 / 克隆角标沿用流程轨语义
- [ ] 「打包本群全部 MD」：服务端打 zip 下载（复用 adaptBackup 的打包基建）
- [ ] 代码高亮评估（按需引入，不默认全量）

## 7. Phase 3：4.2.0 发布更新与本地历史保留（规范）

### 7.1 问题定义

运行包是 zip 解压即用，数据在包根的 `data/`。当前的更新方式是"下载新 zip 覆盖解压"，历史丢失只有一个真实途径：**解压到了新目录**（旧 `data/` 留在旧文件夹里）。4.2.0 要做的是：把"更新不丢数据"从约定升级为**机制**，并提供应用内更新检查与引导。

### 7.2 数据保留规范（硬规则）

1. **唯一事实源不动**：SQLite（调度真相）+ `journals/` 台账 + 附件/上传 + 日志 + 设置 + 熔炉记忆，全部位于 `DATA_ROOT`（默认 `<包根>/data/`，可被 `ACW_DATA_ROOT` 重定向）。
2. **更新动作永不触碰 `DATA_ROOT`**：发布 zip 内**不得包含 `data/**`**——此条加入 verify-pack 断言（当前实现已不打包 data，升级为强制校验）。
3. **覆盖解压 = 数据原地保留**：`data/` 不在 zip 内，同名目录解压覆盖程序文件后数据原样保留。这是**推荐更新方式**，写进更新面板指引。
4. **更新前强制引导备份**：进入更新面板先展示「更新前备份」一键按钮（复用 `backup.js`：integrity_check → wal_checkpoint → tar.gz 落 `data/backups/`），备份完成才展示下载指引。
5. **备份必须可恢复**：新增 restore——从 `data/backups/` 选择 tar.gz → integrity 校验 → 恢复前自动再打一份「恢复前备份」→ 覆盖 → 恢复后 integrity_check + 提示重启。没有 restore 的备份不构成保留承诺。
6. **schema 迁移链正式化**：`initDb` 的 ad-hoc `ALTER` 收敛为有序 `migrations` 数组，按 `schema_version` 递增执行、事务包裹、幂等、失败即停并指向恢复备份。旧库升级不丢表不丢列。
7. **降级不承诺**：新 → 旧版本不在保留承诺内（schema 只进不退）；回退唯一路径是 restore 备份。文档明示。

### 7.3 更新模型（三层渐进，4.2.0 只做 L1 + L2）

| 层 | 能力 | 版本 |
|----|------|------|
| L1 检查 | 设置→关于「检查更新」按钮；可选「启动时检查」开关（**默认关**，守住"不自动联网"原则）。更新源：GitHub Releases API（公开仓库免凭据）与 `updateUrl` 指向的静态 `latest.json` 双源，超时 3s 静默降级 | `4.2.0` |
| L2 获取 | 更新面板：当前版本 / 最新版本 / 新版 changelog（远程 manifest 携带）/ 平台匹配下载链接（`window.open` 交给浏览器下载）/「更新前备份」一键 / 覆盖解压指引（一键复制三步说明） | `4.2.0` |
| L3 应用 | 自动下载 + 校验（BUILD_INFO/魔数）+ 解压替换 + 重启（self-replace；Windows 运行中文件需延迟替换脚本） | 后置 `4.3+` |

远程 manifest（`latest.json`，由发布流水线在 release 时生成上传）：`{ version, date, notes, minCompatible, assets: { 'win32-x64': url, ... } }`。`minCompatible` 声明数据 schema 兼容下限，跨大版本提示先升中间版。

### 7.4 任务

- [ ] 服务端 `server/src/updateCheck.js`：双源检查 + 3s 超时降级 + 版本比较（semver 主.次.修）
- [ ] `GET /api/update/check`（手动/开关开启时启动调用）；`POST /api/update/backup`（复用 backup.js）；`POST /api/update/restore`（含恢复前备份 + integrity 双查）
- [ ] schema 迁移链：`db.js` 的迁移收敛为 `migrations` 数组 + `schema_version` 驱动；历史迁移行为纳入首条幂等迁移
- [ ] verify-pack 新增断言：zip 内不得出现 `data/**`
- [ ] 前端：设置→关于 新增「更新」卡（检查按钮 + changelog 面板 + 备份/指引）；「启动时检查」开关进 Prefs
- [ ] `web/src/api.js` 对应方法；`RELEASE-USER.md` 写清三种更新路径（覆盖解压 / ACW_DATA_ROOT / 导入备份）

### 7.5 测试与安全

- [ ] updateCheck 单测：版本比较、双源降级、超时静默、manifest 缺字段
- [ ] restore 单测：完整性校验失败拒绝、恢复前备份生成、恢复后 integrity_check
- [ ] 迁移链单测：旧 schema_version 库升到当前、幂等重跑、失败停住不半迁移
- [ ] verify-pack 断言：zip 内无 `data/**`
- [ ] 模拟升级演练：v4.0.0 包造数据（演示流跑数节点）→ v4.2.0 包覆盖解压 → 会话/台账/公告/设置完整、应用正常

### 7.6 验收

- [ ] 检查更新手动可用、默认不联网；面板正确展示 changelog 与平台下载链接
- [ ] 更新前备份一键完成；restore 能回到备份点（含"恢复前再备份"）
- [ ] 覆盖解压升级演练：历史记录（会话/节点台账/群公告/设置/附件）全部保留
- [ ] 三平台打包冒烟通过；RELEASE-USER.md / data-storage.md / 本计划同步

## 8. 不动项

- 不改 SQLite schema、不改 journal 写入格式（`step-*.md` frontmatter 不动）。
- 不改 `requireLocalAccess` 安全模型；文档中心不引入新端口。
- 不做多人协作、不做云同步、不动 `docs/` 仓库文档。
- 自动刷新不覆盖人工编辑的既有语义（`announcementManual`）不回退。

## 9. 风险与对策

| 风险 | 对策 |
|------|------|
| agent 产出混入恶意 HTML/脚本 | 渲染器 `html:false` + XSS 测试用例锁死 |
| 误开本地文件导致执行（.exe/.bat） | 文件一律不直接打开——只开所在文件夹；目录才起文件管理器；服务端白名单 + isDirectory 校验 |
| 用户误改台账破坏溯源 | 台账只读；编辑入口只给公告 |
| 会话量大列表卡顿 | 60s 缓存 + mtime 增量；菜单分组懒展开 |
| 新依赖膨胀运行包 | markdown-it ~100KB，verify-pack 体积基线对比 |
| 与 3.8 拆分后的模块边界冲突 | docsHub 独立成模块，不进 engine/；走 services/routes 层 |
| 更新检查被误解为"自动联网上传数据" | 默认手动触发；启动检查开关默认关；面板明示"只读远端版本号与更新日志，不上传任何本机数据" |
| restore 覆盖写坏现有库 | 恢复前强制再打一份备份；integrity_check 前后双查；失败即停不动原库 |
| 迁移半途失败留下脏库 | 迁移事务包裹 + schema_version 单调推进；失败即停并指向恢复备份 |

## 10. 完成定义（封板口径）

### 10.1 4.0（协同文档中心）

- `/docs` 页面（新标签打开）可用：默认群模板排序 + 可切时间排序；公告可读可编辑可保存；顶栏与「打开 MD」均新开标签进入。
- 链接可点：网页超链新标签、文档互链页内跳转、`#文件夹`/本地路径起文件管理器（文件只开所在目录）。
- 台账只读 + 路径白名单 + 渲染不执行 HTML，安全用例全绿。
- 三平台打包冒烟通过；README / data-storage / frontend-components / directory-structure 已同步。

### 10.2 4.2.0（发布更新与本地历史保留）

- 「检查更新」手动可用（默认不联网，开关默认关）；面板展示 changelog 与平台下载链接。
- 更新前一键备份；restore 能回到备份点（含"恢复前再备份"与 integrity 双查）。
- schema 迁移链落地：旧 schema_version 库升级幂等、失败停住、测试覆盖。
- 覆盖解压升级演练通过：会话/台账/公告/设置/附件**全部保留**；verify-pack 断言 zip 内无 `data/**`。
- RELEASE-USER.md / data-storage.md / 本计划同步；三平台打包冒烟通过。
