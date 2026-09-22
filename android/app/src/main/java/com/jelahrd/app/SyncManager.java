package com.jelahrd.app;

import android.app.Activity;
import android.util.Base64;
import android.webkit.WebView;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Offline-first sync: bundled snapshot -> internal content.json ->
 * server /api/content.json when online. No dependencies, background threads.
 */
public class SyncManager {

    public static final String SITE = "https://hrd.kabirmahmud.xyz";
    private static final String FILE = "content.json";
    private static final String ASSET = "www/snapshot.json";

    public interface Listener {
        void onStatus(String msg);
        void onData(String base64);
    }

    /* ---------- storage ---------- */

    public static String readInternal(Activity act) {
        try {
            File f = new File(act.getFilesDir(), FILE);
            if (!f.exists()) return null;
            FileInputStream in = new FileInputStream(f);
            try {
                return readAll(in);
            } finally {
                try { in.close(); } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            return null;
        }
    }

    public static String readAsset(Activity act) {
        InputStream in = null;
        try {
            in = act.getAssets().open(ASSET);
            return readAll(in);
        } catch (Exception e) {
            return null;
        } finally {
            if (in != null) try { in.close(); } catch (Exception ignored) {}
        }
    }

    public static void saveInternal(Activity act, String json) {
        FileOutputStream out = null;
        try {
            out = act.openFileOutput(FILE, android.content.Context.MODE_PRIVATE);
            out.write(json.getBytes("UTF-8"));
        } catch (Exception ignored) {
        } finally {
            if (out != null) try { out.close(); } catch (Exception ignored) {}
        }
    }

    public static String versionOf(String json) {
        if (json == null) return null;
        try {
            return new JSONObject(json).optString("version", null);
        } catch (Exception e) {
            return null;
        }
    }

    public static String toBase64(String json) {
        if (json == null) return null;
        try {
            return Base64.encodeToString(json.getBytes("UTF-8"), Base64.NO_WRAP);
        } catch (Exception e) {
            return null;
        }
    }

    private static String readAll(InputStream in) throws Exception {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] tmp = new byte[8192];
        int n;
        while ((n = in.read(tmp)) > 0) buf.write(tmp, 0, n);
        return buf.toString("UTF-8");
    }

    /* ---------- network ---------- */

    private static String httpGet(String url) throws Exception {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(12000);
            c.setReadTimeout(30000);
            c.setRequestProperty("Accept", "application/json");
            c.setRequestProperty("User-Agent", "HrdApp/1");
            c.connect();
            if (c.getResponseCode() != 200) throw new Exception("http " + c.getResponseCode());
            InputStream in = c.getInputStream();
            try {
                return readAll(in);
            } finally {
                try { in.close(); } catch (Exception ignored) {}
            }
        } finally {
            if (c != null) c.disconnect();
        }
    }

    /* ---------- flows (call off the UI thread except pushLocal) ---------- */

    /** Push bundled/stored data to the reader. Safe on UI thread (reads files only). */
    public static void pushLocal(Activity act, WebView web, Listener l) {
        String json = readInternal(act);
        if (json == null) json = readAsset(act);
        if (json == null) {
            l.onStatus("সংরক্ষিত কন্টেন্ট পাওয়া যায়নি।");
            return;
        }
        String b64 = toBase64(json);
        if (b64 != null) web.evaluateJavascript("App.setData('" + b64 + "');", null);
    }

    /** Full sync: version probe -> full pull on change. Runs network in background. */
    public static void sync(final Activity act, final WebView web, final Listener l) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    String probe = httpGet(SITE + "/api/content.json?check=1");
                    final String serverVer = versionOf(probe);
                    if (serverVer == null) throw new Exception("bad probe");
                    String local = readInternal(act);
                    if (local == null) local = readAsset(act);
                    final String localVer = versionOf(local);
                    if (serverVer.equals(localVer)) {
                        setUpdateFlag(act, web, false);
                        post(act, l, "সব কন্টেন্ট আপডেট আছে।", null, web);
                        return;
                    }
                    // Update prompt: tell the reader an update exists; banner
                    // button calls Android.refresh() which lands back here and
                    // pulls the full content (no APK re-download).
                    setUpdateFlag(act, web, true);
                    final String full = httpGet(SITE + "/api/content.json");
                    if (!serverVer.equals(versionOf(full))) throw new Exception("version moved");
                    saveInternal(act, full);
                    post(act, l, "নতুন কন্টেন্ট আপডেট হয়েছে।", toBase64(full), web);
                } catch (Exception e) {
                    post(act, l, "ইন্টারনেট নেই — ফোনের কন্টেন্ট দেখাচ্ছে।", null, web);
                }
            }
        }).start();
    }

    private static void post(final Activity act, final Listener l,
                             final String msg, final String b64, final WebView web) {
        act.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                l.onStatus(msg);
                if (b64 != null && web != null) {
                    web.evaluateJavascript("App.setData('" + b64 + "');", null);
                    try {
                        web.evaluateJavascript("App.setUpdate('0');", null);
                    } catch (Exception ignored) {}
                }
            }
        });
    }

    private static void setUpdateFlag(final Activity act, final WebView web, final boolean on) {
        act.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (web == null) return;
                try {
                    web.evaluateJavascript("App.setUpdate('" + (on ? "1" : "0") + "');", null);
                } catch (Exception ignored) {}
            }
        });
    }
}
