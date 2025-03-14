#!/bin/bash

set -ex

if [ "$1" == "clean" ]; then
  ./gradlew clean
fi
if [ "$1" != "skipbuild" ]; then
  # ./gradlew assembleDebug
  ./gradlew assembleRelease
fi

# adb install -r ./app/build/outputs/apk/debug/app-debug.apk
adb install -r ./app/build/outputs/apk/release/app-release.apk
adb logcat -c
adb shell am start -n app.kevin_asu.happb/android.app.NativeActivity
adb logcat -s HapPB:V