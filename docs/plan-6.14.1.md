# 6.14.1 计划：文档中心标题 + 深色外观补丁

> **定位**：PR [#184](https://github.com/371684029/oh-my-co-work/pull/184)。在 **6.14.0** 之上修补文档中心可读性与 `UI-05` 深色兼容，不扩内核。合 main 后发 **6.14.1** patch。

标注：**P0** 本版必达；**P2** 可延续 backlog。状态 `[ ]` / `[x]`。

---

## 一、本版任务（P0）

| 状态 | ID | 待办 |
| --- | --- | --- |
| [x] | DOC-TITLE-01 | 群报告 `ANNOUNCEMENT.md`：主标题/侧栏/最近打开优先 **群聊名**（`groupTitle`） |
| [x] | UI-DARK-01 | `ecw-theme-dark` 壳层 token：面板、顶栏、设置区、Element 输入/分段器 |
| [x] | UI-DARK-02 | `ecw-dark-compat.css`：表格、Popover、工作台聊天气泡 |
| [x] | UI-DARK-03 | Composer 输入条 / 折叠脚 / 归档提示、文档正文列 / 大纲、About/Support 卡片随 token |
| [x] | UI-DARK-04 | 界面设置保存防抖 + `ElMessage` grouping |
| [x] | QA-01 | `npm run lint` + `npm test` + `npm run test:web`（含 `ecwThemeDark` / `docsHubStatusUi`）+ CI 绿 |

---

## 二、延续 backlog（P2，非 6.14.1 阻断）

| 状态 | ID | 待办 |
| --- | --- | --- |
| [ ] | UI-DARK-05 | 熔炉 TUI/GUI 全量暗色审计（`FurnaceWorkspace*` 内联色） |
| [ ] | UI-DARK-06 | 文档顶栏独立模式按钮（`App.vue` docs topbar）统一 token |
| [ ] | UI-TOK-01 | `styles.css` 外 Vue 硬编码 rgba 渐进替换（见 `plan-5.2.0` UI-04 债） |

---

## 三、发版勾选项（合入后人工）

- [x] 四包 `package.json` + `about.json` + `CHANGELOG.md` → **6.14.1**
- [x] `docs/README.md` 当前开发线一句

---

## 四、验收

1. 深色：设置 → 偏好 → 深色；工作台 Composer、文档中心正文、成员表无大面积死白。
2. 文档：按时间列表群报告条目为群聊名，非 `ANNOUNCEMENT.md`。
3. 与 CI 同款命令本地绿。