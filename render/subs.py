#!/usr/bin/env python3
"""把 storyboard.py 导出的 SRT 字幕转成 1920×1080 的 ASS 字幕，样式按视觉规范：Noto Sans SC 粗体 40px、白字深蓝描边。

用法：python3 render/subs.py <输入.srt> <输出.ass>
"""
import re
import sys
from pathlib import Path

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
HEAD = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Noto Sans SC,40,&H00FFFFFF,&H00FFFFFF,&H00462B0F,&H78000000,1,0,0,0,100,100,1,0,1,2,1.5,2,80,80,72,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


def ass_time(s):
    h, m, rest = s.split(":")
    sec, ms = rest.split(",")
    return f"{int(h)}:{m}:{sec}.{ms[:2]}"


events = []
for block in re.split(r"\n\s*\n", src.read_text(encoding="utf-8").strip()):
    lines = block.splitlines()
    if len(lines) >= 3:
        a, b = [x.strip() for x in lines[1].split("-->")]
        events.append(f"Dialogue: 0,{ass_time(a)},{ass_time(b)},Sub,,0,0,0,,{' '.join(lines[2:])}")
dst.write_text(HEAD + "\n".join(events) + "\n", encoding="utf-8")
print(f"字幕 {len(events)} 条 → {dst}")
