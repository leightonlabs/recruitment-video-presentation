#!/usr/bin/env bash
# 兼容旧用法：转给跨平台的 build.mjs。./render/build.sh [并行数]；CLEAN=1 ./render/build.sh 为精修版。
exec node "$(dirname "$0")/build.mjs" "$@"
