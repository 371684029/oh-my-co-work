# 熔炉桌宠分镜（进 git）

合成循环 GIF 用的透明底分镜。运行时读的是 `web/src/assets/furnace-*.gif`。

| 文件 | 接到哪套 GIF |
|------|----------------|
| `idle-01.png` … `idle-04.png` | `furnace-idle.gif` 闲置：扭胯、眨眼、发丝晃 |
| `work-01.png` … `work-04.png` | `furnace-working.gif` 干活：抱笔记本、抬头、甩发 |
| `wait-01.png` … `wait-04.png` | `furnace-waiting.gif` 等人：叉腰、招手、看你 |
| `poke-01.png` … `poke-03.png` | `furnace-poke.gif` 戳一下：跳起、嘟嘴、回眸 |

改动作时先换这些 PNG（绿幕或透明均可），再跑：

```bash
python3 docs/assets/furnace-pet-frames/compose.py
```
