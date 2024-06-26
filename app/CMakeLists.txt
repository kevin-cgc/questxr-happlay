cmake_minimum_required(VERSION 3.22.1)
include(FetchContent)

project(happb)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POLICY_DEFAULT_CMP0077 NEW)

add_subdirectory(vendor)

FetchContent_Declare(spdlog
        GIT_REPOSITORY https://github.com/gabime/spdlog.git
        GIT_TAG v1.12.0
        GIT_SHALLOW TRUE
        GIT_PROGRESS TRUE
        )
FetchContent_MakeAvailable(spdlog)

FetchContent_Declare(glm
        GIT_REPOSITORY https://github.com/g-truc/glm.git
        GIT_TAG 0.9.9.8
        GIT_SHALLOW TRUE
        GIT_PROGRESS TRUE
        )
FetchContent_MakeAvailable(glm)

FetchContent_Declare(SPIRV-Reflect
        GIT_REPOSITORY https://github.com/KhronosGroup/SPIRV-Reflect.git
        GIT_TAG vulkan-sdk-1.3.268.0
        GIT_SHALLOW TRUE
        GIT_PROGRESS TRUE
        )
set(SPIRV_REFLECT_EXAMPLES OFF)
set(SPIRV_REFLECT_EXECUTABLE OFF)
set(SPIRV_REFLECT_STATIC_LIB ON)
FetchContent_MakeAvailable(SPIRV-Reflect)


FetchContent_Declare(
        libwebsockets
        GIT_REPOSITORY https://github.com/warmcat/libwebsockets.git
        GIT_TAG v4.3-stable # Replace with the desired version
        GIT_SHALLOW TRUE
        GIT_PROGRESS TRUE
)
set(LWS_WITH_SSL OFF)
set(LWS_WITHOUT_TESTAPPS ON)
FetchContent_MakeAvailable(libwebsockets)

FetchContent_Declare(json URL https://github.com/nlohmann/json/releases/download/v3.11.3/json.tar.xz)
FetchContent_MakeAvailable(json)

add_subdirectory(src)
