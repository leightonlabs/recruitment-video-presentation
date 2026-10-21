#!/usr/bin/env bash
# 一键生成粗剪：字体 → 占位主图 → 逐帧画面 → 临时音轨 → 字幕 → 合成成片。
# 用法：./render/build.sh [并行数，默认 4]
set -euo pipefail
cd "$(dirname "$0")/.."
WORKERS=${1:-4}
OUT=build/roughcut
NAME="build/粗剪-v4-150秒"

[ -d render/node_modules/three ] || (cd render && npm install --silent)
./render/fetch_fonts.sh > /dev/null
python3 tools/storyboard.py check
node render/render.mjs hero
node render/render.mjs video "$WORKERS"
python3 render/audio.py
python3 tools/storyboard.py srt "$OUT/subs.srt"
python3 render/subs.py "$OUT/subs.srt" "$OUT/subs.ass"

ffmpeg -y -loglevel error -i "$OUT/video.mp4" -i "$OUT/audio.wav" \
  -vf "ass=$OUT/subs.ass:fontsdir=build/fonts" \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 256k -shortest -movflags +faststart \
  "$NAME.mp4"
ffmpeg -y -loglevel error -i "$NAME.mp4" -vf scale=1280:720 \
  -c:v libx264 -preset medium -crf 24 -c:a aac -b:a 160k -movflags +faststart "$NAME-720p.mp4"
ls -lh "$NAME.mp4" "$NAME-720p.mp4"
