# 实机检查清单（5.2.0 TEST-07）

各平台一份，跑通后可在 PR 或发布说明中勾选日期与版本。

## Windows 10 / 11

- [ ] 安装包或 `npm start` 启动工作台，登录令牌正常
- [ ] 开聊 → 熔炉 TUI：选中文字 `Ctrl+C` 复制且不中断进程
- [ ] 多行粘贴（含中文）：`Ctrl+Shift+V` 或 bracketed paste 完整进入
- [ ] 拖入文件到终端/熔炉：路径引用可用
- [ ] 中文 IME 组合输入后 Enter 提交一次
- [ ] 界面缩放 90% / 110% / 重置 100% 后终端与熔炉布局正常
- [ ] 文档中心顶栏入口、节点台账跳转
- [ ] 通知：窗口失焦时 gate 请求有桌面通知；顶栏铃铛有记录

## macOS（Intel 或 Apple Silicon）

- [ ] 同上启动与熔炉复制/粘贴/拖拽
- [ ] `Cmd+C` / `Cmd+Shift+V` 与 Option 拖选
- [ ] 通知权限授权后测试通知与深链回会话
- [ ] Dock 角标/托盘（若启用）与隐藏窗口后通知

## 炼化试跑验证（5.9.0 RAR-T5）

- [ ] Windows：`*.bat` 炼化后 **CRLF** 保存，`verify-member` / 成员抽屉试跑通过
- [ ] Windows：PowerShell 执行策略 `Restricted` 时，verify 失败文案可读（非空 `checks[].detail`）
- [ ] 故意破坏炼化脚本语法 → verify 失败 → 还原中心还原 → 再试跑通过
- [ ] 勾选适配成员跑一步 → 流程轨出现「适配回落」或「适配已准备」摘要

## 备注

- 未覆盖项请在对应版本 plan 中保持 `[ ]` 直至有证据。
- 自动化：`npm test`、`npm run test:web`、`node scripts/selftest-refine-adapt.mjs`、桌面冒烟见 5.1.0 TEST-01。
