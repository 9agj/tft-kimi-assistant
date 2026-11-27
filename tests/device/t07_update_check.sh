#!/usr/bin/env bash
# 启动自检必须在日志里留下「本地 X，远端 Y」，否则说明检查没跑或失败被吞
cd "$(dirname "$0")" && . ./_lib.sh
need_device; echo "[t07] 更新自检日志"
sh_run "logcat -c" >/dev/null
launch || finish
line=""
for i in $(seq 1 12); do
  line=$(sh_run "logcat -d -s KimiUpdate" | grep -E "启动检查|启动检查失败" | tail -1)
  [ -n "$line" ] && break
  sleep 2
done
if [ -n "$line" ]; then
  pass "日志：$line"
  case "$line" in *失败*) info "网络不通时失败属预期，但必须留痕" ;; esac
else
  fail "15 秒内没有 KimiUpdate 日志（检查可能没触发）"
fi
finish
