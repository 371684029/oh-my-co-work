# 6.2.0 计划：全局聊天搜索与会话「完成」归档

> **定位**：6.1.0 聚焦文档中心导航与终端历史定格；6.2.0 收两件**顶栏与会话头**体验债——聊天搜索藏在单会话头里且前端强制 `sessionId`，与后端 4.6 跨会话能力不一致；手动结束会话只能等流程终局或进设置释放，缺一个与自动归档同效果的「完成」捷径。
>
> **约束**：本机优先；搜索仍走既有 `searchMessages` + SQLite/内存扫描，不新建索引服务；手动归档必须复用 `archiveSession`，禁止旁路杀进程。
>
> 标注：**P0** 本版核心；**P1** 重要；**P2** 后置。状态 `[ ]` / `[x]` 维护。

---

## 一、现状（读代码确认）

### 1.1 聊天搜索

| 环节 | 实现 | 缺口 |
| --- | --- | --- |
| API | `GET /api/messages/search?q=&sessionId=` 可选限定会话 | 已支持跨会话 |
| 前端入口 | `Workbench.vue` 会话头「搜索聊天」文字按钮 | 用户期望**右上角放大镜**、**全局**检索 |
| 查询条件 | `canRunChatSearch` 要求 `sessionId` | 未选会话或想跨会话时被挡 |
| 命中跳转 | `jumpToChatHit` 可切换 `sessionId` 并滚到 `data-msg-id` | 逻辑可复用到壳层顶栏 |

### 1.2 会话归档

| 环节 | 实现 | 缺口 |
| --- | --- | --- |
| 内核 | `archiveSession`：杀会话进程、清 pendingArchive、写 `archived`、WS `session.archived` | 完整 |
| 自动 | 流程终局 `advance` → `archiveSession(..., 'completed')` | 有 |
| 手动 API | `POST /sessions/:id/archive` | 前端**无**顶栏/会话头入口 |
| 用户心智 | 左侧「已归档」筛选 | 需要会话头上的 **Done/完成** 一键归档 |

**结论**：搜索是 **IA + 一行 `sessionId` 绑定**；归档是 **前端未接已有 API**。

---

## 二、产品目标

1. **全局搜索**：应用顶栏右侧（工作台 / 设置）显示放大镜；打开后搜索**全部会话**聊天记录（拼音/首字母沿用 4.6）；命中展示会话标题 + 摘要，点击跳转到对应会话与消息。
2. **完成归档**：当前会话头增加 **完成（Done）**；确认后调用 `archiveSession`（`reason: manual`），与自动归档相同释放进程与内存；已归档会话隐藏该按钮。

---

## 三、能力清单

### 3.1 全局聊天搜索（SRC）

- [x] **SRC-01 P0 顶栏入口**：`App.vue` `top-right` 放大镜（`AcwIcon search`）；文档中心顶栏保持现有文档搜索，不重复。
- [x] **SRC-02 P0 组件抽离**：`GlobalChatSearch.vue`（popover + 防抖 + 竞态防护）；从 `Workbench.vue` 移除会话头搜索按钮。
- [x] **SRC-03 P0 跨会话查询**：`canRunChatSearch` 仅校验 `query`；`api.messages.find(q)` 不传 `sessionId`。
- [x] **SRC-04 P0 跳转**：跨路由 `router.push(/workbench/:id)` + pending message id，在 `selectSession` 后滚到气泡。
- [x] **SRC-05 P1 i18n / a11y**：文案改为「全部会话」；E2E smoke 更新 aria 断言。
- [ ] **SRC-06 P2 快捷键**：`Ctrl/Cmd+Shift+F` 打开全局搜索（与终端查找区分）——本版不做。

### 3.2 会话完成归档（ARC）

- [x] **ARC-01 P0 会话头按钮**：`Workbench.vue` 在置顶与删除之间增加「完成」；`status === archived` 时隐藏。
- [x] **ARC-02 P0 动作层**：`sessionArchiveActions.js` + `lifecycle` 接线；确认框说明释放进程；`POST archive` 后 `loadDetail` + `loadLists` + `terminalBridge.resetTerminals`。
- [x] **ARC-03 P1 i18n**：中英「完成 / Done」与确认文案。
- [x] **ARC-04 P1 单测**：`sessionArchiveActions` 冒烟；`workbenchChatSearchUi` 更新 `canRunChatSearch` 断言。

### 3.3 文档与发布

- [x] **REL-01 P0** 本文件 + `CODE_CHANGE.md` 台账。
- [ ] **REL-02 P1** `package.json` 版本号与 CHANGELOG（发布时）。

---

## 四、技术方案要点

1. **搜索样式**：会话头 `.chat-search-*` 样式迁入 `GlobalChatSearch.vue`，保留 `popper-class="chat-search-popper"`。
2. **归档副作用**：依赖服务端 `archiveSession` 与 WS，前端不重复杀 PTY；归档后列表筛选项「已归档」立即可见。
3. **成员单聊**：若产品日后禁止单聊归档，可在 `ARC-01` 加 `kind === adhoc` 禁用；本版与 API 一致，不额外限制。

---

## 五、里程碑

| 阶段 | 交付 |
| --- | --- |
| M1 | 规划文档（本文件）评审 |
| M2 | SRC-* + ARC-* 代码与单测绿 |
| M3 | E2E smoke 通过，合并 main |

---

## 六、验收清单

- [ ] 顶栏放大镜可见；无选中会话亦可搜索并命中多会话结果。
- [ ] 点击命中跳转正确会话并滚动到消息。
- [ ] 会话头「完成」归档后状态为已归档，终端/进程释放（与流程走完一致）。
- [ ] `npm run test`（server + web）通过。