#!/usr/bin/env bash
# 真机验收总入口：按顺序跑 t0*.sh，任一失败即记入汇总。
#   ./run.sh                 跑全部
#   ./run.sh t03 t07         只跑指定几个
#   APK=/path/app.apk ./run.sh   先装再测
cd "$(dirname "$0")" || exit 2
export ADB="${ADB:-adb}"
if [ $# -gt 0 ]; then
  files=""
  for t in "$@"; do files="$files $(ls ${t}*.sh 2>/dev/null)"; done
else
  files=$(ls t0*.sh | sort)
fi
failed=""
for f in $files; do
  bash "./$f" || failed="$failed $(basename "$f")"
  echo
done
if [ -n "$failed" ]; then
  echo "失败项：$failed"
  exit 1
fi
echo "全部通过"
