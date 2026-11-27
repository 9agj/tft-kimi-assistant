#!/usr/bin/env bash
# 连续两次启动应拿到可用端口并正常服务（端口被旧进程占住时能换）
cd "$(dirname "$0")" && . ./_lib.sh
need_device; echo "[t04] 端口重绑"
launch || finish
p1=$(app_port); [ -n "${p1:-}" ] && pass "第一次端口 $p1" || fail "第一次没端口"
launch || finish
p2=$(app_port); [ -n "${p2:-}" ] && pass "第二次端口 $p2" || fail "第二次没端口"
if [ -n "${p2:-}" ]; then
  r=$(http_probe "$p2" /api/manifest.json)
  case "$r" in 200*json*) pass "重启后服务正常 → $r" ;; *) fail "重启后 → $r" ;; esac
fi
finish
