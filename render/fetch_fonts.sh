#!/usr/bin/env bash
# 从 Google Fonts 下载渲染所需字体（均为 SIL OFL 1.1），保存到 build/fonts。
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=build/fonts
mkdir -p "$OUT"
fetch() {  # 家族参数  输出文件名前缀  字重列表
  local query=$1 prefix=$2; shift 2
  local urls
  urls=$(curl -fsS -A curl "https://fonts.googleapis.com/css2?family=${query}" | grep -o 'https://[^)]*\.ttf')
  local i=0
  for w in "$@"; do
    i=$((i + 1))
    local file="$OUT/${prefix}-${w}.ttf"
    [ -s "$file" ] || curl -fsS "$(echo "$urls" | sed -n "${i}p")" -o "$file"
  done
}
fetch "Noto+Sans+SC:wght@400;700;900" NotoSansSC 400 700 900
fetch "JetBrains+Mono:wght@400;700" JetBrainsMono 400 700
fetch "Long+Cang" LongCang 400
ls -1 "$OUT"
