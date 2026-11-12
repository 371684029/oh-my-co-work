# 5.9.0 计划：炼化 · 适配 · 还原质量闭环

> **版本说明**：仓库内 [plan-5.4.0.md](./plan-5.4.0.md) 已承载「完整系统通知」主线。本产品诉求（炼化正确率、还原有效性、是否适配可验证）独立成 **5.9.0**，避免与 NTF-* 里程碑混淆；若对外发布需合并小版本号，可在 CHANGELOG 中写明「5.9.0 炼化质量」与「5.4.0 通知」并列。
>
> **定位**：5.2.0 补齐了还原 API、manifest、往返单测；5.3.0 统一了还原中心壳子。仍缺的是 **改完源文件之后没人替你跑一遍**——炼化契约插对了但脚本跑不通、适配打了 JSONL 标记但事件没来、熔炉手改代码没有探针与 review 闸门。本版把「备份 + 改盘」升级为 **可验证的闭环**。
>
> **约束**：本机优先；验证探针在隔离 cwd / 临时数据根执行；不引入远程 LLM review；熔炉真改码仍走既有 zip 备份与还原中心。
>
> 标注：**P0** 本版核心；**P1** 重要；**P2** 有空再做。状态 `[ ]` / `[x]` 维护。

---

## 一、现状（读代码确认）

### 1.1 炼化（refine）

| 环节 | 实现 | 缺口 |
| --- | --- | --- |
| 保存时改源 | `refineSource.applyRefineOnMemberSave`：zip → 插入 `ACW-REFINE` → `config.refine.format` | 规格多为 `defaultRefineSpecAuthor` 确定性兜底，非熔炉 REFINE 角色推理（4.x 开放问题仍有效） |
| 保存前预览 | `planRefineOnMemberSave` + `POST /members/refine/plan` | 前端有确认框；**diff 全量视图、保存后探针结果**仍弱（5.2 REF-03 遗留） |
| 跑完进文档 | `advance.js` + `refineOutputForNode` | 依赖 stdout 带 `### 标题`；源脚本语法错时节点失败，**与「炼化保存」未关联回滚提示** |
| 还原 | `refine/restore`、剥离契约、`restoreAdaptManifest` | 炼化链较完整；单测 `refineRoundtrip`、`refineBackupManifest` |
| 熔炉改码 | `acw-ctl backup-source` + 文档中心 diff | **无自动 verify**；靠人看 diff |

### 1.2 还原（restore）

| 来源 | 入口 | 缺口 |
| --- | --- | --- |
| 炼化 zip | 设置成员 / 还原中心 / `POST .../refine/restore` | 冲突 409 + `force` 已有 |
| 适配备份 | `data/backups/adapt` + `prepareAdaptForMember` 写盘 | **还原中心以炼化成员列表为主**；适配 manifest 一键还原 API/UI 不统一（5.3 TRC-02「适配备份列表待补」） |
| 步骤快照 | TRC-01/02 git / step-revert | 与炼化 zip 并列，用户需理解三种来源；本版只做 **炼化/适配 manifest 对齐** |

### 1.3 是否适配（adapt）

| 环节 | 实现 | 缺口 |
| --- | --- | --- |
| 触发 | `member.config.adapt` / `step.adapt`；`advance` 前 `prepareAdaptForMember` | 执行前才改盘；成员保存时 **无 plan/verify**（炼化有 plan，适配没有对称 API） |
| 成功路径 | 注释标记 + `overlayJsonlMember` | **未探测** `.acw-adapter.events.jsonl` 是否生成、jsonl 行是否可解析 |
| 回落 | `fallback: true` + 步骤标记 | 用户只看到系统文案，**无结构化「为何回落」供设置页/时间线** |
| 熔炉手改 | `member-adapt` / `node-adapt` prompt | 依赖 Grok；改完后 **无 selftest / dry-run 钩子** |

### 1.4 已有测试资产

- 单测：`refine*.test.js`、`adaptBackup.test.js`、`acwCtl.test.js`（backup → restore-center diff → restore）
- E2E：`ci-e2e-smoke.mjs` 还原中心区块 + 炼化成员行
- 无：`scripts/selftest-refine-adapt.mjs` 级黄金路径；无多扩展名炼化矩阵 fixture

**结论**：**「能改、能还」有了；「改对了、接上了」缺少统一 verify 层与适配还原对称性。**

---

## 二、产品目标

