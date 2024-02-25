plugins {
    id("com.android.application")
}

import java.util.Properties
val localProperties = Properties()
val localPropertiesFile = rootProject.file("local.properties")
if (localPropertiesFile.exists()) { localProperties.load(localPropertiesFile.inputStream()) }

// Extract the value you need
val WsServerDomain: String? = localProperties.getProperty("WS_SERVER_DOMAIN")

android {
    compileSdk = 32
    ndkVersion = "26.1.10909125"
    namespace = "app.kevin_asu.happb"
    defaultConfig {
        minSdk = 32
        targetSdk = 32
        versionCode = 1
        versionName = "1.0"
        applicationId = "app.kevin_asu.happb"
        externalNativeBuild {
            cmake {
                arguments.add("-DANDROID_STL=c++_shared")
                arguments.add("-DANDROID_USE_LEGACY_TOOLCHAIN_FILE=OFF")
                if (WsServerDomain != null) { arguments.add("-DWS_SERVER_DOMAIN=${WsServerDomain}") }
            }
            ndk {
                abiFilters.add("arm64-v8a")
            }
        }
    }
    buildTypes {
        getByName("release") {
            isDebuggable = false
            isJniDebuggable = false
        }
        getByName("debug") {
            isDebuggable = true
            isJniDebuggable = true
        }
    }
    externalNativeBuild {
        cmake {
            version = "3.22.1"
            path("CMakeLists.txt")
        }
    }
    sourceSets {
        getByName("main") {
            manifest.srcFile("AndroidManifest.xml")
        }
        getByName("debug") {
            jniLibs {
                srcDir("libs/debug")
            }
        }
        getByName("release") {
            jniLibs.srcDir("libs/release")
        }
    }
    packaging {
        jniLibs {
            keepDebugSymbols.add("**.so")
        }
    }
    lintOptions {
        warning("ExpiredTargetSdkVersion")
    }
}


tasks.named("clean") {
    doLast {
        delete(".cxx")
    }
}
