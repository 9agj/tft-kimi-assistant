package com.kimi.tft;

import android.app.Activity;
import android.content.*;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.webkit.*;
import android.widget.Toast;
import org.json.JSONObject;

public final class MainActivity extends Activity {
    private WebView web;
    private AppRuntime runtime;
    private String pendingComp;
    private String pendingTitle;

    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        if (saved != null) { pendingComp = saved.getString("pendingComp"); pendingTitle = saved.getString("pendingTitle"); }
        getWindow().setStatusBarColor(Color.rgb(17, 23, 34));
        getWindow().setNavigationBarColor(Color.rgb(22, 32, 49));
        getWindow().getDecorView().setSystemUiVisibility(0);
        try {
            runtime = AppRuntime.get(this);
            web = new WebView(this);
            web.setBackgroundColor(Color.rgb(17, 23, 34));
            WebSettings settings = web.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setAllowFileAccess(false);
            settings.setAllowContentAccess(false);
            settings.setTextZoom(100);
            settings.setMediaPlaybackRequiresUserGesture(true);
            web.setWebViewClient(new WebViewClient() {
                @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    Uri uri = request.getUrl();
                    if (uri.toString().startsWith(runtime.baseUrl())) return false;
                    if ("https".equals(uri.getScheme())) openExternal(uri.toString());
                    return true;
                }
                @Override public void onPageFinished(WebView view, String url) {
                    runtime.data.sync(false, (changed, message) -> {
                        if (changed) runOnUiThread(() -> { if (web != null) web.reload(); });
                        else notifySync(false, message);
                    });
                }
            });
            web.setWebChromeClient(new WebChromeClient() {
                @Override public boolean onConsoleMessage(ConsoleMessage message) {
                    android.util.Log.i("KimiWeb", message.messageLevel() + ": " + message.message());
                    return true;
                }
            });
            web.addJavascriptInterface(new Bridge(), "Kimi");
            setContentView(web);
            web.loadUrl(runtime.baseUrl());
        } catch (Exception e) {
            android.widget.TextView error = new android.widget.TextView(this);
            error.setText("初始化出现问题：" + e.getMessage());
            error.setPadding(24, 48, 24, 24);
            setContentView(error);
        }
    }

    @Override protected void onResume() {
        super.onResume();
        if (pendingComp != null && Settings.canDrawOverlays(this)) {
            String id = pendingComp, title = pendingTitle;
            pendingComp = null;
            showOverlay(id, title);
        }
    }
    @Override public void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        state.putString("pendingComp", pendingComp);
        state.putString("pendingTitle", pendingTitle);
    }

    private void showOverlay(String compId, String title) {
        if (compId == null || !compId.matches("comp_19_[0-9]+_[0-9]+_pbe")) return;
        if (!Settings.canDrawOverlays(this)) {
            pendingComp = compId;
            pendingTitle = title;
            Toast.makeText(this, "请开启显示在其他应用上层，返回后自动打开阵容窗", Toast.LENGTH_LONG).show();
            startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName())));
            return;
        }
        Intent intent = new Intent(this, OverlayService.class).putExtra("compId", compId).putExtra("title", title);
        startForegroundService(intent);
    }

    private void notifySync(boolean changed, String message) {
        runOnUiThread(() -> {
            if (web == null || isDestroyed()) return;
            String detail = "{\"changed\":" + changed + ",\"message\":" + JSONObject.quote(message) + "}";
            web.evaluateJavascript("window.dispatchEvent(new CustomEvent('kimi-sync-finished',{detail:" + detail + "}))", null);
        });
    }
    private void openExternal(String url) {
        if (!url.startsWith("https://")) return;
        runOnUiThread(() -> {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); }
            catch (Exception e) { Toast.makeText(this, "请使用浏览器打开链接", Toast.LENGTH_SHORT).show(); }
        });
    }

    public final class Bridge {
        @JavascriptInterface public String getVersion() { return "1.2.1"; }
        @JavascriptInterface public String getDataStatus() { return runtime.data.status(); }
        @JavascriptInterface public boolean hasOverlayPermission() { return Settings.canDrawOverlays(MainActivity.this); }
        @JavascriptInterface public void requestOverlayPermission() { runOnUiThread(() -> startActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + getPackageName())))); }
        @JavascriptInterface public void openOverlay(String compId, String title) { runOnUiThread(() -> showOverlay(compId, title)); }
        @JavascriptInterface public void closeOverlay() { stopService(new Intent(MainActivity.this, OverlayService.class)); }
        @JavascriptInterface public void syncData() { runtime.data.sync(true, (changed, message) -> notifySync(changed, message)); }
        @JavascriptInterface public void copyText(String text) { runOnUiThread(() -> ((ClipboardManager) getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("S19 阵容", text))); }
        @JavascriptInterface public void minimize() { runOnUiThread(() -> moveTaskToBack(true)); }
        @JavascriptInterface public void exit() { runOnUiThread(() -> finish()); }
        @JavascriptInterface public void openExternal(String url) { MainActivity.this.openExternal(url); }
    }

    @Override public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript("(()=>{const b=document.querySelector('[aria-label=\"返回阵容\"],[aria-label=\"关闭设置\"]');if(b){b.click();return true}return false})()", result -> {
            if (!"true".equals(result)) moveTaskToBack(true);
        });
    }
    @Override public void onDestroy() {
        if (web != null) { web.removeJavascriptInterface("Kimi"); web.destroy(); web = null; }
        super.onDestroy();
    }
}
