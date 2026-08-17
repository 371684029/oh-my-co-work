# CODE_CHANGE.md

> 文件级变更台账。每个文件的增、删、改、移动都追加一条记录。
> 随仓库提交（不在 gitignore 中）。按日期降序，最新在最上面。

---

## 格式说明

```text
YYYY-MM-DD | A/M/D/R | 文件路径 | 一句话说明（改了什么、为什么）
```

| 操作 | 含义 |
|------|------|
| A | 新增文件 |
| M | 修改已有文件 |
| D | 删除文件 |
| R | 重命名 / 移动 |

---

## 变更记录

2026-08-17 | M | packages/oh-my-co-work-v2-linux-x64.zip | 覆盖 2.3.0 运行包
2026-08-17 | M | packages/CURRENT.txt / README.md | 版本 2.3.0；linux-x64 产物元数据

2026-08-17 | M | package.json / workspaces / about.json | 版本 2.3.0 最终封板
2026-08-17 | M | README.md / AGENT.md / docs/* | 发布线与路线图改为 2.3.0 封板
2026-08-17 | M | CODE_CHANGE.md | 追加本轮封板条目

2026-08-17 | A | docs/assets/screenshots/workbench-home.webp | 工作台首页截图（含终端守护者文案）
2026-08-17 | M | README.md | 首页截图放到宗旨语录下方
2026-08-17 | M | web/src/views/Workbench.vue | 欢迎页「流动的 Workflow」后加终端守护者，去掉下方重复 CLI 徽章行
2026-08-17 | M | web/src/views/settings/Members.vue | 删除 timeoutMs 表单字段，保存时不再写入
2026-08-17 | M | web/src/views/settings/Prefs.vue | 设置页占用列表 3s 轮询 + 切回前台刷新
2026-08-17 | M | server/src/runners.js | 删除脚本超时定时器与 timeoutMs 字段
2026-08-17 | M | server/src/terminal/terminalService.js | 删除 PTY timeoutMs 定时器
2026-08-17 | M | server/src/demoRepair.js | 启动时剥离成员配置里遗留的 timeoutMs
2026-08-17 | M | shared/index.js | 删除 DEFAULT_SCRIPT_TIMEOUT_MS
2026-08-17 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-17 | M | server/src/engine.js | 流程走完不再弹归档确认、不自动归档、不杀常驻进程；旧归档尾节点静默跳过
2026-08-17 | A | server/src/resources.js | 列出占用会话并释放选中/全部进程与终端
2026-08-17 | M | server/src/routes.js | GET /resources、POST /resources/release
2026-08-17 | M | server/src/runners.js | timeoutMs 默认 0（不超时）；>0 才挂定时器
2026-08-17 | M | web/src/views/settings/Prefs.vue | 归档小时数改为释放资源选择框
2026-08-17 | M | web/src/views/Workbench.vue | 去掉对话/流程轨/顶栏的归档确认与操作
2026-08-17 | M | web/src/views/settings/Members.vue | 超时挪到高级且默认 0
2026-08-17 | A | server/test/archiveSkip.test.js | 覆盖不自动归档与资源列表
2026-08-17 | M | package.json / workspaces / about.json | 版本 2.2.2
2026-08-17 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-17 | M | server/src/runners.js | 新增 usesKeepAlive：内嵌终端默认常驻，显式 waitForExit:true / detach:false 才等待退出
2026-08-17 | M | web/src/views/settings/Members.vue | 终端模式也显示「进程常驻」且默认开；运行时 Windows 默认 cmd、其它系统 auto
2026-08-17 | M | server/src/engine.js | 脚本步开始只杀非 detach 进程，避免掐掉上一常驻 TUI
2026-08-17 | M | server/src/localAccess.js | bootstrap 必须带可信 Origin 才发令牌
2026-08-17 | M | server/src/routes.js | kill-processes 默认不再 includeDetach
2026-08-17 | M | server/src/processRegistry.js | 释放资源 HTA 显式 includeDetach:true
2026-08-17 | M | server/test/*.test.js | 覆盖 bootstrap Origin、keepAlive、usesKeepAlive、runtime=cmd
2026-08-17 | M | package.json / workspaces / about.json | 版本 2.2.1
2026-08-17 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-17 | M | web/src/views/Workbench.vue | 移除右栏「资源」Tab 及 loadResources/openResourcesTab/rekillSessionProcesses/openHolderSession/archiveHolderSession、sessionResources 状态与 resources-* CSS（清死代码，不留无入口逻辑）
2026-08-17 | M | web/src/api.js | 移除 sessions.resources 与已无调用方的 sessions.killProcesses
2026-08-17 | M | server/src/routes.js | 移除 GET /sessions/:id/resources 路由与 getSessionResources 导入
2026-08-17 | M | server/src/services.js | 移除 getSessionResources；随之去掉失效的 pathLock 与 listSessionProcesses 导入
2026-08-17 | M | README.md | 去掉「本机资源」能力条目与三栏描述里的「资源」；版本徽章 2.0.1→2.2.0；路线图勾选 2.2 并把 Adapter 拆成独立未完成项
2026-08-17 | M | docs/frontend-components.md | 去掉「本机资源」视觉约定条目
2026-08-17 | M | docs/mvp.md | 资源面板标记为「移除」；状态/更新日期改 2.2.0；新增 §2.22 封板小节与版本流水线一行
2026-08-17 | M | docs/README.md | 索引发布线改 2.2.0（§2.19～§2.22）；修订表补 2.2.0 一行
2026-08-17 | M | docs/data-and-ops.md | 修订记录补 2.2.0 最终封板一行
2026-08-17 | M | docs/tui-2x-plan.md | 状态改 2.2.0 最终封板，注明 2.1 与 Adapter 仍待办
2026-08-17 | M | docs/tui-2x.md | 状态改 2.2.0 最终封板
2026-08-17 | M | AGENT.md | 版本现状改 2.2.0，补常驻终端行为
2026-08-17 | M | package.json / web / server / shared package.json | 版本 2.0.1 → 2.2.0
2026-08-17 | M | package-lock.json | 同步 workspace 版本 2.2.0（不动第三方依赖版本）
2026-08-17 | M | server/config/about.json | version 2.2.0；changelog 置顶 2.2.0 封板条目
2026-08-17 | M | CODE_CHANGE.md | 追加本轮封板条目

2026-08-14 | M | docs/author-contact.example.json | 清掉示例中的真实手机号和微信号（phone/wechat 置空），作为干净模板
2026-08-14 | M | docs/technical-design.md | 移除 3 处真实手机号 17312678391（表格默认值、JSON 示例、待决表），统一改为「自行配置」占位
2026-08-14 | M | web/src/views/Workbench.vue | 欢迎页加「内置 CLI 终端 · 终端守护者 · 进程常驻 · 崩溃可恢复」卖点行，配绿色 CLI 等宽字体徽章
2026-08-14 | M | web/src/views/Workbench.vue | 会话列表右侧加相对时间展示（刚刚 / NNh / NN d / NNw，最小 h，最大周）；已归档会话不显示；文字右对齐，等宽数字，低调灰色
2026-08-14 | M | web/src/components/terminal/TerminalView.vue | 进程结束后禁用终端输入：onData 不向外 emit、光标隐藏、底部渐变遮罩显示「⏻ 进程已结束，无法继续输入」提示，用户按 Ctrl+C 等不再困惑
2026-08-14 | M | web/src/components/terminal/TerminalWorkspace.vue | 底部 hint 动态化：运行中显示原提示，结束后改为「进程已结束，键盘输入不再生效」
2026-08-14 | M | web/src/views/Workbench.vue | 全面精简待确认布局：移除所有模式的顶部红色大卡片，说明文字统一写入输入框 placeholder；「同意」左侧加低调的「i」信息标识（小圆点 + tooltip），hover 才显示完整详情
2026-08-14 | M | web/src/views/settings/Members.vue | 完成 UI 四大优化：「高级」由折叠改为 Tab 标签（基础/高级分 tab，解决选项被折叠忽略的问题）；脚本工作目录新建时默认预填软件安装目录；运行时/解释器统一默认 cmd；删除「类型」下拉框（用户 99% 用 script，不再显示选择，后端保留 echo 兼容）
2026-08-14 | M | start.bat | 修复双击启动即报错：换行由纯 LF 改为 CRLF（cmd.exe 解析不了 LF-only 批处理，把 if errorlevel 1 撕成 rlevel），并改为纯 ASCII（避免 chcp 65001 下 cmd 按字节偏移 seek 把中文 echo 行从中间截断）
2026-08-14 | M | start.mjs | 承接原先写在 start.bat 里的两条中文启动提示（Node 输出 UTF-8，不受批处理字节偏移问题影响）
2026-08-14 | A | .gitattributes | 固定换行风格，防止 .bat/.cmd 再退回 LF（同时约束 *.sh 为 LF）
2026-08-14 | A | server/src/demoRepair.js | 抽出老库幂等修复：早期演示成员留了保活 shell 却无 waitForExit 声明，启动时补 waitForExit:false（四重前置条件，绝不触碰用户自建配置）
2026-08-14 | A | server/test/demoRepair.test.js | 覆盖 demoRepair 的 4 个用例：修复保活成员、重复执行幂等、不动非演示/正常退出/用户已显式配置的成员、识别 Linux 的 exec bash 写法
2026-08-14 | M | server/src/terminal/terminalService.js | 新增 keepAlive 选项：常驻交互终端在 PTY 启动成功后立即 resolve(ok:true) 并跳过超时定时器，注册进程时标记 detach，修复交互式 shell 必然撞 timeoutMs 判超时的阻塞回归
2026-08-14 | M | server/src/runners.js | 终端模式把 detach/waitForExit 语义透传为 runTerminal 的 keepAlive，与弹窗模式保持一致
2026-08-14 | M | server/src/index.js | 演示成员「示例命令」显式声明 waitForExit:false，让保活终端不再被判执行超时；启动时调用 repairDemoKeepAliveMembers() 修复已有旧库
2026-08-14 | M | server/src/seed.js | 同步演示成员 waitForExit:false
2026-08-14 | M | web/src/components/terminal/TerminalSessionCard.vue | 无输出时预览收成一行提示（不再撑出 260px 纯黑）；预览行数提取为 PREVIEW_LINES 常量；移除 elapsedText 里重复输出 cwd 的兜底；时长为空时不显示悬空分隔符
2026-08-14 | M | web/src/views/Workbench.vue | 收窄 is-wide 作用范围：仅消息列放宽，输入区恢复原阅读宽度，避免整屏排版跳动
2026-08-14 | M | docs/script-guide.md | 补充「常驻可交互终端 waitForExit:false」章节与默认/保活行为对照表
2026-08-14 | M | docs/tui-2x.md | 预览规格与实现对齐（40 行 + clamp 高度 + 空输出收起），并说明放大理由
2026-08-14 | M | docs/demo.md | 修正第 6 步：示例命令会留下可交互终端且节点照常推进
2026-08-14 | M | AGENT.md | 订正 §8：CODE_CHANGE.md 随仓库提交，不再声明 gitignored
2026-08-14 | M | CODE_CHANGE.md | 订正文件头过期的 gitignore 说明；补齐本轮条目并按日期降序置顶
2026-08-14 | A | .scratch/review-changeset.md | code review 用变更清单（无 .git，无法出 diff）
2026-08-14 | A | .scratch/selftest-terminal-changes.mjs | 终端改动行为自测（含 F5 保活/推进回归与默认模式成败判定）
2026-08-14 | A | .scratch/selftest-terminal-parity.mjs | 用本机可用 shell 复跑 3 个 bash 用例，证明其失败源于环境缺 bash
2026-08-14 | A | .scratch/e2e-keepalive.mjs | 端到端自测：真服务下建会话、自动过闸门，断言示例命令节点判成功且终端仍存活可输入
2026-08-14 | A | .scratch/e2e-finish.mjs | 端到端自测续跑：把会话审核/归档闸门走完，确认常驻终端不阻塞流程收尾且进程被回收
2026-08-14 | A | .scratch/battest-real.mjs | start.bat 静态自测：断言纯 ASCII、CRLF、无拆行报错且能走到启动服务那一步

2026-08-13 | M | CODE_CHANGE.md | 明确机制：用本文件模拟 git 改动/提交记录，后续所有文件变更均按此追加
2026-08-13 | M | .gitignore | 移除 AGENT.md 和 CODE_CHANGE.md 的忽略规则
2026-08-13 | M | start.mjs | ensureInstall 增加 node_modules/.bin 存在性检查，防止缺少 binaries 时跳过安装
2026-08-13 | M | server/src/index.js | 演示脚本改为交互式 shell（`cmd.exe /k` / `exec bash`），使内嵌终端在演示后仍可接收输入
2026-08-13 | M | server/src/seed.js | 对齐演示数据：增加 scriptWorkDir/scriptDir，移除错误 shell:'cmd'，命令改为交互式 shell
2026-08-13 | M | web/src/components/terminal/TerminalSessionCard.vue | 终端卡片新增 cwd 显示行，解决“没有目录”问题
2026-08-13 | M | web/src/components/terminal/TerminalSessionCard.vue | 未全屏终端卡片默认放大：宽度 680→920px、预览高度 86/136→230/380px、字号 11.5→12.5px、预览行数 7→18
2026-08-13 | M | server/src/index.js | 修复演示命令双重包裹：`cmd.exe /k "..."` 改为 `echo ECW-OK #1 & cmd`，避免被 `cmd /d /s /c` 再包一层导致引号失效
2026-08-13 | M | server/src/seed.js | 同步演示命令写法为 `echo ECW-OK #1 & cmd`
2026-08-13 | M | web/src/components/terminal/TerminalSessionCard.vue | 空间利用最大化：卡片宽度 1080px、预览高度 clamp(260px,46vh,620px) 且内容贴底、cwd 合并进底栏、头尾内边距压缩、预览行数 18→40
2026-08-13 | M | web/src/views/Workbench.vue | 会话内存在内嵌终端时对话列切换为宽舞台（is-wide），终端气泡撑满可用宽度
2026-08-13 | M | web/src/styles.css | 新增 --ecw-stage-max-wide (1180px) 宽舞台变量
2026-08-13 | M | web/src/components/terminal/TerminalWorkspace.vue | 压缩外边距与头尾高度，给终端画面让出更多空间
2026-08-13 | M | web/src/components/terminal/TerminalView.vue | 减小 xterm 容器内边距，扩大可见行列
