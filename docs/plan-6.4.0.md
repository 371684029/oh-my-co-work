# 6.4.0 计划：熔炉 Skill 化（Grok 能力从 AGENTS 标记块迁到 Skills）

> **定位**：6.3.0 把炼化 IO 契约与 `furnace-refine-skill` 讲清；6.4.0 把熔炉相对「原生 Grok」的**全部定制能力**统一改成 **Grok CLI 可发现的 Skills**，AGENTS.md 只保留极薄引导，便于维护、版本化和设置页「复制 Skill」。
>
> **产品一句话**：用户仍然用同一个本机 `grok` TUI；熔炉只是换工作目录、注入情境，并让 Grok **按需加载** oh-my-co-work 自带的熔炉 Skills（炼化、加成员、建群模板、审核），而不是把长手册塞进 `AGENTS.md` 标记块和 `prompts/*.md` 两套文案。
>
> **约束**：不自研 Grok HTTP 客户端（见 `docs/tech-crucible-grok-client.md`）；不往 `~/.grok/AGENTS.md` 写内容；长情境仍在 `ACTIVE.md` / `SITUATION.md`，不把会话地图贴进对话。

---

## 一、原生 Grok vs 熔炉 Grok（当前实现）

| 维度 | 原生 Grok | 熔炉里的 Grok |
| --- | --- | --- |
| **进程** | 用户本机官方 Grok Build CLI | **同一个** `grok` 二进制，无 fork 定制版 |
| **工作目录** | 用户自选 / 默认 | `data/furnace/` 或设置里的 `grok.workspaceDir`（禁止指到 `~/.grok` 家目录） |
| **凭证与模型** | `~/.grok/auth.json`、`config.toml`、`XAI_API_KEY` | **不变**，熔炉不代登录、不代发 API |
| **启动方式** | 用户手敲 `grok` | 引擎当 **脚本成员** PTY 拉起（`waitForExit=false`），GUI 是 PTY 回放 |
| **协同台注入** | 无 | `syncFurnaceSessionContext` → 写 `ACTIVE.md`、可选写工作区 `AGENTS.md` 标记块 + `.grok/rules/session.md`、复制 `acw-ctl.mjs` |
| **角色切换** | 无 | `FURNACE_ROLE` + `server/config/furnace/prompts/*.md` 拼进 `ACTIVE.md`（一次一套） |
| **与仓库根 `AGENTS.md` 关系** | 无关 | **无关**：熔炉写的是 **`data/furnace/AGENTS.md`**（或自定义 workspace），不是贡献者用的仓库根 `AGENTS.md` |

结论：**熔炉 ≠ 改版 Grok**，而是 **同 CLI + 专用 cwd + 协同台写好的上下文文件**。区别落在文件注入与角色壳，不在模型或协议。

---

## 二、今天定制能力放在哪里（为什么要改）

```text
协同台 advance / 聊天 / 闸门
        │
        ▼
furnaceSituation.syncFurnaceSessionContext
        │
        ├─ activateFurnaceRole(role) ──► ACTIVE.md
        │      = 情境 + prompts/{role}.md + memory/{role}.md
        │
        └─ maybeInjectGrokFurnace(pack) ──►
               AGENTS.md <!-- oh-my-co-work-furnace:begin --> … end -->
               .grok/rules/session.md（与标记块**同文重复**）
               内含：身份 + acw-ctl 长篇手册 + 「此刻」420 字 + 启动短句
```

| 载体 | 内容类型 | 问题 |
| --- | --- | --- |
| `prompts/session.md` 等 | 角色长文（含加成员/建群步骤） | 与 `composeAgentsInner` 里 acw-ctl 说明 **重复** |
| `furnaceGrokInject.composeAgentsInner` | 短合同 + **整段 acw-ctl 帮助** | 改 CLI 要改 JS 字符串，难 diff、难给用户提供「复制 Skill」 |
| `memory-seed/*.md` | 用户可编辑长期记忆 | 合理保留；不应承载操作手册 |
| `skills/agent-refine-skill` | 外部 Cursor Agent 写群报告 | **未**安装进 Grok workspace；与熔炉炼化改源是两条线（见 6.3 §5.5） |
| Grok **Skills** | 官方 CLI `grok inspect` 可列 | **当前未使用** `.grok/skills/` |

原生 Grok 也可在用户项目里放 `AGENTS.md` / rules；熔炉过去为避免 CLI 无 `--prompt` 预填首句，把「短启动词 + 手册」写进 **标记块**（见 `furnaceGrokInject.js` 头注释）。6.4 改为：**手册进 Skills，标记块只指路径与本轮情境**。

---

## 三、目标架构：Skills 为单一事实源

