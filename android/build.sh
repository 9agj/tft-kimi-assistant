#!/usr/bin/env bash
set -u
ROOT=${KIMI_ROOT:-/opt/tft-kimi}
SDK=${SDK:-/root/android-sdk}
BT="$SDK/build-tools/35.0.0"
JAR="$SDK/platforms/android-34/android.jar"
WORK="$ROOT/build"
SRC="$ROOT/android"
OUT="$ROOT/out"
KS="$ROOT/signing/kimi.jks"
APK="$OUT/tft基米助手-v1.2.1.apk"
fail() { printf 'Build failed: %s\n' "$1" >&2; exit 1; }

# 签名库口令：只从环境变量或受保护的 env 文件读取，禁止写进本脚本
ENVF=${KIMI_SIGNING_ENV:-$ROOT/signing/signing.env}
if [ -f "$ENVF" ]; then
  set -a
  . "$ENVF"
  set +a
fi
[ -n "${KIMI_STORE_PASS:-}" ] || fail "缺少 KIMI_STORE_PASS：请在 $ENVF 中设置，或导出该环境变量"
mkdir -p "$WORK" "$OUT" "$ROOT/signing"
rm -rf "$WORK/compiled" "$WORK/gen" "$WORK/classes" "$WORK/dex"
mkdir -p "$WORK/compiled" "$WORK/gen" "$WORK/classes" "$WORK/dex"
printf 'Android resources\n'
"$BT/aapt2" compile --dir "$SRC/res" -o "$WORK/compiled/res.zip" || fail resources
"$BT/aapt2" link -o "$WORK/base.apk" -I "$JAR" --manifest "$SRC/AndroidManifest.xml" -R "$WORK/compiled/res.zip" --java "$WORK/gen" -A "$SRC/assets" --auto-add-overlay || fail link
CLOUD_URL=${KIMI_CLOUD_URL:-https://example.com/tft-kimi/}
case "$CLOUD_URL" in */) ;; *) CLOUD_URL="$CLOUD_URL/" ;; esac
mkdir -p "$WORK/gen/com/kimi/tft"
cat > "$WORK/gen/com/kimi/tft/CloudConfig.java" <<EOF
package com.kimi.tft;

final class CloudConfig {
    static final String BASE = "$CLOUD_URL";

    private CloudConfig() {}
}
EOF
printf 'Java and dex\n'
find "$SRC/src" "$WORK/gen" -name '*.java' > "$WORK/sources.txt"
javac -encoding UTF-8 --release 8 -nowarn -classpath "$JAR" -d "$WORK/classes" @"$WORK/sources.txt" || fail javac
find "$WORK/classes" -name '*.class' > "$WORK/classes.txt"
"$BT/d8" --release --min-api 26 --lib "$JAR" --output "$WORK/dex" @"$WORK/classes.txt" || fail dex
cp "$WORK/base.apk" "$WORK/unsigned.apk"
pushd "$WORK/dex" >/dev/null
zip -q -X "$WORK/unsigned.apk" classes.dex || fail zip
popd >/dev/null
"$BT/zipalign" -f -p 4 "$WORK/unsigned.apk" "$WORK/aligned.apk" || fail align
if [ ! -f "$KS" ]; then
  keytool -genkeypair -storetype PKCS12 -keystore "$KS" -alias kimi -keyalg RSA -keysize 3072 -validity 10000 -storepass "$KIMI_STORE_PASS" -keypass "$KIMI_STORE_PASS" -dname 'CN=TFT Kimi, OU=Personal, O=Kimi, C=CN' || fail keystore
  chmod 600 "$KS"
fi
"$BT/apksigner" sign --ks "$KS" --ks-key-alias kimi --ks-pass env:KIMI_STORE_PASS --key-pass env:KIMI_STORE_PASS --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true --out "$APK" "$WORK/aligned.apk" || fail signing
"$BT/apksigner" verify --print-certs "$APK" || fail verification
"$BT/aapt2" dump badging "$APK" | head -5
sha256sum "$APK"
ls -lh "$APK"
