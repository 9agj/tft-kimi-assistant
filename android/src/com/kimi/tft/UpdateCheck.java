package com.kimi.tft;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.net.Uri;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.Charset;

/**
 * 启动时比对 GitHub 最新 Release 与本地版本，发现新版本时提示打开下载页。
 * 只做“发现新版本 → 打开下载页”，不下载、不安装。
 */
final class UpdateCheck {
    private static final String API = "https://api.github.com/repos/9agj/tft-kimi-assistant/releases/latest";
    private static final String PREFS = "kimi-update";
    private static final String KEY_IGNORED = "ignoredVersion";
    private static final int TIMEOUT_MS = 8000;
    private static final int MAX_BYTES = 64 * 1024;

    private UpdateCheck() {}

    /** 读取当前安装包的 versionName；失败返回空串。 */
    static String currentVersion(Context ctx) {
        try {
            PackageInfo info = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            return info.versionName == null ? "" : info.versionName;
        } catch (Exception e) {
            return "";
        }
    }

    static void check(final Activity activity) {
        final String current = currentVersion(activity);
        if (current.isEmpty()) return;
        final SharedPreferences prefs = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        Thread t = new Thread(new Runnable() {
            @Override public void run() {
                String[] latest = fetchLatest();
                if (latest == null) return;
                final String version = latest[0];
                final String page = latest[1];
                if (version.isEmpty() || page.isEmpty()) return;
                if (compare(version, current) <= 0) return;
                if (version.equals(prefs.getString(KEY_IGNORED, ""))) return;
                activity.runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (activity.isFinishing()) return;
                        new AlertDialog.Builder(activity)
                            .setTitle("发现新版本 v" + version)
                            .setMessage("当前版本 " + current + "，可前往 GitHub Releases 下载安装。")
                            .setPositiveButton("打开下载页", new DialogInterface.OnClickListener() {
                                @Override public void onClick(DialogInterface dialog, int which) {
                                    try {
                                        activity.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(page)));
                                    } catch (Exception ignored) {}
                                }
                            })
                            .setNeutralButton("忽略此版本", new DialogInterface.OnClickListener() {
                                @Override public void onClick(DialogInterface dialog, int which) {
                                    prefs.edit().putString(KEY_IGNORED, version).apply();
                                }
                            })
                            .setNegativeButton("稍后", null)
                            .show();
                    }
                });
            }
        }, "KimiUpdate");
        t.setDaemon(true);
        t.start();
    }

    /** 返回 {版本号(去 v 前缀), 发布页 URL}；任何失败返回 null。 */
    private static String[] fetchLatest() {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(API).openConnection();
            conn.setConnectTimeout(TIMEOUT_MS);
            conn.setReadTimeout(TIMEOUT_MS);
            conn.setRequestProperty("User-Agent", "tft-kimi-android/1.0");
            conn.setRequestProperty("Accept", "application/vnd.github+json");
            if (conn.getResponseCode() != 200) return null;
            InputStream in = conn.getInputStream();
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] chunk = new byte[4096];
            int n;
            while ((n = in.read(chunk)) > 0) {
                buf.write(chunk, 0, n);
                if (buf.size() > MAX_BYTES) return null;
            }
            in.close();
            JSONObject json = new JSONObject(new String(buf.toByteArray(), Charset.forName("UTF-8")));
            String tag = json.optString("tag_name", "");
            String page = json.optString("html_url", "");
            if (tag.startsWith("v") || tag.startsWith("V")) tag = tag.substring(1);
            return new String[] { tag.trim(), page.trim() };
        } catch (Exception e) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    /** 按点分数字段比较；非法输入一律视为不大于。 */
    static int compare(String a, String b) {
        String[] x = a.split("\\.");
        String[] y = b.split("\\.");
        int len = Math.max(x.length, y.length);
        for (int i = 0; i < len; i++) {
            int xi = parse(x, i);
            int yi = parse(y, i);
            if (xi != yi) return xi > yi ? 1 : -1;
        }
        return 0;
    }

    private static int parse(String[] parts, int i) {
        if (i >= parts.length) return 0;
        try {
            return Integer.parseInt(parts[i].trim());
        } catch (Exception e) {
            return 0;
        }
    }
}
