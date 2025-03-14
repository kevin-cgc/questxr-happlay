#!/bin/bash

set -e

basedomain="$1"
if [ -z "$basedomain" ]; then
	echo "Usage: $0 <basedomain>"
	exit 1
fi

cp local.properties local.properties.orig

./gradlew --no-daemon clean

for NUM in 0 1 2 3 4 5 6 7 8 9
do
	echo "Building for pbcon${NUM}"

	OUTFILE="./app-release-pbcon${NUM}.apk"
	# OUTFILE="./app-debug-pbcon${NUM}.apk"

	if [ -f "$OUTFILE" ]; then
		echo "$OUTFILE already exists, skipping"
		continue
	fi

	grep -v "^WS_SERVER_DOMAIN" local.properties > local.properties.temp
	echo "WS_SERVER_DOMAIN=qxrhp${NUM}.${basedomain}" >> local.properties.temp
	mv local.properties.temp local.properties
	cat local.properties | grep qxrhp

	./gradlew --no-daemon assembleRelease;
	cp app/build/outputs/apk/release/app-release.apk "$OUTFILE";
	#./gradlew --no-daemon assembleDebug
	#cp app/build/outputs/apk/debug/app-debug.apk "$OUTFILE"

	echo -e "Built $OUTFILE.\n\n"
	sleep 2
done

7z a -tzip questxr-happlay-app-release-pbcon-i10-apks.zip app-release-pbcon*.apk
# 7z a -tzip questxr-happlay-app-debug-pbcon-i10-apks.zip app-debug-pbcon*.apk

mv local.properties.orig local.properties