### 3.1 能力 → Skill 映射（建议目录）

仓库统一放在 `skills/`，安装/同步到熔炉工作区 `.grok/skills/`（或 Grok 文档规定的 skills 根；以本机 `grok inspect` 为准）。

| Skill | 路径 | 取代 / 承接 |
| --- | --- | --- |
| 熔炉身份与读情境 | `skills/furnace-core/SKILL.md` | `prompts/session.md` 通用原则；AGENTS 标记块里的「你是谁」 |
| 成员与群模板（acw-ctl） | `skills/furnace-acw-ctl/SKILL.md` | `session.md` §添加成员、`composeAgentsInner` acw-ctl 列表 |
| 熔炉炼化改源 | `skills/furnace-refine-skill/SKILL.md` | `prompts/refine.md` + 6.3 RFN-SKILL |
| 闸门 / 审核 | `skills/furnace-review/SKILL.md` | `prompts/review.md` |
| 外部 Agent 写群报告 | `skills/agent-refine-skill/SKILL.md` | **保持独立**，不装入 Grok workspace 默认可选包 |

**废弃方向（6.4 末尾 / 6.5）**

- `FURNACE_ROLE.MEMBER_ADAPT` / `NODE_ADAPT`：产品已去 adapt；角色文件保留只读兼容一版，默认不再切换，文案指向「用 refine skill 或 core」。
- `prompts/*.md`：过渡期 = **从 Skill 导出** 或 Skill 内 `include` 段落生成 ACTIVE 的 `## Prompt` 节（避免双份手写）。

### 3.2 同步后三层分工

| 文件 | 6.4 目标内容 |
| --- | --- |
| `ACTIVE.md` | 会话情境 + **本轮激活的 Skill 名列表** + 可选 memory；不再嵌半份操作手册 |
| `AGENTS.md` 标记块 | ≤20 行：熔炉身份一句、读 `ACTIVE.md`、**本轮请加载 skills: …**、`此刻` 420 字、启动短句（不再列 acw-ctl 子命令） |
| `.grok/skills/acw-*` | 从仓库 `skills/` 复制/软链；版本号写在 Skill frontmatter |

### 3.3 角色 → 默认 Skill 束

| `FURNACE_ROLE` | 默认激活 Skills | 备注 |
| --- | --- | --- |
| `session` | `furnace-core` + `furnace-acw-ctl` | 主持默认带 acw-ctl |
| `refine` | `furnace-core` + `furnace-refine-skill` | 与 6.3 接线 `resolveRefineFurnaceRole` |
| `review` | `furnace-core` + `furnace-review` | 闸门 / 审核步 |
| `member_adapt` / `node_adapt` | （弃用）→ 仅 `furnace-core` | 日志告警一次 |

实现上：`shared` 增加 `FURNACE_ROLE_SKILLS` 映射；`syncFurnaceSessionContext` 在写 ACTIVE/Grok 前调用 `syncFurnaceSkillsToWorkspace(cwd)`。

---

## 四、工程任务清单（FSK）

### 4.1 Skill 内容与仓库

- [ ] **FSK-01 P0** 新增 `skills/furnace-core/SKILL.md`、`skills/furnace-acw-ctl/SKILL.md`（从 `session.md` + `composeAgentsInner` **搬迁**，删重复）。
- [ ] **FSK-02 P0** 落地 `skills/furnace-refine-skill/SKILL.md`（承接 6.3 RFN-SKILL-01）。
- [ ] **FSK-03 P1** 新增 `skills/furnace-review/SKILL.md`（从 `prompts/review.md`）。
- [ ] **FSK-04 P1** Skill frontmatter 统一：`name` / `description` / `version` / `acw.minVersion`。
- [ ] **FSK-05 P2** 设置页「熔炉 Skills」：列出版本、一键「同步到工作区」、复制单 Skill 正文（外部 Agent 仍用 agent-refine-skill 入口）。

### 4.2 运行时同步与瘦身

- [ ] **FSK-10 P0** `server/src/furnaceSkillSync.js`：把 `skills/furnace-*/` 同步到 `resolveGrokWorkspaceDir()` 下 Grok skills 目录；pack 时带上 hash，未变则跳过。
- [ ] **FSK-11 P0** 瘦身 `composeAgentsInner`：去掉 acw-ctl 长列表，改为「加载 furnace-acw-ctl skill」；`.grok/rules/session.md` 与标记块二选一或只保留标记块（去重复）。
- [ ] **FSK-12 P0** `activateFurnaceRole`：`## Prompt` 改为 `## Skills`（列路径 + 一句何时用）；`prompts/*.md` 改由构建脚本从 Skill 生成或标记 deprecated。
- [ ] **FSK-13 P1** `resolveRefineFurnaceRole` / 审核步：advance、gates 里恢复角色解析（adapt 分支删除后的空缺）。
- [ ] **FSK-14 P1** `npm run test` + `scripts/selftest-furnace-skills.mjs`：`grok inspect` 能列出同步后的 skills（无 grok 时 skip）。

