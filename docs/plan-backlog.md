# 产品待办栏（backlog）

> **用途**：聚合当前发版线及相邻计划的**未勾选项**，供迭代与 Agent 对齐。细则仍以各 `plan-*.md` 为准；本栏只做索引与状态 `[ ]` / `[x]`。
>
> **最后对齐**：6.8.0 已上 main · **6.9.0 熔炉炼化闭环已规划、未开工**（[`plan-6.9.0.md`](./plan-6.9.0.md)）· 更新 2026-11-20

---

## A. 6.5.x 炼化 diff 余量（`docs/plan-6.5.0.md`）

| 状态 | ID | 优先级 | 待办 |
| --- | --- | --- | --- |
| [ ] | RFD-03 | P1 | 扩充分 history API / catalog：unified diff + 超长折叠（>200 行） |
| [ ] | RFD-13 | P2 | 导出单次 diff 为 `.patch` 或写入 `journals/.../assets/` |
| [ ] | RFD-21 | P1 | 流程轨失败节点：深链「该成员最近炼化 diff」 |
| [ ] | RFD-22 | P2 | 时间线事件 `refine.source_patched` + 工作台筛选 |
| [ ] | RFD-11+ | P1 | 文档中心「炼化与还原」**按成员名过滤**（入口已有，`pane=refine`） |

---

## B. 6.5+ 体验与设置债

| 状态 | ID | 优先级 | 待办 |
| --- | --- | --- | --- |
| [ ] | DEBT-01 | P1 | `settings.refine.backup` 正式键名（读库兼容 `adapt.backup`） |
| [ ] | RFN-F | P1 | 成员设置 `refine.format.title` **可编辑**（现只读摘要） |
| [ ] | NTF-R | P2 | 终端长任务炼化完成 **轻量 toast** |
| [ ] | DEBT-02 | P2 | 再扫 restore-center / 历史 i18n「适配」字样与 `docs.badges.adapt` |

---

## C. 6.4.x 熔炉 Skills 余量（`docs/plan-6.4.0.md` §八）

| 状态 | 待办 |
| --- | --- |
| [ ] | **FSK-B**：阶段 B — 设置弱化 `prompts/*.md`，Skill 单写 + 生成 prompt 片段 |
| [ ] | Grok CLI skills 目录：按 `grok inspect` 探测，必要时 `furnaceSkillSync` 分支 |
| [ ] | 自定义 `workspaceDir`：覆盖 `.grok/skills` 前是否二次确认 |
| [ ] | **CUR-F**：`furnaceAgent=cursor` 时 Skills → `.cursor/rules` 镜像（另开任务） |
| [ ] | prompts 与 Skills **单写**治理（避免双处编辑） |

---

## D. 6.2 / 6.1 后置（非阻塞当前线）

| 状态 | ID | 待办 | 说明 |
| --- | --- | --- | --- |
| [ ] | SRC-06 | `Ctrl/Cmd+Shift+F` 打开全局搜索 | `plan-6.2.0.md` · 明确本版不做 |
| [ ] | TRM-06 | xterm 位图截图落盘 | `plan-6.1.0.md` · 文本定格不满足再开 ADR |
| [ ] | DOC-06 | `plan-docs-4x.md` §3.2 脚注 6.1 侧栏口径 | 文档一致性 |
| [ ] | REL-6.1 | 6.1 终端定格对外 changelog 口径 | 可与 about 历史条目合并说明 |

---

## H. 6.8.0 试跑失败 → 熔炉炼化（`docs/plan-6.8.0.md`）

| 状态 | ID | 优先级 | 待办 |
| --- | --- | --- | --- |
| [x] | RFV-01 | P0 | `GET /members/:id/refine/verify-prompt`（或扩 refine-prompt）含试跑失败摘要 |
| [x] | RFV-10 | P0 | 成员抽屉试跑失败旁「前往熔炉炼化」+ 弹窗 Grok/Cursor/外部 |
| [x] | RFV-12 | P0 | 跳进工作台熔炉 query + Prompt 预填/复制 |
| [x] | RFV-13 | P1 | `useFurnaceSync` 开炉 + agent + 剪贴板 |
| [x] | RFV-15 | P2 | 文档中心试跑未通过卡同款入口 |
| [ ] | RFV-21 | P1 | Cursor 路径降级说明（CUR-F 可选） |

