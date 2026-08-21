# 熔炉桌宠分镜（进 git）

合成循环 GIF 用的透明底分镜。运行时读的是 `web/src/assets/furnace-*.gif`。
要日常、慢：每套只两帧（站定 + 一个小动作），每帧约 1 秒，循环里多停少动。
第三帧（眨眼、大挥手、书光）留在目录里但不进 GIF。

| 文件 | 接到哪套 GIF |
|------|----------------|
| `idle-01.png` + `idle-02.png` | `furnace-idle.gif` 闲置：站着，偶尔轻轻招手 |
| `work-01.png` + `work-02.png` | `furnace-working.gif` 干活：捧着书，偶尔翻一下 |
| `wait-01.png` + `wait-02.png` | `furnace-waiting.gif` 等人：双手交叠，偶尔轻轻点头 |
| `poke-01.png` + `poke-02.png` | `furnace-poke.gif` 戳一下：愣一下再轻轻抬手 |

改动作时先换这些 PNG（绿幕或透明均可），再跑：

```bash
python3 docs/assets/furnace-pet-frames/compose.py
```