1. **炼化正确率**：保存炼化或熔炉写入契约后，在 N 秒内给出 **通过 / 失败 + 可读原因**（语法、退出码、stdout 缺标题、环境变量未生效）。
2. **还原有效性**：任一炼化/适配备份的 manifest，在 verify 失败或用户点还原后，**字节级与 zip 一致**；冲突策略与现 409 一致。
3. **是否适配可观测**：适配准备完成后，可选 **一次探针运行**（pipe 或短超时 terminal），判定 JSONL 侧通道是否活着；回落原因入库并在成员详情展示。
4. **改码后 review**：熔炉/acw-ctl 改源前后，文档中心 diff + **可选人工闸门**「验证通过后再 stamp manifest」——默认自动 verify 通过即 stamp，失败则不 stamp 并提示还原。

---

## 三、能力清单

### 3.1 统一验证内核（server）

- [x] **RAR-01 P0 `memberVerify.js`（新）**：纯函数 + 可注入 `spawn`/`runMemberOnce`
  - 输入：`member`、探测用 `humanInput` / `param1`、选项 `{ timeoutMs, channel: 'pipe'|'terminal' }`
  - 炼化断言：`exitCode === 0`（或可配置）、stdout 含 `### ${format.output.heading}`、可选 stderr 为空
  - 适配断言：`config.script.adapter` 为 jsonl 时检查事件文件首行 `JSON.parse` 成功或 runner 收到 adapter 事件
  - 输出：`{ ok, checks: [{ id, ok, detail }], elapsedMs, probeLogPath? }`
- [x] **RAR-02 P0 API**
  - `POST /api/members/:id/verify` — 手动探针（设置页「试跑验证」）
  - `POST /api/members/refine/plan` 响应扩展 optional `verifyPreview`（仅模拟，不落盘）
  - 炼化 `persistRefineOnSave` 成功后 **同步** 调 RAR-01；失败：`verifyFailed` + `verifyLast`；**不撤销已写契约**；UI 强提示
- [x] **RAR-03 P1 适配对称 plan API**：`POST /api/members/adapt/plan` — 将改哪些文件、是否 jsonl 覆盖、预估回落，与 `planRefineOnMemberSave` 同结构
- [x] **RAR-04 P1 适配还原 API**：`POST /api/members/:id/adapt/restore` — 复用 `restoreAdaptManifest`，manifest 来自 `config.adapt` 或历史列表（与炼化 REST 同形）
- [x] **RAR-05 P1 还原中心**：`GET /api/restore-center` 增加 **适配备份分区**（manifest 列表 + diff），与炼化同一 UX（5.3 TRC-02 收口）
- [x] **RAR-06 P2 熔炉改码闸门**：`appSettings.furnace.requireVerifyBeforeStamp` — patch 后 `stampManifestAfterPatch` 前须 verify 通过（默认 false）

### 3.2 前端（web）

- [x] **RAR-07 P0 成员抽屉**：保存 toast +「试跑验证」按钮 + verifyLast 提示
- [x] **RAR-08 P1 适配**：勾选「是否适配」时展示 plan 摘要（成员抽屉 live `adaptPlan`）；节点跑完后流程轨摘要 + 工作台 toast（`sessionAdaptToast`）
- [x] **RAR-09 P1 还原中心**：`RestoreCenter` + `DocsRefineChangesPane` 炼化/适配共用 diff（5.3.7 M2）
- [x] **RAR-10 P2 文档中心「节点炼化与还原」**：`verifyLast` 摘要 +「运行验证记录」跳转时间线 `verify` 筛选

### 3.3 熔炉 / demo / review

- [x] **RAR-11 P1 演示流**：在 [guide-demo.md](./guide-demo.md) §7 增加炼化路径；种子 **炼化验证演示** + 内置模板 `refine-verify`
- [x] **RAR-12 P1 acw-ctl**：子命令 `verify-member --member <名>` 调 RAR-02，退出码与 JSON 与 API 一致（`acwCtl.test.js` 覆盖）
- [x] **RAR-13 P2 REFINE 角色**：保存炼化 patch 后 `status: pending`，**verify 通过** 才 `status: done`（熔炉真角色仍待 4.x）

### 3.4 测试与 CI

