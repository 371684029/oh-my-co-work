# 熔炉桌宠分镜（进 git）

合成循环 GIF 用的透明底分镜。运行时读的是 `web/src/assets/furnace-*.gif`。

| 文件 | 接到哪套 GIF |
|------|----------------|
| `idle-01.png` … `idle-04.png` | `furnace-idle.gif` 闲置 |
| `work-01.png` … `work-04.png` | `furnace-working.gif` 工作 |
| `wait-01.png` … `wait-04.png` | `furnace-waiting.gif` 等人 |
| `poke-01.png` … `poke-03.png` | `furnace-poke.gif` 戳一下 |

绿幕原图已抠成透明底，420×810。改动作时先改这些 PNG，再合成 GIF。
