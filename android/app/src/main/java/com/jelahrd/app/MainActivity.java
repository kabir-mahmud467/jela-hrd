package com.jelahrd.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.Toast;

/**
 * Hrd — offline-first app (minSdk 23).
 * Local reader (assets/www) renders bundled/stored content with zero network.
 * When online, SyncManager pulls fresh content from /api/content.json.
 */
public class MainActivity extends Activity {

    private WebView web;
    private View loader;
    private View errorbox;
    private boolean firstPage = true;

    private final SyncManager.Listener syncListener = new SyncManager.Listener() {
        @Override
        public void onStatus(final String msg) {
            pushSync(msg);
            if (loader != null) loader.setVisibility(View.GONE);
        }

        @Override
        public void onData(final String base64) {
            if (base64 != null && web != null) {
                web.evaluateJavascript("App.setData('" + base64 + "');", null);
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        web = (WebView) findViewById(R.id.webview);
        loader = (ProgressBar) findViewById(R.id.loader);
        errorbox = findViewById(R.id.errorbox);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);

        web.addJavascriptInterface(new JsApi(), "Android");

        /* JS dialogs need a chrome client — without it window.confirm()
           silently returns false, so every delete/reset button in the admin
           panel looked dead. Native Bengali dialogs instead. */
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onJsConfirm(WebView view, String url, String message,
                                       final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton("হ্যাঁ", new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface d, int w) {
                                result.confirm();
                            }
                        })
                        .setNegativeButton("না", new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface d, int w) {
                                result.cancel();
                            }
                        })
                        .setOnCancelListener(new DialogInterface.OnCancelListener() {
                            @Override
                            public void onCancel(DialogInterface d) {
                                result.cancel();
                            }
                        })
                        .show();
                return true;
            }

            @Override
            public boolean onJsAlert(WebView view, String url, String message,
                                     final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton("ঠিক আছে", new DialogInterface.OnClickListener() {
                            @Override
                            public void onClick(DialogInterface d, int w) {
                                result.confirm();
                            }
                        })
                        .setOnCancelListener(new DialogInterface.OnCancelListener() {
                            @Override
                            public void onCancel(DialogInterface d) {
                                result.cancel();
                            }
                        })
                        .show();
                return true;
            }
        });

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view,
                                                    android.webkit.WebResourceRequest request) {
                if (android.os.Build.VERSION.SDK_INT
                        >= android.os.Build.VERSION_CODES.LOLLIPOP
                        && request != null && request.getUrl() != null) {
                    return handleUrl(request.getUrl().toString());
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (firstPage) {
                    firstPage = false;
                    // 1) instant offline paint  2) sync when online
                    SyncManager.pushLocal(MainActivity.this, web, syncListener);
                    if (isOnline()) {
                        SyncManager.sync(MainActivity.this, web, syncListener);
                    } else {
                        syncListener.onStatus("ইন্টারনেট নেই — ফোনের কন্টেন্ট দেখাচ্ছে।");
                    }
                }
            }

            @Override
            @SuppressWarnings("deprecation")
            public void onReceivedError(WebView view, int errorCode,
                                        String description, String failingUrl) {
                if (firstPage) showError();
            }

            @Override
            public void onReceivedError(WebView view,
                                        android.webkit.WebResourceRequest request,
                                        android.webkit.WebResourceError error) {
                if (android.os.Build.VERSION.SDK_INT
                        >= android.os.Build.VERSION_CODES.M
                        && request != null && request.isForMainFrame() && firstPage) {
                    showError();
                }
            }
        });

        Button retry = (Button) findViewById(R.id.retry);
        retry.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                errorbox.setVisibility(View.GONE);
                loader.setVisibility(View.VISIBLE);
                firstPage = true;
                web.loadUrl("file:///android_asset/www/index.html");
            }
        });

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
            firstPage = false;
        } else {
            web.loadUrl("file:///android_asset/www/index.html");
        }
    }

    private boolean handleUrl(String url) {
        if (url == null) return false;
        if (url.startsWith("file://") || url.charAt(0) == '#') return false;
        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if ("http".equals(scheme) || "https".equals(scheme)) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (Exception ignored) {
            }
            return true;
        }
        return false;
    }

    private void pushSync(final String msg) {
        if (web == null) return;
        final String safe = msg.replace("\\", "\\\\").replace("'", "\\'");
        web.evaluateJavascript("App.setSync('" + safe + "');", null);
    }

    private void showError() {
        loader.setVisibility(View.GONE);
        errorbox.setVisibility(View.VISIBLE);
    }

    private boolean isOnline() {
        try {
            ConnectivityManager cm =
                    (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return true;
            NetworkInfo ni = cm.getActiveNetworkInfo();
            return ni != null && ni.isConnected();
        } catch (Exception e) {
            return true;
        }
    }

    private class JsApi {
        @JavascriptInterface
        public void refresh() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    pushSync("আপডেট দেখা হচ্ছে…");
                    Toast.makeText(MainActivity.this,
                            "নতুন কন্টেন্ট দেখা হচ্ছে…", Toast.LENGTH_SHORT).show();
                }
            });
            if (!isOnline()) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        syncListener.onStatus("ইন্টারনেট নেই — ফোনের কন্টেন্ট দেখাচ্ছে।");
                    }
                });
                return;
            }
            SyncManager.sync(MainActivity.this, web, syncListener);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
