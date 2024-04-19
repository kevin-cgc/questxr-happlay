# Haptic Playback on Quest XR

This project is a barebones prototype to play pcm haptic data on Oculus Quest controllers.
Using the Meta Quest Developer Hub, the proximity sensor and boundary can be disabled so the HMD does not need to be worn.

## Building the Quest App

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

## Running the Controller Server

The controller server is a simple node.js server that serves the controller web app and facilitates communication with the Quest app via websockets. To run the server, first install the dependencies, then start the server:

```bash
(cd server && npm i)
node server/
```

Use ngrok to expose the server to the Quest app:
```bash
ngrok http --domain=example-example-example.ngrok-free.app --scheme http 8080
```

And open the controller locally in a browser at `http://localhost:8081`.

See [system-architecture.svg](docs/system-architecture.svg) for a basic overview of the setup.
