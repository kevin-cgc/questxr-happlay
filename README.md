# Haptic Playback on Quest XR

todo


### Building the project

Only the following dependencies are required:

- [Android SDK](https://developer.android.com/studio)

- [Vulkan SDK](https://vulkan.lunarg.com/sdk/home)

Set sdk.dir in `local.properties` to the path of the Android SDK and WS_SERVER_DOMAIN to the domain of the happlay controller server.
For example:
```
sdk.dir=C\:\\Users\\USERNAME\\AppData\\Local\\Android\\Sdk
WS_SERVER_DOMAIN=example-example-example.ngrok-free.app
```

To build the project just run the following in the project directory:

```bash
 ./gradlew assembleDebug #for debug build
 ./gradlew assembleRelease # for release build
```

After that, apk can be found in `app/build/outputs/apk/` directory.
