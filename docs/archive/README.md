# 历史计划归档（只读参考）

本目录用于标记 **已封板或已被更高版本计划取代** 的设计/实施文档。文件仍保留在 `docs/` 根目录（避免破坏链接），此处仅作索引与 REPO-02 治理说明。

## 当前开发线（活跃）

- [5.0.0-plan.md](../5.0.0-plan.md) · [5.1.0-plan.md](../5.1.0-plan.md) · [5.2.0-plan.md](../5.2.0-plan.md) · [5.3.0-plan.md](../5.3.0-plan.md) · [5.4.0-plan.md](../5.4.0-plan.md)

## 历史线（只读，勿再勾选验收）

| 文档 | 说明 |
|------|------|
| tui-2x-plan.md | 2.x 内嵌 TUI 实施计划（已合入主线能力） |
| crucible-3x-plan.md | 3.x 熔炉计划（已封板） |
| refactor-3.8-plan.md | 3.8 重构（已实施，人工冒烟待补） |
| docs-4x-plan.md | 4.x 文档中心/更新计划 |
| 4.7.0 / 4.8.0 / 4.9.0-plan.md | 4.x 末段发布线 |

版本号单一来源：仓库根 `package.json` + `scripts/sync-docs-version.mjs` → `docs/README.md`。
