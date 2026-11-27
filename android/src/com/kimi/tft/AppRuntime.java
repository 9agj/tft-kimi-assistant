package com.kimi.tft;

import android.content.Context;
import android.content.SharedPreferences;
import java.io.IOException;

public final class AppRuntime {
    private static AppRuntime instance;
    public final LocalServer server;
    public final DataSync data;

    private AppRuntime(Context context) throws IOException {
        Context app = context.getApplicationContext();
        data = new DataSync(app);
        SharedPreferences prefs = app.getSharedPreferences("kimi", Context.MODE_PRIVATE);
        int saved = prefs.getInt("http-port", 0);
        LocalServer candidate = new LocalServer(app, data, saved);
        try { candidate.start(); }
        catch (IOException e) { candidate = new LocalServer(app, data, 0); candidate.start(); }
        server = candidate;
        prefs.edit().putInt("http-port", server.getPort()).apply();
    }

    public static synchronized AppRuntime get(Context context) throws IOException {
        if (instance == null) instance = new AppRuntime(context);
        return instance;
    }

    public String baseUrl() { return "http://127.0.0.1:" + server.getPort() + "/"; }
}
