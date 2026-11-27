package com.kimi.tft;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import org.json.*;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.zip.*;

public final class DataSync {
    public static final String CLOUD = CloudConfig.BASE;
    public interface Callback { void done(boolean changed, String message); }
    private final Context context;
    private final SharedPreferences prefs;
    private final File datasets;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private boolean syncing;
    private volatile File active;

    public DataSync(Context context) {
        this.context = context;
        prefs = context.getSharedPreferences("kimi", Context.MODE_PRIVATE);
        datasets = new File(context.getFilesDir(), "datasets");
        datasets.mkdirs();
        String version = prefs.getString("data-version", "");
        if (version.matches("[A-Za-z0-9-]+")) {
            File saved = new File(datasets, version);
            if (new File(saved, "manifest.json").isFile()) active = saved;
        }
    }

    public byte[] readApi(String name) {
        File current = active;
        try {
            if (current != null) {
                File file = new File(current, "api/" + name);
                if (!file.getCanonicalPath().startsWith(current.getCanonicalPath() + "/api/")) return null;
                try (InputStream input = new FileInputStream(file)) { return bytes(input, 32 * 1024 * 1024); }
            }
            try (InputStream input = context.getAssets().open("api/" + name)) { return bytes(input, 32 * 1024 * 1024); }
        } catch (IOException e) { return null; }
    }

    public String status() {
        try {
            File current = active;
            if (current != null) try (InputStream input = new FileInputStream(new File(current, "manifest.json"))) { return new String(bytes(input, 1024 * 1024), "UTF-8"); }
            try (InputStream input = context.getAssets().open("api/manifest.json")) { return new String(bytes(input, 1024 * 1024), "UTF-8"); }
        } catch (IOException e) { return "{\"set\":\"TFTSet19\",\"refreshHours\":4}"; }
    }

    public synchronized void sync(boolean manual, Callback callback) {
        if (syncing) { if (callback != null) callback.done(false, "数据同步正在进行"); return; }
        if (!manual && System.currentTimeMillis() - prefs.getLong("last-check", 0) < 15 * 60 * 1000L) return;
        syncing = true;
        worker.execute(() -> {
            boolean changed = false;
            String message = "当前已是最新的 S19 数据";
            try { changed = perform(); if (changed) message = "S19 数据已同步并完成校验"; }
            catch (Exception e) { message = "云端连接暂未完成，继续使用已校验的离线数据"; Log.w("KimiSync", e.toString()); }
            finally { synchronized (DataSync.this) { syncing = false; } }
            if (callback != null) callback.done(changed, message);
        });
    }

