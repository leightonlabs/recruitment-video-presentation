#!/usr/bin/env python3
"""分镜数据工具：校验 docs/03-分镜数据.json，并导出字幕与 AI 提示词表。

用法：
  python3 tools/storyboard.py check              校验时间、阅读速度、配音语速、用词与资产引用
  python3 tools/storyboard.py summary            按镜头列出时间、路线和语速，并统计各路线时长
  python3 tools/storyboard.py srt [输出路径]      导出字幕，默认 build/subtitles.srt
  python3 tools/storyboard.py lrc [输出路径]      导出 LRC 格式字幕，默认 build/subtitles.lrc
  python3 tools/storyboard.py prompts [输出路径]  生成 AI 提示词表，默认 docs/07-AI生成提示词.md

仅依赖 Python 标准库。
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "docs" / "03-分镜数据.json"

READ_CPS = 9.0       # 屏幕文字阅读速度（字/秒）
SCREEN_CPS_WARN = 10.0  # 单镜屏幕文字总量提醒阈值（字/镜头秒）
VO_CPS_WARN = 4.5    # 配音语速提醒阈值（音节/秒）
VO_CPS_MAX = 5.0     # 配音语速上限
SUB_MAX_CHARS = 16   # 字幕单行字数上限
EPS = 1e-6


def load():
    with open(DATA, encoding="utf-8") as f:
        return json.load(f)


def count_chars(text):
    """统计需要阅读或朗读的字符：汉字、字母和数字，不计标点与空格。"""
    return len(re.findall(r"[\u4e00-\u9fffA-Za-z0-9]", text))


def vo_cps(shot):
    vo = shot.get("vo")
    if not vo:
        return 0.0
    a, b = vo["t"]
    return count_chars(vo.get("tts", vo["text"])) / (b - a)


def copy_issues(text, rules):
    """按 copy_rules 检查旁白或屏幕文字：返回 (错误, 提醒)。"""
    errors = [f"出现禁用词“{w}”" for w in rules.get("banned", []) if w in text]
    # 允许的固定说法（如试点正式名称）和已报错的禁用词不再重复提醒
    hidden = text
    for w in rules.get("allow_contexts", []) + rules.get("banned", []):
        hidden = hidden.replace(w, "")
    warnings = []
    for w in rules.get("avoid", []):
        if w in hidden:
            warnings.append(f"出现应尽量避免的“{w}”")
            hidden = hidden.replace(w, "")
    allow = set(rules.get("latin_allow", []))
    latin = sorted({w for w in re.findall(r"[A-Za-z]+", text) if w not in allow})
    if latin:
        warnings.append("出现英文 " + "、".join(latin))
    return errors, warnings


def routes_of(shot):
    return "+".join(sorted({b["src"] for b in shot["beats"]}, key="IGAR".index))


def check(data):
    errors, warnings = [], []
    fps = data["format"]["fps"]
    total = data["format"]["duration_s"]
    assets = data["assets"]
    routes = data["routes"]
    styles = data["design_tokens"]["type_16x9"]
    min_hold = data["design_tokens"]["motion"]["min_text_hold_s"]
    max_clip = data["ai_policy"]["max_clip_s"]
    rules = data.get("copy_rules", {})

    def copy_check(where, text):
        errs, warns = copy_issues(text, rules)
        errors.extend(f"{where}: {e}" for e in errs)
        warnings.extend(f"{where}: {w}" for w in warns)

    def on_grid(x):
        return abs(x * fps - round(x * fps)) < EPS

    used = defaultdict(float)
    cursor = 0
    ids = set()
    for shot in data["shots"]:
        sid = shot["id"]
        if sid in ids:
            errors.append(f"{sid}: 镜头编号重复")
        ids.add(sid)
        start, end = shot["start"], shot["end"]
        dur = end - start
        if abs(start - cursor) > EPS:
            errors.append(f"{sid}: 起点 {start} 与上一镜终点 {cursor} 不连续")
        cursor = end
        for x in (start, end):
            if not on_grid(x):
                errors.append(f"{sid}: 时间 {x} 不落在 {fps} fps 帧格上")

        t = 0
        for i, beat in enumerate(shot["beats"]):
            a, b = beat["t"]
            if abs(a - t) > EPS:
                errors.append(f"{sid} 第{i + 1}拍: 起点 {a} 与上一拍终点 {t} 不连续")
            if b <= a:
                errors.append(f"{sid} 第{i + 1}拍: 时长不为正")
            if not (on_grid(a) and on_grid(b)):
                errors.append(f"{sid} 第{i + 1}拍: 时间不落在帧格上")
            t = b
            src = beat["src"]
            if src not in routes:
                errors.append(f"{sid} 第{i + 1}拍: 未知路线 {src}")
            if src in ("G", "I") and not beat.get("scene"):
                errors.append(f"{sid} 第{i + 1}拍: {src} 路线缺少 scene")
            if src in ("A", "I") and not beat.get("asset"):
                errors.append(f"{sid} 第{i + 1}拍: {src} 路线缺少 asset")
            name = beat.get("asset")
            if name:
                if name not in assets:
                    errors.append(f"{sid} 第{i + 1}拍: 资产 {name} 未定义")
                    continue
                kind = assets[name]["kind"]
                if src == "A" and kind != "video":
                    errors.append(f"{sid} 第{i + 1}拍: A 路线应引用视频资产，{name} 为 {kind}")
                if src == "I" and kind != "image":
                    errors.append(f"{sid} 第{i + 1}拍: I 路线应引用图像资产，{name} 为 {kind}")
                if kind == "video":
                    used[name] += b - a
                    if b - a > max_clip + EPS:
                        errors.append(f"{sid} 第{i + 1}拍: AI 片段 {b - a:.1f} 秒超过上限 {max_clip} 秒")
                else:
                    used[name] += 0
        if abs(t - dur) > EPS:
            errors.append(f"{sid}: 各拍合计 {t} 秒，与镜头时长 {dur} 秒不符")

        on_screen = sum(count_chars(x["content"]) for x in shot.get("text", []) if x["style"] != "code")
        if on_screen / dur > SCREEN_CPS_WARN:
            warnings.append(f"{sid}: 屏幕文字共 {on_screen} 字，平均每秒 {on_screen / dur:.1f} 字，偏密")
        for item in shot.get("text", []):
            a, b = item["t"]
            label = item["content"][:16].replace("\n", " ")
            if a < -EPS or b > dur + EPS:
                errors.append(f"{sid} 文字「{label}」: 超出镜头范围")
            if item["style"] not in styles:
                errors.append(f"{sid} 文字「{label}」: 未定义样式 {item['style']}")
            if item["style"] == "code":
                continue  # 代码作为画面质感，不要求逐字读完，也不做用词检查
            copy_check(f"{sid} 文字「{label}」", item["content"])
            need = max(min_hold, count_chars(item["content"]) / READ_CPS)
            if b - a + EPS < need:
                errors.append(f"{sid} 文字「{label}」: 停留 {b - a:.2f} 秒，至少需要 {need:.2f} 秒")

        vo = shot.get("vo")
        if shot.get("subtitle") and not vo:
            errors.append(f"{sid}: 开启字幕但没有旁白")
        if vo:
            a, b = vo["t"]
            if a < -EPS or b > dur + EPS:
                errors.append(f"{sid}: 旁白窗口超出镜头")
            cps = vo_cps(shot)
            if cps > VO_CPS_MAX:
                errors.append(f"{sid}: 旁白语速 {cps:.1f} 音节/秒，超过 {VO_CPS_MAX}")
            elif cps > VO_CPS_WARN:
                warnings.append(f"{sid}: 旁白语速 {cps:.1f} 音节/秒，偏快")
            copy_check(f"{sid} 旁白", vo["text"])
            for p in vo.get("phrases", []):
                pa, pb = p["t"]
                if pa < a - EPS or pb > b + EPS:
                    errors.append(f"{sid}: 旁白分句「{p['text']}」超出旁白窗口")
                if count_chars(p["text"]) / (pb - pa) > VO_CPS_MAX:
                    errors.append(f"{sid}: 旁白分句「{p['text']}」语速超过 {VO_CPS_MAX} 音节/秒")

    if abs(cursor - total) > EPS:
        errors.append(f"全片合计 {cursor} 秒，与设定时长 {total} 秒不符")
    for name, spec in assets.items():
        if name not in used:
            errors.append(f"资产 {name} 未被任何镜头使用")
        elif spec["kind"] == "video" and used[name] > spec["gen_seconds"] + EPS:
            errors.append(f"资产 {name} 使用 {used[name]:.1f} 秒，超过生成时长 {spec['gen_seconds']} 秒")
        for key in ("prompt_en", "prompt_zh", "acceptance"):
            if not spec.get(key):
                errors.append(f"资产 {name} 缺少 {key}")
    return errors, warnings


def asset_usage(data):
    """每个资产按镜头汇总成片使用秒数：{资产: [(镜号, 秒数, 是否可选), ...]}。"""
    usage = defaultdict(dict)
    for shot in data["shots"]:
        for beat in shot["beats"]:
            if beat.get("asset"):
                a, b = beat["t"]
                sec, opt = usage[beat["asset"]].get(shot["id"], (0.0, True))
                usage[beat["asset"]][shot["id"]] = (sec + b - a, opt and beat.get("optional", False))
    return {name: [(sid, sec, opt) for sid, (sec, opt) in shots.items()] for name, shots in usage.items()}


def summary(data):
    by_route = defaultdict(float)
    print(f"{'镜号':<5}{'时间':<14}{'帧':<12}{'路线':<8}{'语速':<6}字幕")
    fps = data["format"]["fps"]
    for shot in data["shots"]:
        s, e = shot["start"], shot["end"]
        for beat in shot["beats"]:
            a, b = beat["t"]
            by_route[beat["src"]] += b - a
        print(f"{shot['id']:<6}{fmt_clock(s)}–{fmt_clock(e)}   "
              f"{round(s * fps):>4}–{round(e * fps):<6} {routes_of(shot):<8}"
              f"{vo_cps(shot):>4.1f}  {'是' if shot.get('subtitle') else '否'}")
    total = data["format"]["duration_s"]
    print()
    for key in "GIAR":
        if by_route[key]:
            print(f"{key} {data['routes'][key].split('：')[0]}：{by_route[key]:.1f} 秒（{by_route[key] / total:.0%}）")


def fmt_clock(sec):
    return f"{int(sec // 60):02d}:{sec % 60:05.2f}"


def fmt_srt(sec):
    ms = round(sec * 1000)
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def split_subtitle(text):
    """按标点切分，合并为不超过 SUB_MAX_CHARS 的行；句号、问号、叹号处必须断行，不跨句合并；去掉行尾逗号和句号。"""
    parts = [p for p in re.split(r"(?<=[，。？！；])", text) if p]
    lines, cur = [], ""
    for p in parts:
        if cur and count_chars(cur + p) > SUB_MAX_CHARS:
            lines.append(cur)
            cur = p
        else:
            cur += p
        if cur.endswith(("。", "？", "！")):
            lines.append(cur)
            cur = ""
    if cur:
        lines.append(cur)
    return [re.sub(r"[，。；]$", "", line) for line in lines]


def subtitle_cues(data):
    """按各镜旁白生成字幕条目 [(开始秒, 结束秒, 文字)]，SRT 与 LRC 共用。"""
    cues = []
    for shot in data["shots"]:
        vo = shot.get("vo")
        if not (vo and shot.get("subtitle")):
            continue
        base = shot["start"]
        if vo.get("phrases"):
            for p in vo["phrases"]:
                cues.append((base + p["t"][0], base + p["t"][1], re.sub(r"[，。]$", "", p["text"])))
            continue
        a, b = vo["t"]
        lines = split_subtitle(vo["text"])
        weights = [max(count_chars(x), 1) for x in lines]
        t = a
        for line, w in zip(lines, weights):
            d = (b - a) * w / sum(weights)
            cues.append((base + t, base + t + d, line))
            t += d
    return cues


def shown(out):
    return out.relative_to(ROOT) if out.is_relative_to(ROOT) else out


def srt(data, out):
    cues = subtitle_cues(data)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        for i, (a, b, line) in enumerate(cues, 1):
            f.write(f"{i}\n{fmt_srt(a)} --> {fmt_srt(b)}\n{line}\n\n")
    print(f"已写入 {shown(out)}（{len(cues)} 条）")


def fmt_lrc(sec):
    cs = round(sec * 100)
    m, cs = divmod(cs, 6000)
    return f"{m:02d}:{cs // 100:02d}.{cs % 100:02d}"


def lrc(data, out):
    """LRC 每行只有开始时间：下一条字幕没有紧接着出现时，在本条结束处加一行空文字清屏。"""
    cues = subtitle_cues(data)
    lines = [f"[ti:{data['title']}]", f"[length:{fmt_lrc(data['format']['duration_s'])[:5]}]"]
    for i, (a, b, line) in enumerate(cues):
        lines.append(f"[{fmt_lrc(a)}]{line}")
        if i + 1 == len(cues) or cues[i + 1][0] - b > 0.05:
            lines.append(f"[{fmt_lrc(b)}]")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"已写入 {shown(out)}（{len(cues)} 条）")


def english(title, body):
    """英文版本折叠在 <details> 中，只在模型不支持中文时使用。"""
    return ["", f"<details><summary>{title}</summary>", "", f"```text\n{body}\n```", "", "</details>"]


def prompts(data, out):
    pol = data["ai_policy"]
    usage = asset_usage(data)
    lines = [
        "# AI 生成提示词表",
        "",
        "> 本文件由 `python3 tools/storyboard.py prompts` 从 [分镜数据](03-分镜数据.json) 生成。修改提示词请改 JSON 后重新生成，不要直接编辑本文件。",
        "",
        "## 通用规则",
        "",
        f"- **流程：** {pol['workflow']}",
        f"- **单段时长：** 每段生成不超过 {pol['max_clip_s']} 秒，成片只截取其中最稳定的部分。",
        f"- **运镜：** {pol['camera']}",
        f"- **动作：** {pol['action']}",
        f"- **构图：** {pol['framing']}",
        "- **文字：** 画面内不得出现任何可读文字、数字、Logo 或标牌；所有文字由代码后期叠加。",
        "- **组合方式：** 视频提示词 = 通用风格前缀 + 资产提示词；负面提示词 = 通用负面词 + 资产补充。不支持负面提示词的模型，在正向提示词末尾加上“画面中没有文字、Logo 和可读的屏幕”。",
        "- **语言：** 优先使用中文提示词；只支持英文的模型，展开各处的英文版本。",
        "",
        "**通用风格前缀**",
        "",
        f"```text\n{pol['style_prefix_zh']}\n```",
        *english("英文版本", pol["style_prefix_en"]),
        "",
        "**通用负面词**",
        "",
        f"```text\n{pol['negative_zh']}\n```",
        *english("英文版本", pol["negative_en"]),
        "",
        "## 资产清单",
        "",
        "| 资产 | 类型 | 必需 | 用于镜头（成片秒数） | 生成规格 |",
        "|---|---|---|---|---|",
    ]
    for name, spec in data["assets"].items():
        uses = "、".join(
            f"{sid}（{sec:.1f} 秒{'，可选' if opt else ''}）" if spec["kind"] == "video" else sid
            for sid, sec, opt in usage[name]
        )
        gen = f"{spec['gen_seconds']} 秒 · {spec['camera']}" if spec["kind"] == "video" else spec["output"]
        kind = "视频" if spec["kind"] == "video" else "静帧"
        lines.append(f"| `{name}` | {kind} | {'是' if spec['required'] else '否'} | {uses} | {gen} |")
    for name, spec in data["assets"].items():
        video = spec["kind"] == "video"
        prefix_en = pol["style_prefix_en"] + " " if video else ""
        prefix_zh = pol["style_prefix_zh"] if video else ""
        neg_en = pol["negative_en"] + (", " + spec["negative_extra_en"] if spec.get("negative_extra_en") else "")
        neg_zh = pol["negative_zh"] + ("、" + spec["negative_extra_zh"] if spec.get("negative_extra_zh") else "")
        lines += ["", f"## {name}", ""]
        if video:
            lines.append(f"- **生成：** {spec['gen_seconds']} 秒，16:9，1080p，{spec['camera']}")
        else:
            lines.append(f"- **输出：** {spec['output']}")
        lines.append(f"- **用于：** " + "、".join(f"{sid}" for sid, _, _ in usage[name]))
        if spec.get("fallback"):
            lines.append(f"- **缺省方案：** {spec['fallback']}")
        if spec.get("replace_with_R"):
            lines.append(f"- **可用实拍替换：** {spec['replace_with_R']}")
        if spec.get("after_generation"):
            lines.append(f"- **生成后：** {spec['after_generation']}")
        lines += [
            "",
            "**提示词**",
            "",
            f"```text\n{prefix_zh}{spec['prompt_zh']}\n```",
            *english("英文版本", prefix_en + spec["prompt_en"]),
            "",
            "**负面提示词**",
            "",
            f"```text\n{neg_zh}\n```",
            *english("英文版本", neg_en),
            "",
            "**验收**",
            "",
        ]
        lines += [f"- [ ] {x}" for x in spec["acceptance"]]
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"已写入 {out.relative_to(ROOT) if out.is_relative_to(ROOT) else out}")


def main(argv):
    if len(argv) < 2 or argv[1] not in ("check", "summary", "srt", "lrc", "prompts"):
        print(__doc__)
        return 2
    data = load()
    cmd = argv[1]
    if cmd == "check":
        errors, warnings = check(data)
        for w in warnings:
            print("提醒：" + w)
        for e in errors:
            print("错误：" + e)
        if errors:
            return 1
        print(f"通过：{len(data['shots'])} 镜，{data['format']['duration_s']} 秒，{len(data['assets'])} 个 AI 资产。")
        return 0
    if cmd == "summary":
        summary(data)
        return 0
    out = Path(argv[2]).resolve() if len(argv) > 2 else None
    if cmd == "srt":
        srt(data, out or ROOT / "build" / "subtitles.srt")
    elif cmd == "lrc":
        lrc(data, out or ROOT / "build" / "subtitles.lrc")
    else:
        prompts(data, out or ROOT / "docs" / "07-AI生成提示词.md")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
