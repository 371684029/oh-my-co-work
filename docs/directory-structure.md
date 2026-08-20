# oh-my-co-work 目录约定

> 与 **当前 MVP 代码** 对齐。设计阶段设想见历史版本；以仓库实际目录为准。

## 仓库结构（现状）

```
oh-my-co-work/
├── README.md
├── package.json                 # npm workspaces 根
├── package-lock.json
├── .gitignore
│
├── docs/                        # 设计与约定文档
│   ├── mvp.md                   # 宗旨 + MVP 范围
│   ├── technical-design.md      # 完整技术设计
│   ├── data-and-ops.md          # 数据与工程 P0–P4
│   ├── frontend-components.md   # 优先 Element-Plus-X
│   ├── directory-structure.md   # 本文件
│   └── author-contact.example.json
│
├── shared/                      # @acw/shared
│   ├── package.json
│   └── index.js                 # 状态常量、uid、cloneName
│
├── server/                      # @acw/server — API + 引擎
│   ├── package.json
│   ├── config/
│   │   ├── support.json         # 支持与交流
│   │   ├── about.json           # 关于与更新（版本/日志/本地说明）
│   │   └── furnace/             # 熔炉三套 prompt + 记忆种子
│   └── src/
│       ├── index.js             # Express + WS 入口，自动 seed
│       ├── localAccess.js       # 本机 Origin / 访问令牌（2.0.1）
│       ├── db.js                # SQLite + DATA_ROOT
│       ├── engine.js            # Session 推进 / 闸门 / 归档
│       ├── runners.js           # echo / script 执行
│       ├── processRegistry.js   # PID / 进程树
│       ├── terminal/            # PTY 终端会话
│       ├── services.js          # 成员/群/会话业务
│       ├── routes.js            # REST /api/*
│       ├── bus.js               # WebSocket 广播
│       └── seed.js              # 手动 seed 脚本
│
├── web/                         # @acw/web — Vue3 前端
│   ├── public/favicon.svg       # 标签页 Logo
│   └── src/components/AppLogo.vue
│   ├── package.json
│   ├── vite.config.js           # host 127.0.0.1:5173；代理 /api、/ws → :3780
│   ├── index.html
│   └── src/
│       ├── main.js              # Element Plus + Element-Plus-X
│       ├── App.vue              # 顶栏：工作台 | 设置
│       ├── router.js
│       ├── api.js               # fetch 封装
│       ├── styles.css
│       └── views/
│           ├── Workbench.vue    # 三栏 + Plus-X 对话组件
│           └── settings/
│               ├── SettingsLayout.vue
│               ├── Members.vue
│               ├── Groups.vue
│               └── Support.vue
│
├── data/                        # 运行时（gitignore，勿提交）
│   ├── oh-my-co-work.sqlite
│   ├── logs/
│   ├── journals/
│   ├── backups/adapt/           # 适配备份 zip（不进 git）
│   └── furnace/                 # ACTIVE.md + AGENTS.md 标记块 + SITUATION.md + inbox + 本机记忆（不进 git）
│
└── scripts/                     # 可选运维脚本
```

## 模块边界

| 路径 | 职责 |
|------|------|
| `shared/` | 纯常量与工具，无 IO |
| `server/` | **唯一**业务与执行：引擎、DB、spawn |
| `web/` | 展示与交互；不直接 spawn |
| `data/` | 运行时数据，本地生成 |
| `docs/` | 产品/技术约定；与实现同步维护 |

## 端口

| 服务 | 默认 | 说明 |
|------|------|------|
| API | `3780` | `ACW_PORT` 可改 |
| Vite | `5173` | 开发绑 `127.0.0.1`；代理到 API |

## 配置文件（server/config）

| 文件 | 说明 |
|------|------|
| `app-settings.json` | `showDemo`、`showScriptPopup`、`autoArchiveHours`、全局 `admin` |
| `slash-commands.json` | 快捷指令（可含 `showScriptPopup`） |
| `about.json` / `support.json` | 关于页 / 支持与交流 |
| `furnace/prompts/*.md` | 群聊主持 / 成员适配 / 节点适配 / 系统审核 prompt |
| `furnace/memory-seed/*.md` | 本机记忆初始副本（只复制一次） |

运行时数据见 [data-storage.md](./data-storage.md)。

## 后置目录（设计有、代码未建）

| 路径 | 说明 |
|------|------|
| `desktop/` | GUI 壳（Tauri/Electron），复用 `web` |
| `server` 完整 migration 框架 | 当前 schema 在 `db.js` 内初始化 |

## Git 忽略

见根目录 `.gitignore`：`node_modules/`、`data/`、`.env`、`web/dist/` 等。
