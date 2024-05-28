#!/bin/bash

set -ex

./gradlew assembleDebug
adb install -r ./app/build/outputs/apk/debug/app-debug.apk
adb logcat -c
adb shell am start -n app.kevin_asu.happb/android.app.NativeActivity
adb logcat -s HapPB:V