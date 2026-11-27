#!/usr/bin/env bash
# 图片回落：请求 .png 时应拿到 image/webp；真 PNG 不受影响
cd "$(dirname "$0")" && . ./_lib.sh
need_device; echo "[t03] 图片 WebP 回落"
launch || finish
port=$(app_port); [ -n "${port:-}" ] || finish
r=$(http_probe "$port" /cdn/file/metatft/frames/prismatic.png)
case "$r" in 200*webp*) pass "prismatic.png → $r" ;; *) fail "prismatic.png → $r" ;; esac
r=$(http_probe "$port" /cdn/file/metatft/placeholder.png)
case "$r" in 200*"image/png"*) pass "placeholder.png 仍为 png → $r" ;; *) fail "placeholder.png → $r" ;; esac
r=$(http_probe "$port" /art/hachimi.png)
case "$r" in 200*webp*) pass "hachimi.png → $r" ;; *) fail "hachimi.png → $r" ;; esac
finish
