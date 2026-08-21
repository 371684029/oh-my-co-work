# 熔炉桌宠分镜（进 git）

合成循环 GIF 用的透明底分镜。运行时读的是 `web/src/assets/furnace-*.gif`。
动作要日常、慢：每帧约 500ms，先停一拍再动。

| 文件 | 接到哪套 GIF |
|------|----------------|
| `idle-01.png` … `idle-03.png` | `furnace-idle.gif` 闲置：站着、招手打招呼 |
| `work-01.png` … `work-03.png` | `furnace-working.gif` 干活：低头看书 |
| `wait-01.png` … `wait-03.png` | `furnace-waiting.gif` 等人：双手交叠、轻轻点头 |
| `poke-01.png` … `poke-03.png` | `furnace-poke.gif` 戳一下：轻愣一下再招手 |

改动作时先换这些 PNG（绿幕或透明均可），再跑：

```bash
python3 docs/assets/furnace-pet-frames/compose.py
```
