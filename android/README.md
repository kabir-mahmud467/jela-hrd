# Hrd — Android APK (native WebView wrapper)

Thin native shell over **https://hrd.kabirmahmud.xyz/**
(PWA was removed from the site; this APK replaces it).

- `applicationId com.jelahrd.app`, `minSdk 23` (Android 6.0) → `targetSdk 34`
- Framework only — no AndroidX, no external dependencies
- Site pages stay in-app; outside links open in the browser
- Book PDF links download via system DownloadManager
- Back button = WebView history; offline = Bengali retry screen

## Build

Needs: JDK 17+ (`/usr/lib/jvm/java-21-openjdk-amd64` here),
Android SDK with platform 34 + build-tools 34 (`~/Android/sdk` here).

```bash
cd android
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
echo "sdk.dir=$HOME/Android/sdk" > local.properties   # gitignored
./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
```

Copy the tested APK to `android/Hrd.apk` (committed) after renaming:

```bash
cp app/build/outputs/apk/debug/app-debug.apk Hrd.apk
```

## Release notes

- `Hrd.apk` in this folder is a **debug-signed** build — installs fine
  directly on any Android 6+ phone (enable “Install unknown apps”).
- `versionCode`/`versionName` live in `app/build.gradle` — bump
  `versionCode` on every update so phones accept the new APK.
- Changing the site URL: edit `app/src/main/res/values/strings.xml`
  (`start_url` + `site_host`), rebuild.
