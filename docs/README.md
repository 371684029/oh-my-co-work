# 文档索引

本目录为 **oh-my-co-work** 的设计与约定文档。上手运行请先看仓库根目录 [README.md](../README.md)。

| 文档 | 用途 |
|------|------|
| [mvp.md](./mvp.md) | 宗旨、验收；§2.7～§2.10 已封 · §2.11 `1.0.0` · §2.12 `1.1.x` · §2.13 `1.2.0` · §2.14 `1.3.0` · §2.15 `1.4.0` · §2.16 `1.5.0` **最终封板** |
| [demo.md](./demo.md) | **怎么看演示效果**（启动、演示流点选、排障） |
| [RELEASE-USER.md](./RELEASE-USER.md) | **压缩包用户说明**（一键启动；默认关浏览器不停服务） |
| [technical-design.md](./technical-design.md) | 完整技术设计（含后置能力） |
| [data-storage.md](./data-storage.md) | **数据怎么存（SQLite / MD / 文件）** 当前实现说明 |
| [data-and-ops.md](./data-and-ops.md) | 数据分层原则、稳定与扩展 P0–P4；**§9 待改进 backlog**（含脚本上下文注入） |
| [script-guide.md](./script-guide.md) | **写脚本指南**：占位符 / `ACW_*` / cwd / 缺参拦截（CI03） |
| [frontend-components.md](./frontend-components.md) | **优先 Element-Plus-X** + UI 布局/氛围约定 |
| [brand-logo.md](./brand-logo.md) | **Logo 含义与资产** |
| [directory-structure.md](./directory-structure.md) | 目录与模块边界（对齐代码） |
| [author-contact.example.json](./author-contact.example.json) | 支持与交流配置示例 |

## 维护原则

1. **README** = 对外/对内第一入口（安装、运行、功能现状、API 摘要）。  
2. **mvp.md** = MVP 做没做、验什么。  
3. **technical-design.md** = 为什么这样设计、后置怎么做。  
4. **data-storage.md** = **当前实现**（落库路径、脚本执行、群报告、弹窗）；改 runner/journal/设置时必改。  
5. **data-and-ops.md** = 工程优先级 + **§9 待改进 backlog**（脑子懵了先记着）。  
6. 改代码导致行为变化时，至少更新 README + data-storage（或 mvp 对照）；涉及架构再改 technical-design。  
7. 改工作台布局 / 视觉氛围 / 组件用法时，同步 [frontend-components.md](./frontend-components.md)。  
8. **及时维护**：合并功能当天补文档修订记录，避免实现与文档漂移。  
9. **版本纪律**：`0.4.0` 已最终封板；当前发布线 **`1.5.x`**（先改 mvp / data-and-ops 再写代码）。  

| 1.7.0 | **最终封板**：产品统一更名为 `oh-my-co-work`。 |