- [x] **RAR-T1 P0 单测**：`memberVerify.test.js`（`.mjs` + `.sh` 探针矩阵；Windows `.bat` 见 spec-qa-checklist）
- [x] **RAR-T2 P0 集成**：炼化 `memberVerifyRoundtrip.test.js`（save→verify→破坏→restore 字节一致）；适配 prepare→restore 见 `adaptPlan.test.js`（jsonl verify 仍待 RAR-06）
- [x] **RAR-T3 P1 脚本**：`scripts/selftest-refine-adapt.mjs` — 隔离 `ACW_DATA_ROOT`，跑 RAR-T2 场景 + 打印摘要（纳入 [spec-selftest.md](./spec-selftest.md) 索引）
- [x] **RAR-T4 P1 CI**：`ci-e2e-smoke` 断言炼化脚本成员抽屉「试跑验证」；CI 跑 `selftest-refine-adapt.mjs`
- [x] **RAR-T5 P2 实机**：`spec-qa-checklist.md` 炼化试跑验证小节（手工勾选）

---

## 四、技术方案要点

1. **复用执行体**：验证必须走 `runners` / 现有 pipe 路径，不 duplicate shell 拼接；超时与 `FLW-01` step timeout 共用上限常量（如 30s 探针）。
2. **与备份原子性**：保持 5.2 REF-02 顺序——先 zip，再 patch，再 verify；verify 失败 **不自动 restore**（用户可能只需改一行），但 `prep.verifyFailed: true` 驱动 UI。
3. **适配 jsonl 探测**：无真实 CLI 时，用 **fixture 脚本** `node -e "console.log(JSON.stringify({type:'ping'}))"` 成员做 CI 黄金样本；真实成员在 verify 阶段创建临时 `ACW_ADAPTER_EVENTS` 路径并 `fs.watch` 一轮或 runner 回调。
4. **性能**：成员 verify 默认 `pipe` + 短输入；terminal 模式仅当 `executionMode === 'terminal'` 且 pipe 探针失败时降级（P2）。
5. **安全**：探针 cwd 限制在 `scriptWorkDir`；命令注入靠现有成员校验；verify 日志脱敏复用 `redact`。

---

## 五、里程碑

| 阶段 | 内容 | 产出 |
| --- | --- | --- |
| M1 | RAR-01、RAR-02、RAR-07、RAR-T1、RAR-T2（炼化） | 炼化保存后自动 verify + 手动试跑；单测矩阵 |
| M2 | RAR-03、RAR-04、RAR-05、RAR-09、RAR-T2（适配） | 适配 plan/restore 对称；还原中心双分区 |
| M3 | RAR-11、RAR-12、RAR-T3、guide-demo | 演示流 + selftest + acw-ctl |
| M4 | RAR-06、RAR-13、RAR-T4/T5 | 熔炉 stamp 闸门、REFINE 真角色、CI/实机 |

---

## 六、验收（DoD）

1. 勾选炼化并保存后，**10 秒内**在成员详情看到 verify 结果；故意破坏脚本语法时结果为失败且可一键还原。
2. 适配准备改源后，verify 能区分 **jsonl 就绪** vs **回落仅标记**。
3. 还原中心可同时列出炼化与适配 manifest，diff + restore 与 `acwCtl.test.js` 场景等价。
4. `npm test` 新增用例全绿；`node scripts/selftest-refine-adapt.mjs` 在干净环境一次通过。
5. 文档：`guide-script.md` 炼化契约节增加「验证」说明；成员 `config.refine.verifyLast` / `verifyFailed` 落库（见 `persistRefineOnSave`）。
6. 工作台闸门（随 5.9.0 合入）：**通过 + 下一步**；开聊默认 `#a`；群/步 `paramBindSlots` 覆盖绑定。

---

## 七、风险与取舍

| 风险 | 对策 |
| --- | --- |
| verify 在 Windows 上慢或杀软拦截 spawn | 超时 + 跳过 terminal 探针；文案说明 |
| 炼化契约与成员真实业务逻辑冲突（echo 标题破坏输出） | plan 阶段 snippet 高亮；文档强调「契约块在 preamble 后」 |
| 适配 jsonl 依赖外部二进制 CLI | verify 只测「侧通道文件 + 首事件」，不要求 CLI 登录 |
| 与 5.4 通知重复 | verify 失败可选 `NTF-02` 映射为「出错了」（P2，不阻塞 M1） |

---

## 八、与历史计划的关系

| 来源 | 关系 |
| --- | --- |
| 5.2 REF-01～08 | 本版 **不重复做还原原子性**；在 REF-03 diff 视图上叠 verify |
| 5.3 TRC-02 | RAR-05 收口「适配备份列表待补」 |
| plan-refine-search-4x §8 | RAR-13 对接「炼化异步/熔炉产出 format」 |
| 5.4 NTF-* | 无硬依赖；失败通知为增强项 |

> 每项落地时：同步更新本文状态、`CODE_CHANGE.md`；版本发布后在 README 路线图登记 5.9.0。
