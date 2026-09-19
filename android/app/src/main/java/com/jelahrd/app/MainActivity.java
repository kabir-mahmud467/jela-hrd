package com.jelahrd.app;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.ProgressBar;

/** Hrd — thin WebView shell over https://hrd.kabirmahmud.xyz/ (minSdk 23). */
public class MainActivity extends Activity {

    private static final int REQ_STORAGE = 1001;

    private WebView web;
    private View loader;
    private View errorbox;
    private String pendingDownloadUrl;
    private String pendingDownloadAgent;
    private String pendingDownloadDisposition;
    private String pendingDownloadMime;

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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        }

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && request != null
                        && request.getUrl() != null) {
                    return handleUrl(request.getUrl().toString());
                }
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                errorbox.setVisibility(View.GONE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                loader.setVisibility(View.GONE);
            }

            @Override
            @SuppressWarnings("deprecation")
            public void onReceivedError(WebView view, int errorCode,
                                        String description, String failingUrl) {
                showError();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        && request != null && request.isForMainFrame()) {
                    showError();
                }
            }
        });

        web.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent,
                                        String contentDisposition, String mimeType,
                                        long contentLength) {
                startDownload(url, userAgent, contentDisposition, mimeType);
            }
        });

        Button retry = (Button) findViewById(R.id.retry);
        retry.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                reloadSite();
            }
        });

        if (savedInstanceState != null) {
            web.restoreState(savedInstanceState);
        } else {
            reloadSite();
        }
    }

    private boolean handleUrl(String url) {
        if (url == null) return false;
        String host = getString(R.string.site_host);
        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if (("http".equals(scheme) || "https".equals(scheme))
                && host.equalsIgnoreCase(uri.getHost())) {
            return false; // site pages stay inside the app
        }
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, uri);
            startActivity(i);
        } catch (Exception ignored) {
        }
        return true;
    }

    private void reloadSite() {
        if (!isOnline()) {
            showError();
            return;
        }
        loader.setVisibility(View.VISIBLE);
        errorbox.setVisibility(View.GONE);
        web.loadUrl(getString(R.string.start_url));
    }

    private void showError() {
        if (web.getProgress() < 10 && web.getUrl() == null) {
            loader.setVisibility(View.GONE);
            errorbox.setVisibility(View.VISIBLE);
        } else {
            loader.setVisibility(View.GONE);
        }
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

    // ---- Book PDF downloads via system DownloadManager ----

    private void startDownload(String url, String userAgent,
                               String contentDisposition, String mimeType) {
        pendingDownloadUrl = url;
        pendingDownloadAgent = userAgent;
        pendingDownloadDisposition = contentDisposition;
        pendingDownloadMime = mimeType;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q
                && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(
                    new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORAGE);
            return;
        }
        enqueueDownload();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions,
                                           int[] grantResults) {
        if (requestCode == REQ_STORAGE
                && grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            enqueueDownload();
        }
    }

    private void enqueueDownload() {
        if (pendingDownloadUrl == null) return;
        try {
            DownloadManager.Request req =
                    new DownloadManager.Request(Uri.parse(pendingDownloadUrl));
            String fileName = android.webkit.URLUtil.guessFileName(
                    pendingDownloadUrl, pendingDownloadDisposition, pendingDownloadMime);
            req.setTitle(fileName);
            req.setDescription(getString(R.string.app_name));
            req.setMimeType(pendingDownloadMime);
            req.addRequestHeader("Cookie", CookieManager.getInstance().getCookie(
                    pendingDownloadUrl));
            if (pendingDownloadAgent != null) {
                req.addRequestHeader("User-Agent", pendingDownloadAgent);
            }
            req.setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setDestinationInExternalPublicDir(
                    Environment.DIRECTORY_DOWNLOADS, fileName);
            DownloadManager dm = (DownloadManager) getSystemService(
                    Context.DOWNLOAD_SERVICE);
            if (dm != null) dm.enqueue(req);
        } catch (Exception ignored) {
        } finally {
            pendingDownloadUrl = null;
        }
    }

    // ---- Lifecycle ----

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
