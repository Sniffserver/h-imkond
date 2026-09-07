#!/usr/bin/env bash
set -e

echo "=== Building HÕIMU Web Assets for Android ==="
npm run build

echo "=== Syncing with Capacitor Android Project ==="
npx cap sync android

echo "=== Capacitor Android Sync Complete! ==="
echo "To open in Android Studio: npx cap open android"
