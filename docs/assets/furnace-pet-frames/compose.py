#!/usr/bin/env python3
"""抠绿幕分镜，用 ffmpeg 合成透明循环 GIF。"""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent
WEB = Path(__file__).resolve().parents[3] / "web" / "src" / "assets"
DOCS = Path(__file__).resolve().parents[1]

SETS = {
    "idle": (["idle-01.png", "idle-02.png", "idle-03.png"], 2, True, "furnace-idle.png"),
    "working": (["work-01.png", "work-02.png", "work-03.png"], 2, True, "furnace-working.png"),
    "waiting": (["wait-01.png", "wait-02.png", "wait-03.png"], 2, True, "furnace-waiting.png"),
    "poke": (["poke-01.png", "poke-02.png", "poke-03.png"], 2, False, None),
}

CANVAS_W, CANVAS_H = 420, 810
GIF_W = 148


def chroma_key(im: Image.Image) -> Image.Image:
    arr = np.array(im.convert("RGBA"), dtype=np.int16)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    green = (g > 140) & (g - r > 70) & (g - b > 70)
    near = (g > 110) & (g - r > 40) & (g - b > 40)
    a = np.where(green, 0, np.where(near, 110, 255)).astype(np.uint8)
    out = arr.astype(np.uint8)
    out[:, :, 3] = a
    spill = (a > 0) & (g > r + 25) & (g > b + 15)
    out[:, :, 1] = np.where(spill, np.minimum(out[:, :, 1], ((r + b) // 2).astype(np.uint8)), out[:, :, 1])
    return Image.fromarray(out, "RGBA")


def bbox(im: Image.Image) -> tuple[int, int, int, int]:
    a = np.array(im.split()[-1])
    ys, xs = np.where(a > 24)
    if len(xs) == 0:
        return (0, 0, im.width, im.height)
    pad = 16
    return (
        max(0, int(xs.min()) - pad),
        max(0, int(ys.min()) - pad),
        min(im.width, int(xs.max()) + pad),
        min(im.height, int(ys.max()) + pad),
    )


def fit_canvas(im: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    ratio = min(CANVAS_W / im.width, CANVAS_H / im.height)
    nw, nh = max(1, int(im.width * ratio)), max(1, int(im.height * ratio))
    scaled = im.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(scaled, ((CANVAS_W - nw) // 2, CANVAS_H - nh), scaled)
    return canvas


def pingpong(frames: list[Image.Image], loop_back: bool) -> list[Image.Image]:
    held = [frames[0], frames[0], *frames]
    if not loop_back or len(frames) < 3:
        return held
    return held + frames[-2:0:-1]


def ffmpeg_gif(frames: list[Image.Image], dest: Path, fps: int) -> None:
    with tempfile.TemporaryDirectory(prefix="furnace-gif-") as tmp:
        tdir = Path(tmp)
        for i, im in enumerate(frames, 1):
            w = GIF_W
            h = max(1, round(im.height * w / im.width))
            if h % 2:
                h += 1
            im.resize((w, h), Image.Resampling.LANCZOS).save(tdir / f"{i:02d}.png")
        pal = tdir / "pal.png"
        pattern = str(tdir / "%02d.png")
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-framerate",
                str(fps),
                "-i",
                pattern,
                "-vf",
                "palettegen=reserve_transparent=1:stats_mode=full",
                str(pal),
            ]
        )
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-framerate",
                str(fps),
                "-i",
                pattern,
                "-i",
                str(pal),
                "-lavfi",
                "paletteuse=dither=bayer:bayer_scale=4:alpha_threshold=48",
                "-gifflags",
                "-offsetting",
                str(dest),
            ]
        )


def main() -> None:
    WEB.mkdir(parents=True, exist_ok=True)
    for name, (files, fps, loop_back, png_name) in SETS.items():
        raw = [Image.open(ROOT / fn) for fn in files]
        keyed = []
        for im in raw:
            px = im.convert("RGBA").getpixel((2, 2))
            if px[1] > 140 and px[1] - px[0] > 50:
                keyed.append(chroma_key(im))
            else:
                keyed.append(im.convert("RGBA"))
        boxes = [bbox(src) for src in keyed]
        l, t = min(b[0] for b in boxes), min(b[1] for b in boxes)
        r, btm = max(b[2] for b in boxes), max(b[3] for b in boxes)
        cropped = [fit_canvas(src.crop((l, t, r, btm))) for src in keyed]
        for fn, placed in zip(files, cropped):
            placed.save(ROOT / fn, optimize=True)
        if png_name:
            cropped[0].save(WEB / png_name)
        dest = WEB / f"furnace-{name}.gif"
        ffmpeg_gif(pingpong(cropped, loop_back), dest, fps)
        if name == "idle":
            shutil.copy2(dest, DOCS / "furnace-pet.gif")
        print(dest.name, dest.stat().st_size)


if __name__ == "__main__":
    main()
