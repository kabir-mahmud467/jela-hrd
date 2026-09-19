# Hrd — Android APK (offline-first, native WebView shell)

True app: **all content works offline, no internet needed.**
When online, the app pulls newly added content from the site database.

- `applicationId com.jelahrd.app`, `minSdk 23` (Android 6.0) → `targetSdk 34`
- Framework only — no AndroidX, no external dependencies
- `assets/www/` = offline reader (checklist, 7 sections, search, phase filters)
- `assets/www/snapshot.json` = content bundled at build time (first-run data)
- `SyncManager` = version probe (`/api/content.json?check=1`) → full pull on
  change → saved to internal `content.json` → reader refreshes, all offline
- ⟳ button (or auto-sync on launch when online) refreshes from DB
- External (http/https) links open in the browser; back button = app history

## Install

`Hrd.apk` in this folder is **release-signed** — copy to the phone and tap it
(enable “Install unknown apps” for the file manager/browser once).

> Play Protect may show an “unknown app” notice on first install (no Play
> Store reputation yet) — choose **“Install anyway”**. This warning
> disappears only via Play Store publishing; the APK itself is safe and
> release-signed with our own key (see below).

## Build

Needs: JDK 17+ (`/usr/lib/jvm/java-21-openjdk-amd64` here),
Android SDK with platform 34 + build-tools 34 (`~/Android/sdk` here).

```bash
cd android
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
echo "sdk.dir=$HOME/Android/sdk" > local.properties   # gitignored
./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

Before building, refresh the bundled snapshot from the live DB:

```bash
curl -s https://hrd.kabirmahmud.xyz/api/content.json -o app/src/main/assets/www/snapshot.json
```

Then copy the tested APK here:

```bash
cp app/build/outputs/apk/debug/app-debug.apk Hrd.apk   # debug (testing only)
cp app/build/outputs/apk/release/app-release.apk Hrd.apk  # release (share this)
```

## Release key — READ THIS

- Keystore: `android/hrd-release.jks` (**gitignored, never commit**).
- Passwords: `~/.gradle/hrd-signing.properties` (outside repo).
- Backup copy: `~/backups/hrd-keystore/` (keystore + passwords).
- **If the keystore is lost, phones will refuse updates** (Android requires
  the same signature). Back it up off-machine before sharing the APK widely.
- Bump `versionCode` in `app/build.gradle` on every update or phones
  will not accept the new APK.

## Changing the site URL

`SyncManager.SITE` in `app/src/main/java/com/jelahrd/app/SyncManager.java`
— rebuild after editing.
