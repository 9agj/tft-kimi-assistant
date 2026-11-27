package com.kimi.tft;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.graphics.*;
import android.graphics.drawable.*;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.io.InputStream;

public final class OverlayService extends Service {
    private WindowManager windows;
    private WindowManager.LayoutParams params;
    private LinearLayout panel;
    private ImageView ball;
    private WebView web;
    private SharedPreferences prefs;
    private boolean collapsed;
    private int savedWidth, savedHeight;
    private AppRuntime runtime;
    private int screenWidth, screenHeight;

    @Override public void onCreate() {
        super.onCreate();
        windows = (WindowManager) getSystemService(WINDOW_SERVICE);
        prefs = getSharedPreferences("kimi-overlay", MODE_PRIVATE);
        updateBounds();
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        manager.createNotificationChannel(new NotificationChannel("kimi-overlay", "阵容悬浮窗", NotificationManager.IMPORTANCE_LOW));
        Intent home = new Intent(this, MainActivity.class);
        PendingIntent open = PendingIntent.getActivity(this, 10, home, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        PendingIntent stop = PendingIntent.getService(this, 11, new Intent(this, OverlayService.class).setAction("STOP"), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification note = new Notification.Builder(this, "kimi-overlay")
            .setSmallIcon(android.R.drawable.ic_menu_view).setContentTitle("tft基米助手 · 阵容悬浮窗")
            .setContentText("拖动标题移动，右下角调整大小；点猫咪收起或展开")
            .setContentIntent(open).setOngoing(true).addAction(new Notification.Action.Builder(null, "关闭悬浮窗", stop).build()).build();
        if (Build.VERSION.SDK_INT >= 34) startForeground(19, note, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        else startForeground(19, note);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "STOP".equals(intent.getAction())) { stopSelf(); return START_NOT_STICKY; }
        if (!Settings.canDrawOverlays(this)) { stopSelf(); return START_NOT_STICKY; }
        try {
            runtime = AppRuntime.get(this);
            String comp = intent == null ? prefs.getString("comp", "") : intent.getStringExtra("compId");
            if (comp == null || !comp.matches("comp_19_[0-9]+_[0-9]+_pbe")) { stopSelf(); return START_NOT_STICKY; }
            prefs.edit().putString("comp", comp).apply();
            if (panel == null) buildPanel();
            if (collapsed) expand();
            web.loadUrl(runtime.baseUrl() + "overlay.html?comp=" + comp);
        } catch (Exception e) { android.util.Log.e("KimiOverlay", "Overlay start", e); stopSelf(); }
        return START_NOT_STICKY;
    }

    private void buildPanel() throws Exception {
        savedWidth = Math.min(screenWidth - dp(12), Math.max(dp(260), prefs.getInt("width", dp(352))));
        savedHeight = Math.min(screenHeight - dp(36), Math.max(dp(220), prefs.getInt("height", dp(470))));
        params = new WindowManager.LayoutParams(savedWidth, savedHeight, WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN, PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.LEFT;
        params.x = prefs.getInt("x", dp(12));
        params.y = prefs.getInt("y", dp(110));
        params.alpha = Math.max(.45f, Math.min(1f, prefs.getFloat("alpha", 1f)));
        panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setBackground(background(0xff111722, 16));
        panel.setElevation(dp(12));
        panel.setClipToOutline(true);

        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(10), dp(4), dp(4), dp(4));
        header.setBackgroundColor(0xff223047);
        ImageView cat = cat();
        header.addView(cat, new LinearLayout.LayoutParams(dp(30), dp(30)));
        cat.setContentDescription("收起为哈基米悬浮球");
        cat.setOnClickListener(v -> collapse());
        TextView title = label("S19 · 阵容窗", 13, 0xfff1f5fb);
        title.setPadding(dp(8), 0, 0, 0);
        header.addView(title, new LinearLayout.LayoutParams(0, dp(36), 1));
        TextView hide = label("－", 22, 0xffc9d9ee);
        hide.setContentDescription("收起悬浮窗");
        header.addView(hide, new LinearLayout.LayoutParams(dp(36), dp(36)));
        hide.setOnClickListener(v -> collapse());
        TextView close = label("×", 24, 0xffffb6b1);
        close.setContentDescription("关闭悬浮窗");
        header.addView(close, new LinearLayout.LayoutParams(dp(36), dp(36)));
        close.setOnClickListener(v -> stopSelf());
        title.setOnTouchListener(drag(false));
        header.setOnTouchListener(drag(false));
        panel.addView(header, new LinearLayout.LayoutParams(-1, dp(44)));

        web = new WebView(this);
        web.setBackgroundColor(0xff111722);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.getSettings().setTextZoom(100);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return !request.getUrl().toString().startsWith(runtime.baseUrl()); }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage message) { android.util.Log.i("KimiOverlayWeb", message.message()); return true; }
        });
        panel.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));

        LinearLayout footer = new LinearLayout(this);
        footer.setGravity(Gravity.CENTER_VERTICAL);
        footer.setBackgroundColor(0xff223047);
        footer.setPadding(dp(10), 0, dp(3), 0);
        TextView opacity = label("透明度", 11, 0xffc9d9ee);
        footer.addView(opacity, new LinearLayout.LayoutParams(dp(48), dp(32)));
        SeekBar alpha = new SeekBar(this);
        alpha.setMax(55);
        alpha.setProgress(Math.round(params.alpha * 100) - 45);
        alpha.setProgressTintList(android.content.res.ColorStateList.valueOf(0xff75cfbf));
        alpha.setThumbTintList(android.content.res.ColorStateList.valueOf(0xff75cfbf));
        alpha.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            public void onStartTrackingTouch(SeekBar view) {}
            public void onStopTrackingTouch(SeekBar view) { remember(); }
            public void onProgressChanged(SeekBar view, int progress, boolean user) { if (user) { params.alpha = (45 + progress) / 100f; update(panel); } }
        });
        footer.addView(alpha, new LinearLayout.LayoutParams(0, dp(32), 1));
        TextView resize = label("↘", 22, 0xffa5d9ee);
        resize.setContentDescription("拖动调整悬浮窗大小");
        resize.setOnTouchListener(new View.OnTouchListener() {
            float downX, downY; int width, height;
            public boolean onTouch(View view, MotionEvent event) {
                if (event.getActionMasked() == MotionEvent.ACTION_DOWN) { downX = event.getRawX(); downY = event.getRawY(); width = params.width; height = params.height; return true; }
                if (event.getActionMasked() == MotionEvent.ACTION_MOVE) {
                    params.width = Math.max(dp(250), Math.min(screenWidth - params.x - dp(5), width + Math.round(event.getRawX() - downX)));
                    params.height = Math.max(dp(210), Math.min(screenHeight - params.y - dp(10), height + Math.round(event.getRawY() - downY)));
                    savedWidth = params.width; savedHeight = params.height; clamp(); update(panel); return true;
                }
                if (event.getActionMasked() == MotionEvent.ACTION_UP) { remember(); return true; }
                return true;
            }
        });
        footer.addView(resize, new LinearLayout.LayoutParams(dp(36), dp(32)));
        panel.addView(footer, new LinearLayout.LayoutParams(-1, dp(32)));
        clamp();
        windows.addView(panel, params);
    }

    private View.OnTouchListener drag(boolean clickBall) {
        return new View.OnTouchListener() {
            float x, y; int oldX, oldY; boolean moved;
            public boolean onTouch(View view, MotionEvent event) {
                switch (event.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN: x = event.getRawX(); y = event.getRawY(); oldX = params.x; oldY = params.y; moved = false; return true;
                    case MotionEvent.ACTION_MOVE:
                        float dx = event.getRawX() - x, dy = event.getRawY() - y;
                        moved |= Math.abs(dx) + Math.abs(dy) > dp(5);
                        params.x = oldX + Math.round(dx); params.y = oldY + Math.round(dy); clamp(); update(collapsed ? ball : panel); return true;
                    case MotionEvent.ACTION_UP: remember(); if (clickBall && !moved) expand(); return true;
                    default: return true;
                }
            }
        };
    }
    private void collapse() {
        if (collapsed || panel == null) return;
        savedWidth = params.width; savedHeight = params.height; remember();
        windows.removeView(panel);
        params.width = dp(54); params.height = dp(54);
        ball = cat();
        ball.setBackground(background(0xff223047, 27));
        ball.setPadding(dp(4), dp(4), dp(4), dp(4));
        ball.setElevation(dp(9));
        ball.setContentDescription("哈基米悬浮球，点击展开阵容");
        ball.setOnTouchListener(drag(true));
        collapsed = true;
        clamp(); windows.addView(ball, params);
    }
    private void expand() {
        if (!collapsed || panel == null) return;
        windows.removeView(ball); ball = null;
        params.width = Math.min(savedWidth, screenWidth - dp(8)); params.height = Math.min(savedHeight, screenHeight - dp(36));
        savedWidth = params.width; savedHeight = params.height;
        collapsed = false; clamp(); windows.addView(panel, params);
    }
    private void update(View view) { if (view != null && view.isAttachedToWindow()) windows.updateViewLayout(view, params); }
    private void remember() { prefs.edit().putInt("x", params.x).putInt("y", params.y).putInt("width", savedWidth).putInt("height", savedHeight).putFloat("alpha", params.alpha).apply(); }
    private void clamp() { params.x = Math.max(0, Math.min(screenWidth - params.width, params.x)); params.y = Math.max(dp(20), Math.min(screenHeight - params.height - dp(16), params.y)); }
    private void updateBounds() { android.util.DisplayMetrics metrics = getResources().getDisplayMetrics(); screenWidth = metrics.widthPixels; screenHeight = metrics.heightPixels; }
    @Override public void onConfigurationChanged(android.content.res.Configuration configuration) { super.onConfigurationChanged(configuration); updateBounds(); if (params != null) { if (!collapsed) { params.width = Math.min(params.width, screenWidth - dp(8)); params.height = Math.min(params.height, screenHeight - dp(36)); } clamp(); update(collapsed ? ball : panel); } }
    private int dp(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }
    private GradientDrawable background(int color, int radius) { GradientDrawable bg = new GradientDrawable(); bg.setColor(color); bg.setCornerRadius(dp(radius)); bg.setStroke(dp(1), 0xff52657f); return bg; }
    private TextView label(String text, int size, int color) { TextView view = new TextView(this); view.setText(text); view.setTextSize(size); view.setTextColor(color); view.setGravity(Gravity.CENTER_VERTICAL | Gravity.CENTER_HORIZONTAL); return view; }
    private ImageView cat() {
        ImageView image = new ImageView(this); image.setScaleType(ImageView.ScaleType.CENTER_CROP);
        try (InputStream input = getAssets().open("art/hachimi.png")) { image.setImageBitmap(BitmapFactory.decodeStream(input)); } catch (Exception ignored) {}
        image.setBackground(background(0xff223047, 12)); image.setClipToOutline(true); return image;
    }
    @Override public void onDestroy() {
        if (params != null) remember();
        try { if (ball != null && ball.isAttachedToWindow()) windows.removeView(ball); if (panel != null && panel.isAttachedToWindow()) windows.removeView(panel); } catch (Exception ignored) {}
        if (web != null) web.destroy();
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
