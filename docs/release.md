# 🚀 HÕIMU Release Guidelines & Workflow

This document outlines the standard release process for HÕIMU (Web & Android native Capacitor target).

---

## 📦 1. How to Bump the Version

1. **Update `package.json`**:
   Update the `"version"` field in `package.json`:
   ```json
   {
     "version": "0.1.0"
   }
   ```

2. **Update `CHANGELOG.md`**:
   Add a new version entry following the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format:
   ```markdown
   ## [0.1.0] - YYYY-MM-DD

   ### Added
   - List new features...

   ### Changed
   - List changes...

   ### Fixed
   - List bug fixes...
   ```

3. **Verify Code Quality**:
   Run the pre-push verification suite locally before committing:
   ```bash
   bun run prepush
   # or: npm run verify && npm test
   ```

---

## 🏷️ 2. How to Tag a Release

1. **Commit Version Changes**:
   ```bash
   git add package.json CHANGELOG.md docs/
   git commit -m "Chore: release v0.1.0"
   ```

2. **Create Annotated Git Tag**:
   ```bash
   git tag -a v0.1.0 -m "Initial modular alpha"
   ```

3. **Push Commits and Tags**:
   ```bash
   git push origin main
   git push origin v0.1.0
   ```

4. **GitHub Release (Optional)**:
   - Navigate to **Releases -> Draft a new release** on GitHub.
   - Select the `v0.1.0` tag.
   - Paste the `v0.1.0` section from `CHANGELOG.md` into the release notes.

---

## 🏗️ 3. How to Build Release Artifacts

### A. Web Artifacts

1. **Build Production Assets**:
   ```bash
   bun run build
   # or: npm run build
   ```
   This generates optimized static web assets in the `dist/` directory.

2. **Test Production Bundle Locally**:
   ```bash
   bun run preview
   # or: npm run preview
   ```

---

### B. Android Native Artifacts (Capacitor)

1. **Sync Native Dependencies**:
   Ensure `dist/` is built first, then synchronize Capacitor native code:
   ```bash
   bun run build
   npx cap sync android
   ```

2. **Configure Versioning in Android Project**:
   Update `android/app/build.gradle` so `versionCode` and `versionName` match your release tag:
   ```groovy
   android {
       defaultConfig {
           versionCode 1
           versionName "0.1.0"
       }
   }
   ```

3. **Build APK / AAB**:
   - **Command Line (Gradle)**:
     ```bash
     cd android
     ./gradlew assembleRelease   # Generates unaligned/signed APK
     ./gradlew bundleRelease     # Generates Android App Bundle (.aab)
     ```
   - **Android Studio GUI**:
     ```bash
     npx cap open android
     ```
     Go to **Build -> Generate Signed Bundle / APK...**, select your keystore, and build the release `.apk` or `.aab`.

4. **Output Locations**:
   - **APK**: `android/app/build/outputs/apk/release/app-release.apk`
   - **AAB**: `android/app/build/outputs/bundle/release/app-release.aab`