    private boolean perform() throws Exception {
        long start = System.currentTimeMillis();
        JSONObject manifest = new JSONObject(new String(download(CLOUD + "manifest.json", 1024 * 1024), "UTF-8"));
        if (!"TFTSet19".equals(manifest.getString("set"))) throw new IOException("Unsupported set");
        String version = manifest.getString("version");
        if (!version.matches("[A-Za-z0-9-]{1,80}")) throw new IOException("Invalid version");
        String currentVersion = new JSONObject(status()).optString("version");
        prefs.edit().putLong("last-check", System.currentTimeMillis()).apply();
        if (version.equals(currentVersion)) return false;
        if (!currentVersion.isEmpty() && version.compareTo(currentVersion) < 0) return false;
        JSONObject bundle = manifest.getJSONObject("bundle");
        String relative = bundle.getString("path");
        if (!relative.equals("snapshots/" + version + "/data.zip")) throw new IOException("Invalid bundle route");
        int expectedSize = bundle.getInt("size");
        if (expectedSize <= 0 || expectedSize > 20 * 1024 * 1024) throw new IOException("Oversized bundle");
        byte[] zip = download(CLOUD + relative, 20 * 1024 * 1024);
        if (zip.length != expectedSize || !sha(zip).equals(bundle.getString("sha256"))) throw new IOException("Bundle checksum mismatch");
        Map<String, JSONObject> expected = new HashMap<>();
        JSONArray entries = manifest.getJSONArray("files");
        if (entries.length() > 500) throw new IOException("Too many data entries");
        for (int i = 0; i < entries.length(); i++) {
            JSONObject entry = entries.getJSONObject(i);
            String name = entry.getString("path");
            if (!name.matches("api/(comps/)?[A-Za-z0-9_-]+\\.json")) throw new IOException("Invalid data path");
            expected.put(name, entry);
        }
        for (String core : new String[]{"seasons", "lookups", "comps", "units", "items", "augments", "unitItems", "meta"}) {
            if (!expected.containsKey("api/" + core + ".json")) throw new IOException("Missing core document");
        }
        File stage = new File(datasets, version + "-stage");
        remove(stage);
        stage.mkdirs();
        Set<String> found = new HashSet<>();
        long uncompressed = 0;
        try (ZipInputStream input = new ZipInputStream(new ByteArrayInputStream(zip))) {
            ZipEntry entry;
            while ((entry = input.getNextEntry()) != null) {
                if (entry.isDirectory()) continue;
                String name = entry.getName();
                JSONObject spec = expected.get(name);
                if (spec == null || found.contains(name)) throw new IOException("Unexpected zip entry");
                byte[] value = bytes(input, 20 * 1024 * 1024);
                uncompressed += value.length;
                if (uncompressed > 64 * 1024 * 1024 || value.length != spec.getInt("size") || !sha(value).equals(spec.getString("sha256"))) throw new IOException("Data checksum mismatch");
                JSONObject parsed = new JSONObject(new String(value, "UTF-8"));
                if (!name.equals("api/meta.json") && !parsed.optBoolean("success")) throw new IOException("Invalid data document");
                File out = new File(stage, name);
                out.getParentFile().mkdirs();
                try (OutputStream stream = new FileOutputStream(out)) { stream.write(value); }
                found.add(name);
                input.closeEntry();
            }
        } catch (Exception e) { remove(stage); throw e; }
        if (!found.equals(expected.keySet())) { remove(stage); throw new IOException("Incomplete data snapshot"); }
        JSONObject lookup = readJson(new File(stage, "api/lookups.json")).getJSONObject("data");
        if (!"TFTSet19".equals(lookup.getJSONObject("_metadata").getString("set"))) throw new IOException("Lookup set mismatch");
        JSONObject unitItems = readJson(new File(stage, "api/unitItems.json")).getJSONObject("data");
        if (!"TFTSet19".equals(unitItems.getString("tft_set"))) throw new IOException("Unit item set mismatch");
        JSONArray seasons = readJson(new File(stage, "api/seasons.json")).getJSONArray("data");
        if (seasons.length() != 1 || !"S19".equals(seasons.getJSONObject(0).getString("season"))) throw new IOException("Season mismatch");
        try (OutputStream output = new FileOutputStream(new File(stage, "manifest.json"))) { output.write(manifest.toString().getBytes("UTF-8")); }
        File ready = new File(datasets, version);
        if (ready.exists()) remove(ready);
        if (!stage.renameTo(ready)) throw new IOException("Snapshot commit failed");
        if (!prefs.edit().putString("data-version", version).commit()) throw new IOException("Snapshot pointer failed");
        active = ready;
        Log.i("KimiSync", "Snapshot committed " + version + " in " + (System.currentTimeMillis() - start) + "ms, bytes=" + zip.length);
        return true;
    }
    private static JSONObject readJson(File file) throws Exception {
        try (InputStream input = new FileInputStream(file)) { return new JSONObject(new String(bytes(input, 20 * 1024 * 1024), "UTF-8")); }
    }

    private static byte[] download(String url, int limit) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(60000);
        connection.setRequestProperty("Accept", "application/json, application/zip");
        connection.setRequestProperty("User-Agent", "tft-kimi-android/1.0");
        try {
            if (connection.getResponseCode() != 200) throw new IOException("HTTP " + connection.getResponseCode());
            try (InputStream input = connection.getInputStream()) { return bytes(input, limit); }
        } finally { connection.disconnect(); }
    }
    public static byte[] bytes(InputStream input, int max) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[16384];
        int count;
        while ((count = input.read(buffer)) != -1) {
            if (output.size() + count > max) throw new IOException("Data limit exceeded");
            output.write(buffer, 0, count);
        }
        return output.toByteArray();
    }
    private static String sha(byte[] data) throws Exception {
        StringBuilder hex = new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(data)) hex.append(String.format(Locale.ROOT, "%02x", b & 255));
        return hex.toString();
    }
    private static void remove(File file) {
        if (file.isDirectory()) { File[] children = file.listFiles(); if (children != null) for (File child : children) remove(child); }
        if (file.exists()) file.delete();
    }
}
