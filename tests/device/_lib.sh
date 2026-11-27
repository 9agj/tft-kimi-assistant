#!/usr/bin/env bash
# 真机验收脚本公共库：所有 t0X_*.sh 都 source 它。
# 需要：adb 可用、设备已连接、App 已安装（01 会自己装）。
set -uo pipefail

PKG="${PKG:-com.kimi.tft}"
ACTIVITY="${ACTIVITY:-com.kimi.tft/.MainActivity}"
ADB="${ADB:-adb}"
APK="${APK:-}"

pass() { printf '  \033[32mPASS\033[0m %s\n' "$*"; }
fail() { printf '  \033[31mFAIL\033[0m %s\n' "$*"; FAILED=1; }
info() { printf '  ---- %s\n' "$*"; }
FAILED=${FAILED:-0}

sh_run() { "$ADB" shell "$@" 2>/dev/null | tr -d '\r' | grep -v '^\[EXIT='; }

need_device() {
  if ! "$ADB" get-state >/dev/null 2>&1; then
    echo "没有可用的 adb 设备，先连上再跑。" >&2
    exit 2
  fi
}

install_apk() {
  [ -n "$APK" ] || return 0
  [ -f "$APK" ] || { echo "APK 不存在：$APK" >&2; exit 2; }
  sh_run "cp /sdcard/Download/$(basename "$APK") /data/local/tmp/kimi-test.apk" >/dev/null 2>&1
  local out
  out=$(sh_run "pm install -r /data/local/tmp/kimi-test.apk" | tail -1)
  case "$out" in
    Success) pass "安装 $APK" ;;
    *) fail "安装失败：$out" ;;
  esac
}

launch() {
  sh_run "am force-stop $PKG" >/dev/null
  sleep 1
  sh_run "am start -n $ACTIVITY" >/dev/null
  local i
  for i in $(seq 1 20); do
    [ -n "$(app_pid)" ] && { sleep 2; return 0; }
    sleep 1
  done
  fail "启动后 20 秒内没拿到进程"
  return 1
}

app_pid() { sh_run "pidof $PKG" | head -1; }

# App 内 LocalServer 监听的回环端口
app_port() {
  local i pid port
  for i in $(seq 1 12); do
    pid=$(app_pid)
    if [ -n "$pid" ]; then
      port=$(sh_run "ss -ltnp 2>/dev/null | grep 'pid=$pid' | grep -o ':[0-9]* ' | tr -d ': '" | head -1)
      if [ -n "$port" ]; then echo "$port"; return 0; fi
    fi
    sleep 1
  done
  return 1
}

# 用 App 自己的 curl 打本地服务：http_probe <port> <path> → "code type size"
http_probe() {
  local port=$1 path=$2
  sh_run "curl -s -m 8 -o /dev/null -w '%{http_code} %{content_type} %{size_download}' http://127.0.0.1:$port$path"
}

version_name() { sh_run "dumpsys package $PKG | grep -m1 versionName=" | cut -d= -f2; }
version_code() { sh_run "dumpsys package $PKG | grep -m1 versionCode=" | awk '{print $1}' | cut -d= -f2; }

crashed_since_launch() {
  sh_run "logcat -d -b crash | grep -c '$PKG'" | tail -1
}

finish() {
  if [ "${FAILED:-0}" -eq 0 ]; then
    printf '  \033[32m== 全部通过 ==\033[0m\n'
    exit 0
  fi
  printf '  \033[31m== 有失败项 ==\033[0m\n'
  exit 1
}