### 4.3 文档与兼容

- [ ] **FSK-20 P0** 更新 `docs/tech-crucible-3.2.md`（或 3.7 增补节）：熔炉定制 = Skills，AGENTS 只引导。
- [ ] **FSK-21 P1** `server/config/furnace/README.md` 改表：prompts 过渡说明 → skills 为主。
- [ ] **FSK-22 P2** 删除 `shared` 中 `ADAPT_OPTION_HOVER` 等死文案（或 6.4 标记 deprecated）。
- [ ] **REL-01 P1** 版本号 / CHANGELOG「6.4 熔炉 Skill 化」。

---

## 五、与 6.3 的衔接

| 6.3 项 | 6.4 处理 |
| --- | --- |
| RFN-SKILL-01～04 | 并入 FSK-02、FSK-05、FSK-10；**不再**建议「写进 rules 片段」作为终态 |
| RFN-SRC-03 acw-ctl 帮助与 prompt 统一 | **改为** acw-ctl help 与 `furnace-acw-ctl` SKILL 交叉引用 |
| 炼化 IO 契约 | 不变；Skill 只教操作流程，契约仍以 `guide-script.md` / `ACW-REFINE` 为准 |

---

## 六、迁移策略（降低翻车）

1. **阶段 A（6.4.0）**：Skills 同步 + AGENTS 瘦身 + ACTIVE 列 Skill；**保留** `prompts/*.md` 自动生成一段摘要进 ACTIVE（双轨可读）。
2. **阶段 B（6.4.x / 6.5）**：设置默认只显示 Skills；prompts 目录改为 `skills/_legacy` 或删除生成逻辑。
3. **回滚**：`grok.writeRules === false` 时只写 ACTIVE，不写 AGENTS（现有行为）；Skills 同步可单独开关 `furnace.syncSkills`。

---

## 七、里程碑与验收

1. 新装 / 升级后，熔炉工作区存在 `furnace-core`、`furnace-acw-ctl`、`furnace-refine-skill`（及 review）；`grok inspect`（或文档等价命令）可见。
2. 用户说「把某目录脚本加为成员」：熔炉按 **Skill** 执行 `acw-ctl`，且仓库内**只改 SKILL.md** 即可更新文案，无需改 `furnaceGrokInject.js`。
3. `AGENTS.md` 标记块不含 acw-ctl 子命令枚举（字符数显著下降）；UI 提示从「短规则在 AGENTS.md」改为「熔炉 Skills 已同步至工作区」。
4. 6.3 炼化接线：炼化相关会话自动 `FURNACE_ROLE.REFINE` + 激活 refine skill。

---

## 八、待决事项

1. Grok CLI skills 目录约定：以各平台 `grok inspect` 输出为准，必要时在 `furnaceSkillSync` 做探测分支。
2. **自定义 workspace**：用户把 `workspaceDir` 指到自家 repo 时，标记块写入**该目录** `AGENTS.md` 是否仍接受（现逻辑会 append）；Skill 同步是否要先问用户确认覆盖 `.grok/skills`。
3. **Cursor 熔炉**（`furnaceAgent=cursor`）：Skills 是 Grok 机制；Cursor CLI 侧是否镜像为 `.cursor/rules` 或仅 Grok 路径 — 6.4 默认 **仅 Grok**，Cursor 另开任务。
4. prompts 与 Skills **单写**：选手写 Skill + 生成 prompt 片段（推荐），避免双处编辑。

---

## 九、摘要答复（产品讨论用）

- **熔炉和原生 Grok 的区别**：同一 CLI，不同 cwd + 协同台写的 `ACTIVE.md` / 情境；过去还把定制手册塞进工作区 `AGENTS.md` 标记块与 `prompts/*.md`。
- **是不是改仓库根 `AGENTS.md`**：**不是**；熔炉只动工作区里的 `AGENTS.md`。
- **要不要全改成 Skills**：**建议 6.4 全改**——炼化、加成员、建群模板、审核各占一个 Skill；`agent-refine-skill` 继续服务外部 Agent，不并入 Grok 默认束。
- **好处**：一份 Markdown 进仓库、可版本化、设置页可复制、与 Grok 官方发现机制一致；`furnaceGrokInject` 只做薄注入，维护成本从「JS 字符串 + prompt 双份」降到「改 SKILL.md」。