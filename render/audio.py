#!/usr/bin/env python3
"""粗剪临时音轨：按分镜数据合成配乐、音效与旁白节奏提示音，混音后输出 build/roughcut/audio.wav。

- 配乐：按 music 字段的段落变化（环境声 → 每分钟 100 拍的电子节奏 → 带教段降低 → 岗位段平稳 → 收束）。
- 音效：读取各镜 audio 字段，按关键词匹配点击、确认音、滴答、呼啸、上扬音、书写声、纸张声等。
- 旁白提示音：没有配音时，用与旁白音节数一致的短促提示音标出每句旁白的位置与语速，并让配乐在此处压低。
仅依赖 Python 标准库与 numpy，混音与响度标准化调用 FFmpeg。

环境变量 VO_GUIDE=0：混音时不放旁白提示音（配乐也不再按旁白压低），用于去掉测试信息的版本。
"""
import json
import os
import re
import subprocess
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "build" / "roughcut"
SR = 48000
story = json.loads((ROOT / "docs" / "03-分镜数据.json").read_text(encoding="utf-8"))
DUR = story["format"]["duration_s"]
N = int(DUR * SR)
rng = np.random.default_rng(2027)


def tt(sec):
    return np.arange(int(sec * SR)) / SR


def add(buf, start, x, gain=1.0):
    i = int(start * SR)
    if i >= len(buf):
        return
    x = x[: len(buf) - i]
    buf[i : i + len(x)] += x * gain


def env(n, attack=0.005, release=0.1):
    a, r = int(attack * SR), int(release * SR)
    e = np.ones(n)
    e[:a] = np.linspace(0, 1, a) if a else 1
    if r:
        e[-r:] *= np.exp(-np.linspace(0, 5, r))
    return e


def lowpass(x, k=8):
    return np.convolve(x, np.ones(k) / k, mode="same")


# ---------- 音色 ----------
def click():
    t = tt(0.035)
    return np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 170) * 0.7


def tick(f=1320):
    t = tt(0.2)
    return (np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * f * 1.5 * t)) * np.exp(-t * 20) * 0.32


def whoosh(sec=0.7):
    t = tt(sec)
    n = lowpass(rng.standard_normal(len(t)), 6)
    return n * np.sin(np.pi * t / sec) ** 2 * 0.35


def riser(sec=0.9):
    t = tt(sec)
    f = np.linspace(400, 1400, len(t))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.15
    return (tone + lowpass(rng.standard_normal(len(t)), 4) * 0.08) * (t / sec) ** 1.5 * np.exp(-np.maximum(0, t - sec + 0.15) * 20)


def low_boop():
    t = tt(0.5)
    return np.sin(2 * np.pi * 120 * t) * np.exp(-t * 6) * 0.5


def scribble(sec=1.2):
    t = tt(sec)
    n = rng.standard_normal(len(t)) - lowpass(rng.standard_normal(len(t)), 30)
    strokes = (np.sin(2 * np.pi * 3.2 * t) > 0.2).astype(float)
    return lowpass(n, 3) * lowpass(strokes, 800) * 0.12


def paper():
    t = tt(0.35)
    return lowpass(rng.standard_normal(len(t)), 3) * np.exp(-t * 9) * 0.25


def blips():
    out = np.zeros(int(0.5 * SR))
    for k, f in enumerate([880, 1100, 1320]):
        add(out, k * 0.1, tick(f) * 0.6)
    return out


def swell():
    t = tt(2.0)
    chord = sum(np.sin(2 * np.pi * f * t) for f in (220, 277.2, 329.6, 440))
    return chord * np.sin(np.pi * t / 2.0) ** 2 * 0.06


def keys(sec=0.8):
    out = np.zeros(int(sec * SR))
    for k in range(int(sec * 11)):
        add(out, k / 11 + rng.random() * 0.03, click() * (0.5 + rng.random() * 0.3))
    return out


def ticks(sec=1.2, n=10):
    out = np.zeros(int(sec * SR) + SR)
    for k in range(n):
        add(out, k * sec / n, tick(1700) * 0.5)
    return out


RULES = [  # (关键词, 音色)
    (("键盘",), keys), (("滴答",), ticks), (("点击", "鼠标", "开关"), click),
    (("呼啸", "散开", "细碎", "分屏"), whoosh), (("上扬", "电流", "描线", "描出", "穿过"), riser),
    (("书写", "马克笔"), scribble), (("纸张", "便签", "收拢"), paper), (("和声",), swell),
    (("低沉", "低频落点"), low_boop), (("程序运行", "电子音"), blips),
    (("确认", "提示音", "亮起", "点亮", "落定", "轻响", "落点", "闭合"), tick),
]


def cue_sound(cue):
    for words, fn in RULES:
        if any(w in cue for w in words):
            return fn
    return None


# ---------- 音效轨 ----------
sfx = np.zeros(N)
for shot in story["shots"]:
    for c in shot.get("audio", []):
        cue = c["cue"]
        if "环境声" in cue:
            continue  # 由配乐中的环境声承担
        fn = cue_sound(cue)
        if not fn:
            continue
        explicit = re.findall(r"(\d+(?:\.\d+)?)\s*(?:/|秒)", cue.split("（")[-1]) if "（" in cue else []
        m = re.search(r"×\s*(\d+)", cue)
        times = [float(x) for x in explicit] if explicit else [c["t"] + k * 0.4 for k in range(int(m.group(1)) if m else 1)]
        for t0 in times:
            add(sfx, shot["start"] + t0, fn())

