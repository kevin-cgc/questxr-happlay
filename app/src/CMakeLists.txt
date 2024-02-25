add_subdirectory(vulkanwrapper)
add_subdirectory(shaders)

add_library(native_app_glue STATIC ${ANDROID_NDK}/sources/android/native_app_glue/android_native_app_glue.c)
target_include_directories(native_app_glue PUBLIC ${ANDROID_NDK}/sources/android/native_app_glue)
set(CMAKE_SHARED_LINKER_FLAGS "${CMAKE_SHARED_LINKER_FLAGS} -u ANativeActivity_onCreate")

if(NOT DEFINED WS_SERVER_DOMAIN)
    message(FATAL_ERROR "WS_SERVER_DOMAIN is not defined. Please specify -DWS_SERVER_DOMAIN=your_domain when invoking CMake.")
endif()

add_library(happb SHARED
        graphics_plugin_vulkan.cpp
        main.cpp
        openxr_program.cpp
        openxr_utils.cpp
        platform_android.cpp
        vulkan_swapchain_context.cpp
        websocket.cpp
        )

target_compile_definitions(happb PRIVATE XR_USE_PLATFORM_ANDROID
        XR_USE_GRAPHICS_API_VULKAN
        VK_USE_PLATFORM_ANDROID_KHR
        WS_SERVER_DOMAIN="${WS_SERVER_DOMAIN}"
        )

target_link_libraries(
        happb
        android
        glm
        native_app_glue
        openxr_loader
        shaders
        spdlog
        vulkan-wrapper
        websockets
)
