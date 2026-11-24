# 6.10.0 计划：文档与协作指引对齐（DOC-10）

> **定位**：仓库 `package.json` 已到 **6.9.0**，但 `AGENTS.md`、`product-mvp.md`、`tech-architecture-map.md` 与 `docs/README.md` 产品表仍停留在 3.x～5.x 口径，README 路线图过长难扫。本版**不改业务行为**，只做文档/协作/对外叙事对齐，并 bump 版本号便于 Release 与 about 页一致。
>
> **约束**：不引 TypeScript、不拆大 Vue 文件（留给后续 6.11+）、不顺带炼化 backlog 功能项。

标注：**P0** 本版必达；状态 `[ ]` / `[x]`。仓库版本 **6.10.0**。

---

## 一、任务清单

| 状态 | ID | 优先级 | 待办 |
| --- | --- | --- | --- |
| [x] | DOC-10-01 | P0 | `AGENTS.md`：版本 **6.10.0**、6.x 现状摘要、`electron/` / `skills/` 目录、参考文档链到 `plan-6.9` + `plan-backlog` |
| [x] | DOC-10-02 | P0 | `docs/product-mvp.md`：顶部状态增加「当前发布线 6.10.0」，保留 3.7 封板历史 |
| [x] | DOC-10-03 | P0 | `docs/tech-architecture-map.md`：页眉版本改为 **v6.10.0**（代码形态描述仍随 main） |
| [x] | DOC-10-04 | P0 | `docs/README.md`：当前开发线 6.10.0；`product-mvp` 表「当前发布线」；`plan-6.10.0` 索引；维护原则补 CODE_CHANGE 归档约定 |
| [x] | DOC-10-05 | P0 | `README.md`：徽章/源码版本 6.10.0；路线图改为表格 + 链 `CHANGELOG` / `plan-backlog`；参与项目补 Windows 桌面优先与 backlog 入口 |
| [x] | DOC-10-06 | P0 | `docs/guide-release-user.md`：贡献/PR 策略（Windows 攻坚期） |
| [x] | DOC-10-07 | P0 | 四包 `package.json` + `about.json` + `CHANGELOG.md` → **6.10.0** |
| [x] | DOC-10-08 | P0 | `plan-backlog.md` 顶部对齐 6.10.0 |
| [x] | DOC-10-09 | P0 | `npm ci` + `npm run lint` + `npm test` + `npm run test:web` + `npm run test:electron` 通过 |
| [x] | DOC-10-10 | P0 | `ci-e2e-smoke` 多会话切换：搜索按钮文案对齐全局搜索（`searchChatAria`） |

---

## 二、验收

1. 全文检索 `适用于 oh-my-co-work v5.3.1` / `v5.3.2` 仅允许出现在历史 plan 正文，不出现在 AGENTS / architecture-map 页眉。
2. CI 同款命令本地绿。
3. `CODE_CHANGE.md` 记录本版 touched 文件。