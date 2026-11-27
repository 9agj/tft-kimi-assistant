#!/usr/bin/env bash
# 启动 → 进程在 → 本地服务能返回首页与 manifest
cd "$(dirname "$0")" && . ./_lib.sh
need_device; echo "[t01] 启动与本地服务"
install_apk
launch || finish
port=$(app_port) && pass "进程 $(app_pid)，端口 $port" || fail "没拿到监听端口"
[ -n "${port:-}" ] || finish
r=$(http_probe "$port" /)
case "$r" in 200*text/html*) pass "首页 / → $r" ;; *) fail "首页 / → $r" ;; esac
r=$(http_probe "$port" /api/manifest.json)
case "$r" in 200*json*) pass "manifest → $r" ;; *) fail "manifest → $r" ;; esac
n=$(crashed_since_launch)
[ "${n:-0}" = "0" ] && pass "无崩溃记录" || fail "crash buffer 有 $n 条 $PKG 记录"
finish
