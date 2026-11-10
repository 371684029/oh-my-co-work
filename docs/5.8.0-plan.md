# 5.8.0 计划：熔炉与内置 CLI 性能 II

> 承接 5.3.1 服务端防卡死之后的前端输出管线治理。5.3.2 已落地核心项；本文作台账维护。

## 一、已落地（5.3.2）

- [x] **PERF-A1** rAF 合并 `xterm.write`（`terminalWriteScheduler.js`）
- [x] **PERF-A2** `terminal.output` 不每包写 Vue `replay`；bridge 回调不带全量 replay
- [x] **PERF-A3** 大块 replay 分片 `writeReplayInChunks`
- [x] **PERF-A4** WebGL context loss 清图集 + 二次失败降级
- [x] **PERF-A5** 非活动终端暂停绘制，激活 `flushPending({ force: true })`
- [x] **PERF-B1/B2** GUI `furnaceGuiTranscript` 节流 + TUI 跳过解析
- [x] **PERF-B3** 熔炉 TUI 单 `TerminalView`
- [x] **PERF-C2** attach 回放 tail 512KB
- [x] **PERF-C3** 背压用户提示
- [x] **PERF-D2** `scripts/selftest-furnace-perf.mjs`
- [x] **PERF-E1** Electron `backgroundThrottling: false`

## 二、待续（5.8+）

- [ ] **PERF-D1** 设置页暴露 `guiTranscriptThrottleMs`（当前默认 400，仅 prefs 默认值）
- [ ] **PERF-D3** 开发态性能 HUD
- [ ] **PERF-B1+** `furnaceGuiTranscript` 真·增量 parse（仍整段 parse，仅降频）
- [ ] **PERF-C1** 输出广播仅订阅终端（复核多窗口场景）
