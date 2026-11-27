#!/usr/bin/env bash
# 断网后仍能启动并读到包内快照（不依赖云端）
cd "$(dirname "$0")" && . ./_lib.sh
need_device; echo "[t02] 离线启动"
sh_run "svc wifi disable; svc data disable" >/dev/null
sleep 2
launch || { sh_run "svc wifi enable; svc data enable" >/dev/null; finish; }
port=$(app_port)
if [ -n "${port:-}" ]; then
  r=$(http_probe "$port" /api/manifest.json)
  case "$r" in 200*json*) pass "离线时 manifest 仍可用 → $r" ;; *) fail "离线时 manifest → $r" ;; esac
else
  fail "离线时没起本地服务"
fi
sh_run "svc wifi enable; svc data enable" >/dev/null
pass "已恢复网络"
finish
