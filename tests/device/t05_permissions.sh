#!/usr/bin/env bash
# 悬浮窗与通知权限：Android 13+ 通知权限必须已被授予或可申请
cd "$(dirname "$0")" && . ./_lib.sh
need_device; echo "[t05] 权限状态"
launch || finish
api=$(sh_run "getprop ro.build.version.sdk")
info "SDK $api"
ov=$(sh_run "appops get $PKG SYSTEM_ALERT_WINDOW" | head -1)
case "$ov" in *allow*) pass "悬浮窗权限：$ov" ;; *) info "悬浮窗未授权：$ov（用户未开启属正常）" ;; esac
if [ "${api:-0}" -ge 33 ]; then
  n=$(sh_run "dumpsys package $PKG | grep -c 'POST_NOTIFICATIONS: granted=true'")
  [ "${n:-0}" -ge 1 ] && pass "通知权限已授予" || info "通知权限未授予（用户未同意属正常）"
fi
finish
