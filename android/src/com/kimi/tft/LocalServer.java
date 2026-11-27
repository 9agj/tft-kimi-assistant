package com.kimi.tft;

import android.content.Context;
import android.util.Log;
import java.io.*;
import java.net.*;
import java.util.Locale;
import java.util.concurrent.*;

public final class LocalServer {
    private final Context context;
    private final DataSync data;
    private final int port;
    private ServerSocket listener;
    private final ExecutorService workers = Executors.newFixedThreadPool(4);

    public LocalServer(Context context, DataSync data, int port) {
        this.context = context;
        this.data = data;
        this.port = port;
    }
    public void start() throws IOException {
        listener = new ServerSocket(port, 32, InetAddress.getByName("127.0.0.1"));
        Thread accept = new Thread(() -> {
            while (!listener.isClosed()) {
                try { Socket client = listener.accept(); workers.execute(() -> handle(client)); }
                catch (IOException e) { Log.w("KimiHttp", e.toString()); break; }
            }
        }, "kimi-http");
        accept.setDaemon(true);
        accept.start();
        Log.i("KimiHttp", "listening on 127.0.0.1:" + getPort());
    }
    public int getPort() { return listener.getLocalPort(); }

    private void handle(Socket socket) {
        try (Socket client = socket) {
            client.setSoTimeout(8000);
            BufferedReader reader = new BufferedReader(new InputStreamReader(client.getInputStream(), "UTF-8"));
            String line = reader.readLine();
            if (line == null || line.length() > 8192) return;
            String[] request = line.split(" ");
            if (request.length < 2) return;
            for (int n = 0; n < 64; n++) { String h = reader.readLine(); if (h == null || h.isEmpty()) break; }
            String method = request[0];
            if (!method.equals("GET") && !method.equals("HEAD")) { reply(client, 405, "text/plain", "Method not allowed".getBytes("UTF-8"), false); return; }
            String p = URLDecoder.decode(request[1].split("\\?", 2)[0], "UTF-8");
            if (p.contains("..") || p.contains("\\") || p.indexOf(0) >= 0) { reply(client, 400, "text/plain", new byte[0], false); return; }
            if (p.equals("/")) p = "/index.html";
            byte[] bytes;
            String resolved = p;
            if (p.startsWith("/api/")) {
                String name = p.substring(5);
                if (name.equals("manifest.json")) bytes = data.status().getBytes("UTF-8");
                else {
                    if (name.equals("unit-items")) name = "unitItems";
                    if (!name.endsWith(".json")) name += ".json";
                    bytes = data.readApi(name);
                }
                resolved = name.endsWith(".json") ? name : name + ".json";
            } else {
                String asset = p.startsWith("/cdn/") || p.startsWith("/art/") ? p.substring(1) : "www" + p;
                bytes = readAsset(asset);
                if (bytes == null && asset.endsWith(".png")) {
                    String webp = asset.substring(0, asset.length() - 4) + ".webp";
                    bytes = readAsset(webp);
                    if (bytes != null) resolved = webp;
                }
            }
            if (bytes == null) { reply(client, 404, "application/json", "{\"success\":false,\"message\":\"Resource not found\"}".getBytes("UTF-8"), false); return; }
            reply(client, 200, mime(resolved), bytes, method.equals("HEAD"));
        } catch (Exception e) { Log.w("KimiHttp", e.getMessage() == null ? "Request ended" : e.getMessage()); }
    }

    private byte[] readAsset(String name) {
        try (InputStream input = context.getAssets().open(name)) { return DataSync.bytes(input, 32 * 1024 * 1024); }
        catch (IOException e) { return null; }
    }
    private static String mime(String p) {
        String ext = p.substring(p.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        switch (ext) {
            case "html": return "text/html; charset=utf-8";
            case "js": case "mjs": return "application/javascript; charset=utf-8";
            case "css": return "text/css; charset=utf-8";
            case "json": return "application/json; charset=utf-8";
            case "png": return "image/png";
            case "jpg": case "jpeg": return "image/jpeg";
            case "webp": return "image/webp";
            case "svg": return "image/svg+xml";
            case "woff2": return "font/woff2";
            default: return "application/octet-stream";
        }
    }
    private static void reply(Socket client, int code, String mime, byte[] body, boolean head) throws IOException {
        OutputStream output = new BufferedOutputStream(client.getOutputStream());
        String headers = "HTTP/1.1 " + code + " " + (code == 200 ? "OK" : "Error") + "\r\nContent-Type: " + mime
            + "\r\nContent-Length: " + body.length + "\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n";
        output.write(headers.getBytes("UTF-8"));
        if (!head) output.write(body);
        output.flush();
    }
}