---

## I. 6.9.0 熔炉炼化闭环（`docs/plan-6.9.0.md`）

| 状态 | ID | 优先级 | 待办 |
| --- | --- | --- | --- |
| [x] | RCL-01 | P0 | 有路径的成员随时可「进入熔炉改这个工具」，不看试跑成败 |
| [x] | RCL-02 | P0 | 还原清除 `verifyFailed`，过期失败不写进新绑定 |
| [x] | RCL-03 | P0 | 未保存的契约预览不称「已保存」 |
| [x] | RCL-04 | P0 | 进熔炉不调用 verify-prompt；弹窗不要一打开就请求 |
| [x] | RCL-05 | P0 | 契约不再插 `ACW_VERIFY` 早退；保存时去掉旧行 |
| [x] | RCL-06 | P0 | 短脚本非 0 退出失败；标题后仍不退出的按常驻通过 |
| [x] | RCL-10 | P0 | 工具姿态 `active` / `paused` / `none`，只有 `active` 才是本轮任务 |
| [x] | RCL-11 | P0 | 换成员新开；先聊别的、解除、继续改同一成员都接着聊 |
| [x] | RCL-15 | P0 | 熔炉顶栏焦点条，TUI 打字不改姿态 |
| [x] | RCL-12 | P1 | 「进入熔炉」弹窗去掉「外部 Agent 只写群报告」 |

---

## E. 工程 / 协作杂项

| 状态 | 待办 |
| --- | --- |
| [ ] | GitHub **PR #173** 若仍 open：标 superseded 或关闭（main 已含 6.3/6.4） |
| [ ] | `resolveAdaptFurnaceRole` / `MEMBER_ADAPT` 角色：**只读兼容**期满后的删除评估 |

---

## F. 历史大计划（不展开，按需打开）

> 以下文件内仍有大量 `[ ]`，属**旧版本线**（5.x TUI、4.x 文档、3.x 熔炉封板前）。新功能默认不进本栏明细，避免与 6.x 主线混淆。

| 文档 | 主题 |
| --- | --- |
| [plan-5.4.0.md](./plan-5.4.0.md) | 系统通知实机 NTF-T3/T4 |
| [plan-5.5.0.md](./plan-5.5.0.md) / [plan-5.6.0.md](./plan-5.6.0.md) | 桌面包、大文件拆、无障碍、E2E |
| [plan-5.8.0.md](./plan-5.8.0.md) | 性能 HUD / transcript 真增量 |
| [plan-tui-2x.md](./plan-tui-2x.md) | TUI 2.x 全量验收表（多数已交付，表未全勾） |
| [plan-refine-search-4x.md](./plan-refine-search-4x.md) | 4.x 炼化/搜索（已由 6.x 替代，条目标历史） |
| [plan-docs-4x.md](./plan-docs-4x.md) | 文档中心 4.x / 自更新 UPD-* |
| [plan-crucible-3x.md](./plan-crucible-3x.md) | 3.x 熔炉封板前待决 |

---

## G. Cursor Agent 待办同步清单（与上表 A–I 一一对应）

1. RFD-03 refine history API + 截断  
2. RFD-13 导出 patch  
3. RFD-21 流程轨深链 diff  
4. RFD-22 时间线 refine.source_patched  
5. 文档中心炼化列表成员过滤  
6. settings.refine.backup 迁移  
7. refine.format.title 可编辑  
8. 终端炼化 toast  
9. FSK-B prompts 阶段 B  
10. Cursor 熔炉 Skills 镜像  
11. SRC-06 全局搜索快捷键  
12. PR #173 收尾  
13. DEBT restore-center / adapt 文案扫尾  
14. Grok skills 目录探测 + workspace 覆盖确认（6.4 §八）  
15. RFV-01 试跑失败 contextual prompt API  
16. RFV-10/12 前往熔炉炼化弹窗与跳进熔炉  
17. RCL-01～06 / RCL-10～15 熔炉生命周期：改工具 / 挂起聊别的 / 解除（`plan-6.9.0.md` §I）