# ---------- 旁白提示音 ----------
vo = np.zeros(N)
PUNCT = "，。？！、；：,.?!;:"
for shot in story["shots"]:
    v = shot.get("vo")
    if not v:
        continue
    s = v.get("tts", v["text"]).replace("“", "").replace("”", "")
    tokens = [("p" if ch in PUNCT else "s") for ch in s if ch in PUNCT or re.match(r"[一-鿿A-Za-z0-9]", ch)]
    while tokens and tokens[-1] == "p":
        tokens.pop()
    a, b = v["t"]
    unit = (b - a) / (tokens.count("s") + 2 * tokens.count("p"))
    t0 = shot["start"] + a
    for k, tok in enumerate(tokens):
        if tok == "p":
            t0 += 2 * unit
            continue
        d = unit * 0.62
        t = tt(d)
        f = 210 + 40 * ((k * 7) % 3) + rng.random() * 12
        add(vo, t0, np.sin(2 * np.pi * f * t) * env(len(t), 0.01, d * 0.6) * 0.42)
        t0 += unit

# ---------- 配乐 ----------
music = np.zeros(N)
t = np.arange(N) / SR
amb = lowpass(rng.standard_normal(N), 400) * 2.2 + np.sin(2 * np.pi * 50 * t) * 0.05
music += amb * 0.5
BEAT = 0.6
CHORDS = [(110.0, 130.8, 164.8), (87.3, 110.0, 130.8), (65.4, 98.0, 130.8), (98.0, 123.5, 146.8)]  # Am F C G


def section(sec):
    if sec < 5:
        return "intro"
    if sec < 31:
        return "lift"
    if sec < 79:
        return "work"
    if sec < 97:
        return "mentor"
    if sec < 104:
        return "growth"
    if sec < 138:
        return "jobs"
    if sec < 146.5:
        return "finale"
    return "end"


bar = BEAT * 4
for i in range(int(5 / BEAT), int(146.5 / BEAT)):
    beat_t = i * BEAT
    sec = section(beat_t)
    if i % 16 == 0 or (i - int(5 / BEAT)) == 0:  # 每 4 小节换和弦
        chord = CHORDS[(i // 16) % 4]
        d = min(bar * 4, 146.5 - beat_t)
        ct = tt(d)
        pad = sum(np.sin(2 * np.pi * f * ct) + 0.3 * np.sin(2 * np.pi * f * 2 * ct) for f in chord)
        e = np.minimum(1, ct / 0.8) * np.minimum(1, (d - ct) / 0.8)
        add(music, beat_t, pad * e * (0.035 if sec == "mentor" else 0.05))
    if sec in ("lift", "work", "jobs", "finale") or (sec == "growth" and i % 2 == 0):
        kt = tt(0.25)
        add(music, beat_t, np.sin(2 * np.pi * (55 + 40 * np.exp(-kt * 30)) * kt) * np.exp(-kt * 14) * 0.5)
    if sec in ("lift", "work", "finale", "jobs"):
        ht = tt(0.05)
        add(music, beat_t + BEAT / 2, rng.standard_normal(len(ht)) * np.exp(-ht * 90) * 0.08)
    if sec in ("lift", "growth", "finale"):
        chord = CHORDS[(i // 16) % 4]
        for k in range(2):
            f = chord[(i * 2 + k) % 3] * (4 if sec != "lift" else 2)
            at = tt(0.28)
            add(music, beat_t + k * BEAT / 2, np.sin(2 * np.pi * f * at) * np.exp(-at * 9) * 0.06)
fade = np.clip((147.0 - t) / 0.5, 0, 1)
music[t > 146.5] *= fade[t > 146.5]
music[t > 147] = amb[t > 147] * 0.25


def write(name, x):
    x = np.clip(x, -1, 1)
    with wave.open(str(OUT / name), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype("<i2").tobytes())


OUT.mkdir(parents=True, exist_ok=True)
write("music.wav", music * 0.6)
write("sfx.wav", sfx * 0.8)
write("vo_guide.wav", vo)
if os.environ.get("VO_GUIDE", "1") == "0":
    mix = "[0:a][2:a]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[out]"
else:
    mix = ("[1:a]asplit=2[vo][sc];[0:a][sc]sidechaincompress=threshold=0.02:ratio=6:attack=30:release=500[duck];"
           "[duck][vo][2:a]amix=inputs=3:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[out]")
subprocess.run([
    "ffmpeg", "-y", "-loglevel", "error",
    "-i", str(OUT / "music.wav"), "-i", str(OUT / "vo_guide.wav"), "-i", str(OUT / "sfx.wav"),
    "-filter_complex", mix,
    "-map", "[out]", "-ar", "48000", "-ac", "2", str(OUT / "audio.wav"),
], check=True)
print("临时音轨 → build/roughcut/audio.wav")
