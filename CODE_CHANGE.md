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

2026-08-26 | M | FurnaceSprite.vue | 按图集人物区裁掉单帧左右透明留白，放大右栏精灵且收起态保留全身
2026-08-26 | M | frontend-components.md | 补充桌宠图集必须按人物可见区展示的样式约定
2026-08-26 | M | CODE_CHANGE.md | 追加熔炉精灵可见尺寸修复条目

2026-08-26 | M | packages/oh-my-co-work-v3-linux-x64.zip / packages 清单 | 从主线重打含 BUILD_INFO 与新版熔炉图集的 Linux 3.7.0 生产包
2026-08-26 | M | appSettings.js / furnace.test.js / furnaceLifecycle.test.js | 测试使用隔离设置文件，避免测试污染仓库配置
2026-08-26 | M | .github/workflows/pack-release.yml | 三平台包推送失败即终止，latest 发布前强制校验同源与新熔炉图集
2026-08-26 | M | scripts/pack-release.mjs / package.json | 运行包写 BUILD_INFO 与旁证元数据，并提供生产包校验命令
2026-08-26 | A | scripts/validate-release-packages.mjs | 校验三平台版本、源码提交、旁证及桌宠资源一致性
2026-08-26 | A | server/test/releasePackages.test.js | 覆盖新图集、旧资源拒绝和三平台同源规则
2026-08-26 | M | README.md / packages/README.md / docs/RELEASE-USER.md | 同步生产包一致性门禁与 BUILD_INFO 排障说明
2026-08-26 | M | CODE_CHANGE.md | 追加生产包一致性修复条目
2026-08-26 | M | FurnaceAvatar.vue | 头像 title 附带 chatgpt-pets 版权短声明
2026-08-26 | M | FurnaceSprite.vue / FurnaceWorkspace.vue | 桌宠立绘旁展示 chatgpt-pets MIT 版权短声明
2026-08-26 | M | About.vue / about.json | 关于页写明立绘从 chatgpt-pets git 复制
2026-08-26 | M | furnacePetAtlas.js / furnacePetAtlas.test.js | 版权常量与来源仓库
2026-08-26 | M | pets/NOTICE.md / README.md / brand-logo.md / furnace-pet-frames README | 同步版权声明
2026-08-26 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-25 | M | docs/assets/screenshots/chat-terminal-collaboration.webp | README「对话闸门同屏」截图换成李慕婉
2026-08-25 | M | docs/assets/screenshots/terminal-member-settings.webp | README「成员 TUI 设置」截图换成李慕婉
2026-08-25 | M | README.md | 两张 2.0 截图 alt 同步新桌宠
2026-08-25 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-25 | M | docs/assets/screenshots/workbench-home.webp | README 首页截图换成李慕婉桌宠
2026-08-25 | M | docs/assets/screenshots/workbench-overview.webp | README 工作台截图换成李慕婉桌宠
2026-08-25 | M | docs/assets/screenshots/furnace-grok-guide.webp | README 教程弹层截图带新桌宠
2026-08-25 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-25 | M | packages/linux zip | 覆盖 chatgpt-pets 李慕婉图集的 3.7.0 Linux 运行包
2026-08-25 | M | README.md | 运行包说明与 3.7 口径改为 chatgpt-pets 李慕婉图集，不再写慢循环 GIF
2026-08-25 | M | about.json / docs/README.md / crucible-3.7.md | 同步桌宠图集文案
2026-08-25 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-25 | A | web/src/assets/pets/li-muwan/* | 接入 chatgpt-pets 李慕婉 v2 图集
2026-08-25 | A | web/src/assets/pets/NOTICE.md / LICENSE | 标明 MIT 来源
2026-08-25 | A | web/src/composables/furnacePetAtlas.js | v2 图集行/帧/注视方向
2026-08-25 | M | FurnaceSprite.vue / FurnaceAvatar.vue | 用图集播 idle/running/waiting，戳一下挥手，悬停注视
2026-08-25 | D | web/src/assets/furnace-*.gif / furnace-*.png | 旧两帧 GIF 立绘不再使用
2026-08-25 | M | docs/assets/furnace-pet.gif | README 预览改为李慕婉 idle
2026-08-25 | A | server/test/furnacePetAtlas.test.js | 三态映射与注视角
2026-08-25 | M | README / AGENT / frontend-components / crucible-3x / crucible-3.7 / mvp / pet-frames README | 同步桌宠口径
2026-08-25 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-25 | M | Workbench.vue | 快捷说明改成圆形 i：热区只包图标，审核态不并排两个 i，悬停/点按/聚焦可看

2026-08-21 | M | packages/linux + win32 + darwin zip | 覆盖审查修复：真删除、关闭/新开熔炉、绑对节点
2026-08-21 | M | README.md | 会话治理写明顶栏删除会从列表拿掉并清终端行
2026-08-21 | M | furnaceLifecycle.js | 新开熔炉必须绑熔炉节点；关闭只杀该成员还在跑的 PTY
2026-08-21 | M | services.js | 删会话时清 terminal_sessions
2026-08-21 | M | FurnaceWorkspace.vue | 新开/关闭收到「进程」菜单
2026-08-21 | M | Workbench.vue | 运行中新开要确认；桌宠开炉不再连弹两条
2026-08-21 | M | FurnaceSprite.vue | 戳一下只播 GIF，去掉位移动画
2026-08-21 | M | compose.py | 合成 GIF 不再覆盖分镜源 PNG
2026-08-21 | M | furnaceLifecycle.test.js / memberReuse.test.js | 绑节点、无熔炉节点拒绝、清终端行
2026-08-21 | M | README / frontend-components / crucible-grok-client / pet-frames README | 同步进程菜单与确认
2026-08-21 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-21 | A | server/src/furnaceLifecycle.js | 关闭熔炉 / 新开熔炉：杀 Grok 进程才能清对话上下文
2026-08-21 | M | server/src/routes.js | POST sessions/:id/furnace/close 与 reopen
2026-08-21 | M | web/src/api.js | closeFurnace / reopenFurnace
2026-08-21 | M | FurnaceWorkspace.vue / Workbench.vue | 顶栏新开熔炉、关闭熔炉；返回群聊仍只关皮
2026-08-21 | A | server/test/furnaceLifecycle.test.js | 无进程关闭不报错
2026-08-21 | M | crucible-grok-client.md / README / frontend-components / CODE_CHANGE.md | 写清关皮 vs 关进程
2026-08-21 | M | README.md | 首页注明桌宠两帧慢循环；运行包需重新解压才看得到
2026-08-21 | M | packages/linux + win32 + darwin zip | 覆盖两帧慢循环桌宠运行包
2026-08-21 | M | compose.py + furnace-*.gif/png | 桌宠每套两帧、1 秒一拍、多停少动；去掉眨眼和大挥手
2026-08-21 | M | FurnaceSprite.vue | 戳一下不再弹跳放大，动画更长
2026-08-21 | M | README / crucible-3x / crucible-3.7 / mvp / frontend-components / pet-frames README | 同步两帧慢循环口径
2026-08-21 | M | web/src/views/Workbench.vue | 顶栏删除忽略 MouseEvent，只删当前会话 id，成功后清中间栏
2026-08-21 | M | web/src/api.js | DELETE 会话路径 encodeURIComponent
2026-08-21 | M | server/src/services.js | 会话不存在不假装删成功；空单聊临时群一并清掉
2026-08-21 | M | server/src/routes.js | DELETE /sessions/:id 不存在返回 404
2026-08-21 | M | server/test/memberReuse.test.js | 覆盖删除后不再复用旧会话
2026-08-21 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-21 | M | packages/linux + win32 + darwin zip | 覆盖失败态 GUI 说明卡运行包
2026-08-21 | M | FurnaceWorkspace.vue | 启动失败切回 GUI 说明卡，不再留空黑屏
2026-08-21 | M | terminalService.js | spawn 失败写入 replay 和 lastError
2026-08-21 | M | terminalService.test.js | 缺命令启动失败
2026-08-21 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-21 | M | packages/linux + win32 + darwin zip | 覆盖日常慢动作桌宠运行包
2026-08-21 | M | furnace-*.gif/png + pet-frames | 桌宠改回日常慢动作：招手、看书、点头
2026-08-21 | D | idle-04 / work-04 / wait-04 | 少分镜，避免动作过多过快
2026-08-21 | M | FurnaceSprite.vue | 放慢戳一下；气泡更日常
2026-08-21 | M | README / crucible-3x / frontend-components / CODE_CHANGE.md | 同步慢循环口径

2026-08-20 | M | packages/linux + win32 + darwin zip | 覆盖 3.7.0 三平台运行包（循环桌宠 + GUI 短合同）
2026-08-20 | M | README / AGENT / crucible-3.7 / mvp | 同步桌宠 GIF、欢迎卡与短合同开炉
2026-08-20 | A | docs/assets/furnace-pet-frames/* | 桌宠分镜 PNG + compose.py，全部进 git
2026-08-20 | A | web/src/assets/furnace-poke.gif | 戳一下短循环
2026-08-20 | M | furnace-idle/working/waiting.gif+png / furnace-pet.gif | 更生动的循环立绘
2026-08-20 | M | FurnaceSprite.vue | 戳一下切 poke GIF；立绘稍大不透明
2026-08-20 | M | README / frontend-components / crucible-3x / CODE_CHANGE.md | 同步桌宠口径

2026-08-20 | M | shared/ptyPlain.js / index.js | 备用屏；GUI 只取当前屏；furnaceGuiReadable
2026-08-20 | M | furnaceGrokInject.js / furnaceSituation / runners | grok 用 argv --prompt，开炉 120×40
2026-08-20 | M | TerminalView / FurnaceWorkspace / Workbench | 隐藏 TUI 不缩 PTY；欢迎卡看正文；发送只用 \\r
2026-08-20 | M | App.vue | 开炉 prepare 不带可能过期的 sessionId
2026-08-20 | M | ptyPlain.test.js / furnaceGrokInject.test.js | last-screen、备用屏、argv spawn
2026-08-20 | M | CODE_CHANGE.md | 追加乱码修复条目

2026-08-20 | A | server/src/furnaceGrokInject.js | 短 AGENTS 标记块 + 短 --prompt，禁止写 ~/.grok
2026-08-20 | A | server/test/furnaceGrokInject.test.js | 启动词长度与紧凑注入
2026-08-20 | M | furnaceSituation / runners / slashCommands / engine / routes / appSettings | 开炉注入并拼 --prompt
2026-08-20 | M | FurnaceWorkspace.vue | GUI 欢迎卡、短指令、去等宽折行、滚动贴底
2026-08-20 | M | App.vue / Workbench.vue / api.js | 开炉前 prepare
2026-08-20 | M | shared/ptyPlain.js | 再滤一层 TUI 壳
2026-08-20 | M | docs/crucible-grok-client.md / CODE_CHANGE.md | 短合同口径

2026-08-20 | M | packages/win32 + linux zip | 覆盖 GUI 可读正文运行包
2026-08-20 | A | docs/crucible-gui-plain.md | GUI 可读正文方案：去壳、不抄 TUI 框
2026-08-20 | M | shared/ptyPlain.js / FurnaceWorkspace.vue / ptyPlain.test.js | furnaceGuiTranscript 去框线底栏
2026-08-20 | M | README / docs/README / crucible-3x / grok-client | 链到 GUI 正文方案
2026-08-20 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-20 | M | packages/win32 + linux zip | 覆盖只留 GUI 大头像的运行包
2026-08-20 | M | FurnaceWorkspace.vue / App.vue / furnaceUi.js | 干活面只留 GUI 大头像，打开时藏桌宠
2026-08-20 | M | README / crucible-3.5.md / crucible-3.7.md / frontend-components.md | 同步头像口径
2026-08-20 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-20 | M | packages/oh-my-co-work-v3-win32-x64.zip / linux-x64.zip | 覆盖含 GUI 屏幕还原的 3.7.0 运行包
2026-08-20 | A | shared/ptyPlain.js | GUI 按 VT 屏幕还原 PTY，避免去色硬拼乱码
2026-08-20 | M | FurnaceWorkspace.vue / ptyPlain.test.js / crucible-3.5.md / crucible-grok-client.md | 干活面 GUI 改用屏幕文本
2026-08-20 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-20 | M | scripts/pack-release.mjs | 运行包说明改为 README.txt，避免 Windows 中文文件名乱码
2026-08-20 | M | packages/oh-my-co-work-v3-win32-x64.zip / linux-x64.zip | 去掉乱码「使用说明.txt」
2026-08-20 | M | packages/README.md / CURRENT.txt | 同步包体积
2026-08-20 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-20 | M | packages/oh-my-co-work-v3-win32-x64.zip | 覆盖 3.7.0 Windows 运行包（含桌宠 GIF）
2026-08-20 | M | packages/oh-my-co-work-v3-linux-x64.zip | 同步 3.7.0 Linux 运行包（含桌宠裁切修复）
2026-08-20 | M | packages/README.md / CURRENT.txt | 同步 win/linux 包体积
2026-08-20 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-20 | M | FurnaceSprite.vue / FurnaceAvatar.vue | 桌宠不再切头顶；闲置不透明，收起看全身
2026-08-20 | M | frontend-components.md / crucible-3x.md / mvp.md | 同步桌宠展示口径
2026-08-20 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-20 | M | packages/oh-my-co-work-v3-linux-x64.zip | 3.7.0 Linux 运行包覆盖
2026-08-20 | M | packages/README.md / CURRENT.txt | 同步 3.7.0 包大小
2026-08-20 | M | CODE_CHANGE.md | 追加本轮封板条目

2026-08-20 | A | docs/crucible-3.7.md | 3.7.0 3.x 最终封板口径
2026-08-20 | M | README.md / AGENT.md / about.json / package.json / workspaces | 版本 3.7.0 最终封板
2026-08-20 | M | docs/README.md / mvp.md / crucible-3x.md / crucible-3x-plan.md / crucible-grok-client.md / packages/README.md | 发布线改为 3.7.0
2026-08-20 | M | CODE_CHANGE.md | 追加本轮封板条目

2026-08-20 | M | server/src/uploads.js / routes.js | 熔炉附件类型限制、不回 absPath、会话校验、归档删会话清 inbox
2026-08-20 | M | shared/index.js / FurnaceWorkspace.vue | 附件路径单行 + \\r\\n；TUI 首次挂载后 v-show；粘贴有字不抢附件
2026-08-20 | M | FurnaceSprite.vue | 只读一次 prefers-reduced-motion，不挂 change 监听
2026-08-20 | M | furnaceInbox.test.js / crucible-grok-client.md / crucible-3.5.md / frontend-components.md | 单行正文、公开元数据、附件口径
2026-08-20 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-20 | M | FurnaceWorkspace.vue / Prefs.vue | 两张皮用户名改为 GUI / TUI
2026-08-20 | M | README / about.json / crucible-3.5.md / crucible-grok-client.md | 同步 GUI / TUI 叫法
2026-08-20 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-20 | A | server/src/uploads.js 熔炉 inbox + POST /sessions/:id/furnace-files | 画面皮附件落到 Grok cwd
2026-08-20 | M | FurnaceWorkspace.vue / Workbench.vue / web/src/api.js | 附件、粘贴、拖放，发送写相对路径
2026-08-20 | A | server/test/furnaceInbox.test.js | inbox 路径与 PTY 正文
2026-08-20 | M | shared/index.js | buildFurnacePtyAttachText
2026-08-20 | M | frontend-components.md | 画面皮附件栏
2026-08-20 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-20 | M | docs/crucible-grok-client.md | 用户如何选画面/TUI；进程共存、屏幕不同时铺开
2026-08-20 | M | CODE_CHANGE.md | 追加本轮条目


2026-08-20 | M | CODE_CHANGE.md | 追加本轮条目


2026-08-20 | M | README.md / docs/README.md / crucible-3x.md / crucible-3.3.md / crucible-3.5.md / AGENT.md | 链到 Grok 客户端原理
2026-08-20 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-19 | A | web/src/components/FurnaceAvatar.vue | 熔炉干活面卡通头像，三态 GIF
2026-08-19 | M | FurnaceWorkspace.vue | 顶栏小头 + 画面右侧大头，随进程换表情
2026-08-19 | M | README.md / crucible-3.5.md / frontend-components.md | 同步干活面头像
2026-08-19 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-19 | A | web/src/assets/furnace-idle.gif / furnace-working.gif / furnace-waiting.gif | 桌宠三态轻动画（浮动/晃）
2026-08-19 | A | docs/assets/furnace-pet.gif | README 用闲置态 GIF
2026-08-19 | M | FurnaceSprite.vue | 默认播 GIF；减少动效时用 PNG
2026-08-19 | M | README.md | 使用场景：前端流、联调、发版、熔炉排障
2026-08-19 | M | frontend-components.md / crucible-3x.md | 桌宠改为 GIF
2026-08-19 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-19 | A | docs/assets/screenshots/furnace-grok-guide.webp | README：熔炉桌宠弹出的 Grok Build 教程
2026-08-19 | A | docs/assets/screenshots/furnace-workspace-chat.webp | README：熔炉铺满干活面（画面皮）
2026-08-19 | M | README.md | 3.5 熔炉截图与能力说明
2026-08-19 | M | docs/RELEASE-USER.md | 运行包文件名改为 v3
2026-08-19 | M | packages/oh-my-co-work-v3-linux-x64.zip | 3.5.0 Linux 运行包覆盖
2026-08-19 | M | packages/CURRENT.txt / packages/README.md | 同步 linux 包体积与提交
2026-08-19 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-19 | M | FurnaceWorkspace.vue / shared/index.js | IME 防误发；画面只渲染回放尾部；缩小与返回群聊分开；默认皮不覆盖本次切换
2026-08-19 | M | server/test/stripAnsi.test.js / docs/crucible-3.5.md | 尾部截断测试与文案
2026-08-19 | M | CODE_CHANGE.md | 追加本轮条目


2026-08-19 | A | web/src/components/terminal/FurnaceWorkspace.vue | 熔炉铺满对话皮，可缩小、可切 TUI
2026-08-19 | M | Workbench.vue / Prefs.vue / appSettings.js / shared/index.js | 开熔炉默认 surface=chat；stripAnsi 共用
2026-08-19 | A | docs/crucible-3.5.md | 3.5 简易对话皮设计
2026-08-19 | M | crucible-3x.md / crucible-3x-plan.md / about.json / AGENT.md | 3.5.0 版本与封板口径
2026-08-19 | M | CODE_CHANGE.md | 追加本轮条目


2026-08-19 | M | README.md / AGENT.md | 首页口号与居中欢迎截图说明同步到 README
2026-08-19 | M | Workbench.vue | 首页欢迎居中；口号同一字号颜色；补终端守护者/熔炉连接一切
2026-08-19 | M | docs/brand-logo.md / frontend-components.md | 同步欢迎区文案与布局
2026-08-19 | M | CODE_CHANGE.md | 追加本轮条目


2026-08-19 | M | AGENT.md / docs/frontend-components.md / brand-logo.md / crucible-3x*.md / mvp.md | 桌宠位置、欢迎区、完成即归档与文档对齐
2026-08-19 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-19 | M | FurnaceSprite.vue | 桌宠默认小头像、半透明，少占空间
2026-08-19 | M | engine.js / archiveSkip.test.js | 群聊同意最后一步即完成并归档释放资源；单聊不自动归档
2026-08-19 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | M | web/src/assets/furnace-idle.png / furnace-working.png / furnace-waiting.png | 熔炉立绘改为偏瘦双马尾
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | M | Workbench.vue / TerminalWorkspace.vue | 熔炉内嵌 TUI 默认满屏铺满页面
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | M | server/src/appSettings.js / config/app-settings.json / Prefs.vue | 「已配置 Grok」开关默认开启
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | M | web/src/components/FurnaceSprite.vue / App.vue | 熔炉改右下角桌宠：Q 版黑裙少女，可戳可拖会说话
2026-08-18 | A | web/src/assets/furnace-idle.png / furnace-working.png / furnace-waiting.png | 熔炉三态立绘（原创，透明底）
2026-08-18 | M | docs/frontend-components.md / crucible-3x.md / crucible-3.3.md | 入口从顶栏改为右下角桌宠
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | M | shared/index.js / furnaceUi.js / App.vue | 已装且已登录直接开熔炉 TUI，不再被设置开关挡住
2026-08-18 | M | Prefs.vue / GrokSetup.vue / docs/crucible-3.3.md / frontend-components.md | 入口文案：教程只在未装或未登录时弹出
2026-08-18 | M | server/test/grokStatus.test.js / furnace.test.js | 覆盖 canRun 免教程、勾选后接到 grok 脚本
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | M | web/src/views/settings/Prefs.vue | 补回 if (s.quota)，修复 load() 语法使 vite 能打包
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | M | package.json / workspaces / about.json | 版本 3.3.0 最终封板
2026-08-18 | M | README.md / AGENT.md / docs/mvp.md / crucible-3x*.md | 3.3.0 封板口径
2026-08-18 | M | server/src/grokStatus.js / App.vue / furnaceUi.js | 已登录即可进熔炉；教程「仍打开熔炉」
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | A | docs/crucible-3.3.md | 未安装/未登录/未配置时展示 Grok 教程
2026-08-18 | A | server/config/furnace/grok-config.example.toml | 配置示例，api_key 均为秘钥
2026-08-18 | A | server/src/grokStatus.js / test/grokStatus.test.js | 探测安装、登录、配置缺口
2026-08-18 | A | web/src/components/GrokSetupGuide.vue / views/settings/GrokSetup.vue | 教程页与精灵弹层
2026-08-18 | M | web/src/App.vue / Prefs.vue / router.js / SettingsLayout.vue | 缺口时点精灵打开教程
2026-08-18 | M | shared/index.js / server/src/routes.js / web/src/api.js | GROK 安装常量与 /grok/status
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | M | server/src/engine.js / furnaceSituation.js | 开始执行后游标刷新当前节点合同
2026-08-18 | M | server/test/furnace.test.js | 通过启动后意图与完成态进地图
2026-08-18 | M | docs/crucible-3.2.md / crucible-3x-plan.md | 开跑接线验收
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | M | docs/crucible-3.2.md | 收口为工作流 prompt 管理：节点一览 + 当前节点合同
2026-08-18 | M | server/src/furnaceContext.js / furnaceSituation.js | 编译节点类型/执行者/适配/闸门/游标
2026-08-18 | M | server/config/furnace/prompts/*.md | 角色壳改为读节点地图，不绑单一场景
2026-08-18 | M | server/test/furnaceContext.test.js / furnace.test.js | 节点一览与当前节点合同
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | A | docs/crucible-3.2.md | 情境注入 prompt 工程：角色壳 × 情境包
2026-08-18 | A | server/config/furnace/prompts/session.md | 群聊主持角色 prompt
2026-08-18 | A | server/src/furnaceSituation.js | 从会话抽出意图/议程/当前步
2026-08-18 | M | server/src/furnaceContext.js / engine.js / shared/index.js | ACTIVE 拼情境；开聊与换壳刷新
2026-08-18 | M | server/test/furnaceContext.test.js / furnace.test.js | 意图原话、换壳保留情境、开聊落盘
2026-08-18 | M | docs/crucible-3x.md / crucible-3x-plan.md / README.md | 3.2 改为情境注入，Grok 客户端后置
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | A | server/config/furnace/prompts/*.md | 熔炉三套 prompt：成员适配 / 节点适配 / 系统审核
2026-08-18 | A | server/config/furnace/memory-seed/*.md | 三套记忆种子，复制到 data/furnace/memory 一次
2026-08-18 | A | server/src/furnaceContext.js | 本轮只装一套 ACTIVE.md，记忆不覆盖
2026-08-18 | A | server/test/furnaceContext.test.js | 三套隔离、记忆不覆盖、步骤优先节点适配
2026-08-18 | M | server/src/engine.js / slashCommands.js / shared/index.js | 适配步与闸门分别激活角色；Grok cwd 为 data/furnace
2026-08-18 | M | docs/crucible-3x.md / crucible-3x-plan.md / directory-structure.md | 三套上下文落地说明
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | A | server/src/adaptBackup.js | 适配 zip 备份 + 幂等注释 + JSONL 覆盖
2026-08-18 | A | server/test/adaptBackup.test.js | 备份落盘、只读不改、注释只打一次
2026-08-18 | M | server/src/engine.js / appSettings.js | 适配步先备份再改；默开可关
2026-08-18 | M | web/src/views/Workbench.vue | 流程轨适配角标与筛选 Tab
2026-08-18 | M | web/src/views/settings/Prefs.vue | 改源文件前备份开关
2026-08-18 | M | docs/frontend-components.md | 流程轨适配角标与筛选 Tab
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | M | server/src/services.js / engine.js | 步骤 adapt 标记落盘，开聊写入节点 input
2026-08-18 | M | web/src/composables/furnaceUi.js / App.vue / Prefs.vue | 未配置 Grok 时精灵为等人态
2026-08-18 | M | server/test/furnace.test.js | 3.0 验收：适配标记、无熔炉开聊、闸门不绕过
2026-08-18 | M | docs/crucible-3x-plan.md | 勾选 3.0 验收
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | A | web/src/components/FurnaceSprite.vue / composables/furnaceUi.js | 3.0 黑裙精灵三态入口
2026-08-18 | M | shared/index.js | 熔炉常量、是否适配 hover、isFurnaceMember
2026-08-18 | M | server/src/slashCommands.js / config/slash-commands.json | 默认成员与斜杠展示名改为熔炉；可接 Grok TUI
2026-08-18 | M | server/src/appSettings.js / routes.js / index.js | grok.command/configured；保存后同步熔炉成员
2026-08-18 | M | server/src/engine.js | 闸门文案管理员→熔炉
2026-08-18 | M | web/src/App.vue / views/Workbench.vue | 顶栏精灵；未配置提示；已配置开熔炉会话
2026-08-18 | M | web/src/views/settings/Prefs.vue / Groups.vue / Members.vue / Shortcuts.vue | 熔炉文案、是否适配、Grok 配置
2026-08-18 | A | server/test/furnace.test.js | 熔炉成员种子与旧名迁移
2026-08-18 | M | docs/crucible-3x-plan.md / frontend-components.md / demo.md / mvp.md | 3.0 台账与入口说明
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | M | docs/crucible-3x.md / crucible-3x-plan.md | 是否适配单选项；管理员改熔炉；标记+备份包；精灵三态
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | M | docs/crucible-3x.md / crucible-3x-plan.md | 熔炉精灵：极简黑裙美少女，闲置与工作两态
2026-08-18 | M | docs/brand-logo.md | 工作台 Logo 与熔炉角色标分流
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | M | docs/crucible-3x.md / crucible-3x-plan.md | 熔炉是 Grok Agent、无内置工具；加人改代码 / 加节点插适配节点
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | M | docs/crucible-3x.md / crucible-3x-plan.md | 桌面形态正式命名为熔炉，不再用精灵作产品名
2026-08-18 | M | README.md / AGENT.md / docs/README.md / mvp.md | 同步熔炉桌面命名
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | A | docs/crucible-3x.md | 3.x 熔炉设计：加人/建群/闸门可配；精灵与 Grok Build 边界
2026-08-18 | A | docs/crucible-3x-plan.md | 3.x 实施计划 3.0～3.3
2026-08-18 | M | docs/README.md / README.md / AGENT.md / mvp.md / tui-2x.md / tui-2x-plan.md / technical-design.md | 索引与后置指向 3.x 规划
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | M | web/src/components/terminal/TerminalWorkspace.vue | 满屏 Teleport 到 body，铺满整个网页视口
2026-08-18 | M | docs/frontend-components.md / docs/mvp.md | 说明满屏不困在中栏毛玻璃卡片
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | M | package.json / workspaces / package-lock.json / about.json | 版本 2.6.0 最终封板
2026-08-18 | M | README.md / AGENT.md / docs/* | 发布线与路线图改为 2.6.0 封板
2026-08-18 | M | CODE_CHANGE.md | 追加本轮封板条目

2026-08-18 | M | web/src/components/terminal/TerminalWorkspace.vue | 终端增加满屏：铺满 HTML 页面
2026-08-18 | M | web/src/styles.css | 满屏时禁止页面滚动
2026-08-18 | M | docs/frontend-components.md / README.md | 同步满屏与全屏两种铺开方式
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | M | server/src/localAccess.js | 同源回环无 Origin 也可领令牌，跨站仍拒绝
2026-08-18 | M | server/src/index.js | 增加 POST /api/bootstrap，确保浏览器带 Origin
2026-08-18 | M | web/src/api.js | bootstrap 改 POST，避免 GET 不带 Origin 被拒
2026-08-18 | M | server/test/localAccess.test.js | 覆盖无 Origin 的本机 Host 与跨站拒绝
2026-08-18 | M | docs/data-storage.md | 同步 bootstrap 本机无 Origin 行为
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-18 | M | docs/data-and-ops.md | 修订记录补 2.4.0 / 2.5.0
2026-08-18 | M | package.json / workspaces / package-lock.json / about.json | 版本 2.5.0 最终封板
2026-08-18 | M | README.md / AGENT.md / docs/* | 发布线与路线图改为 2.5.0 封板
2026-08-18 | M | CODE_CHANGE.md | 追加本轮封板条目

2026-08-18 | M | web/src/views/Workbench.vue | 首页主口号「皆可 Workflow」后加重标识「终端守护者」
2026-08-18 | M | web/src/App.vue | 顶栏副标同步「终端守护者」
2026-08-18 | M | docs/assets/screenshots/workbench-home.webp | 重拍首页截图
2026-08-18 | M | README.md | 首页截图 alt 对齐新口号
2026-08-18 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-17 | M | server/src/terminal/terminalService.js | 同成员替换旧终端后再计配额；脱敏只写日志
2026-08-17 | M | server/test/terminalService.test.js | 覆盖配额替换与日志脱敏、回放原文
2026-08-17 | M | README.md / AGENT.md / docs/* / about.json | 2.4.0 最终封板
2026-08-17 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-17 | M | server/src/engine.js | 成员开聊复用已有单聊，不再弹启动闸门
2026-08-17 | M | shared/index.js | 项目参数 #1… 上限 #99
2026-08-17 | M | web/src/views/Workbench.vue | 成员开聊提示；# 快捷最多到 #99
2026-08-17 | A | server/test/memberReuse.test.js | 覆盖成员会话复用与 #99 上限
2026-08-17 | M | docs/data-storage.md / script-guide.md | 同步 #99 上限
2026-08-17 | M | CODE_CHANGE.md | 追加本轮条目

2026-08-17 | A | server/src/terminal/redact.js | 终端日志/回放脱敏
2026-08-17 | A | server/src/terminal/adapters/jsonl.js | 通用 JSONL Adapter 解析与轮询
2026-08-17 | A | web/src/components/terminal/terminalPrefs.js | 终端主题与偏好默认值
2026-08-17 | A | server/test/adapterJsonl.test.js / redact.test.js / adapterEvents.test.js | Adapter 与脱敏测试
2026-08-17 | M | server/src/appSettings.js / config/app-settings.json | 终端偏好、配额、脱敏
2026-08-17 | M | server/src/terminal/terminalService.js | 配额、脱敏、Adapter 侧通道、元数据落库、日志删除
2026-08-17 | M | server/src/engine.js | Adapter 事件转对话/闸门/节点结果
2026-08-17 | M | server/src/runners.js / routes.js / index.js / db.js | 接入 Adapter 与日志下载
2026-08-17 | M | web/src/views/settings/Prefs.vue / Members.vue | 终端偏好、配额、备份、JSONL 开关
2026-08-17 | M | web/src/views/Workbench.vue / TerminalView.vue / TerminalWorkspace.vue / api.js | 闸门、多终端、缺口重连、日志下载
2026-08-17 | M | README.md / AGENT.md / docs/* / about.json / package.json | 版本 2.4.0 与文档
2026-08-17 | M | CODE_CHANGE.md | 追加本轮条目

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
